const crypto = require("crypto");
const sheets_lib = require("./sheets.js");


class Session {
  constructor(p = {}) {
    this.id = p.id;
    this.filename = p.filename;
    this.fields = p.fields;
    this.sheet = "";
    this.sheets = [];
    this.mapping = {};
  }
}

exports.CreateSession = (config, request) => {
  const createResponse = {
    id: "",
    session: undefined,
    error: undefined,
  };

  const file = request.file;
  if (!file) {
    createResponse.error = "Please attach a file";
    return response;
  }

  const err = validateUpload(file);
  if (err != undefined) {
    createResponse.error = err;
    return response;
  }

  createResponse.id = getFilenameHash(file.filename);
  createResponse.session = new Session({
    id: createResponse.id,
    filename: `${config.uploadPath}/${file.filename}`,
    fields: config.fields,
  });

  createResponse.session.sheets = sheets_lib.ListSheets(createResponse.session.filename)
  return createResponse;
};

var getFilenameHash = (filename) => {
  var hash = crypto.createHash("md5");
  data = hash.update(filename, "utf-8");
  var gen_hash = data.digest("hex");
  return gen_hash;
};

var validateUpload = (file) => {
  if (
    file.mimetype !=
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return "Uploaded file was not an XLSX file";
  }

  return undefined;
};

