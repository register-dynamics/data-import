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
const fs = require("fs");
const fse = require("fs-extra");
const path = require("node:path");
const os = require("node:os");

exports.PluginConfig = class {
  constructor(config = {}) {
    this.fields = config.fields || [];
    this.uploadPath = config.uploadPath;
    this.uploadPathDefault = false;

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
    this.persistConfig();
  };

  setUploadPath = (path) => {
    this.uploadPath = path;
    this.uploadPathDefault = false;
    this.persistConfig();
  };

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

    // Only update the upload path if we have a value that is not the default
    if (!this.uploadPathDefault) {
      current.uploadPath = this.uploadPath;
    }

    fse.writeJsonSync(configFilePath, current);
  };
};
