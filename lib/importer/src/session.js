const crypto = require("crypto");
const sheets_lib = require("./sheets.js");
const backend = require("./backend");

class Session {
  constructor(p = {}) {
    this.id = p.id;
    this.filename = p.filename;
    this.backendSid = backend.CreateSession();
    backend.SessionSetFile(this.backendSid, p.filename);
    this.fields = p.fields;
    this.sheet = "";
    this.sheets = [];
    this.headerRange = {};
    this.footerRange = null;
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
    return createResponse;
  }

  const err = validateUpload(file);
  if (err != undefined) {
    createResponse.error = err;
    return createResponse;
  }

  createResponse.id = getFilenameHash(file.filename);
  createResponse.session = new Session({
    id: createResponse.id,
    filename: `${config.uploadPath}/${file.filename}`,
    fields: config.fields,
  });

  createResponse.session.sheets = sheets_lib.ListSheets(createResponse.session)
  return createResponse;
};

var getFilenameHash = (filename) => {
  const hash = crypto.createHash("md5");
  const data = hash.update(filename, "utf-8");
  const gen_hash = data.digest("hex");
  return gen_hash;
};

var validateUpload = (file) => {
  const acceptedMimeTypes = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "application/vnd.oasis.opendocument.spreadsheet"
  ];

  if (
    ! acceptedMimeTypes.includes(file.mimetype)
  ) {
    return "Uploaded file was not a supported file type";
  }

  return undefined;
};
