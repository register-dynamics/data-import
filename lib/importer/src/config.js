//
// Manages the data-importer specific configuration options available to users.
//
// Configuration in the prototype is loaded at startup, and provided as a JS
// object to those that want access to it.  Changes to the prototype's config
// file at app/config.json will be reflected with an automaticreload if running
// in development mode.
//
// As we wish to be able to update the configuration file from the plugin itself
// we isolate the fields specific to the plugin here, and store the location of
// the config.json so that we can write write to it at runtime.
//
const attrTypes = require("./attribute-types")
const fs = require("fs");
const fse = require("fs-extra");
const path = require("node:path");
const os = require("node:os");

const TEMP_DIRECTORY_LABEL = "[Temporary directory]"

exports.MappingField = class {
  constructor(f = {}) {
    this.name = f.name
    this.required = f.required
    this.type = f.type
  }

  mapperForField = () => {
    const fieldType = attrTypes.typeFromName(this.type)
    if (this.required) {
      return attrTypes.requiredType(fieldType)
    }

    return attrTypes.optionalType(fieldType)
  }

}

exports.PluginConfig = class {
  constructor(config = {}) {
    this.fields = config.fields || [];
    this.uploadPath = config.uploadPath;
    this.uploadPathDefault = false;

    // If the config fields are in the old format (just names) then move them to
    // the new structure with default values of string for the type, and not required.
    if (this.fields.find(Boolean)) {
      if (typeof this.fields[0] === 'string' || this.fields[0] instanceof String) {
        this.fields = this.fields.map((x) => new exports.MappingField({ name: x, type: "string", required: false }))
      }
    }

    if (this.uploadPath == null || this.uploadPath == "") {
      this.uploadPath = path.join(os.tmpdir(), "reg-dyn-importer");
      this.uploadPathDefault = true;
    }

    if (!fs.existsSync(this.uploadPath)) {
      fs.mkdirSync(this.uploadPath, { recursive: true });
    }
  }

  //--------------------------------------------------------------------
  // Finds the location of the current prototype's config file and
  // returns the path.
  //--------------------------------------------------------------------
  get configPath() {
    // Taken from prototype kit's utils/paths.
    const projectDir = path.resolve(
      process.env.KIT_PROJECT_DIR || process.cwd(),
    );
    return path.join(projectDir, "app/config.json");
  }

  setFields = (fields) => {
    this.fields = fields;
  };

  setUploadPath = (newPath) => {
    if (newPath == null || newPath == "") {
      this.uploadPath = path.join(os.tmpdir(), "reg-dyn-importer");
      this.uploadPathDefault = true;
    } else {
      this.uploadPath = newPath;
      this.uploadPathDefault = false;
    }
  };

  as_object = () => {
    return {
      uploadPath: this.uploadPathDefault ? TEMP_DIRECTORY_LABEL : this.uploadPath,
      fields: this.fields
    }
  }

  //--------------------------------------------------------------------
  // Save the current data importer values into the existing and
  // current prototype's configuration file. It should leave all
  // other fields intact. There are no guarantees about the ordering
  // of fields in the newly saved file.
  //--------------------------------------------------------------------
  persistConfig = () => {
    const configFilePath = this.configPath;
    let current = fse.readJsonSync(configFilePath);

    current.fields = this.fields;
    current.uploadPath = this.uploadPath;

    fse.writeJsonSync(configFilePath, current);
  };
};
