const base26 = require("./base26.js");
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

  createResponse.session.sheets = sheets_lib.ListSheets(createResponse.session);
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
    "application/vnd.oasis.opendocument.spreadsheet",
  ];

  if (!acceptedMimeTypes.includes(file.mimetype)) {
    return "Uploaded file was not a supported file type";
  }

  return undefined;
};

/*
  * Returns a header row for display, based on the requested mode and the data
  * currently available in the state.
  *
  * The various display modes are:
  *  - none - return nothing, no display required
  *  - index - returns the index of the column in base26.
  *  - source - returns the header names as they are defined in the source file
  *  - target - returns the header names as they are in the domain object after mapping
  */
exports.HeaderRowDisplay = (session, displayMode) => {
  var mode = displayMode.toLowerCase();

  // User has selected 'none' mode, which means we don't return any headers as
  // the user does not want to show them.
  const noneMode = (range) => {
    return null
  }

  // Index mode, shows the index as base26 where the values are taken from the range
  const indexMode = (range) => {
    if (this.sheet == "") {
      console.warn("HeaderRowDisplay: No sheet selected so header display mode is 'none'")
      return null
    }

    const headers = new Array();
    for (var i = range[0]; i <= range[1]; i++) {
      headers.push(base26.toBase26(i + 1))
    }

    return headers
  }

  // Using the header values selected by the user, use those instead of column indices.
  const sourceMode = (range) => {
    const rows = sheets_lib.GetRows(session, session.headerRange.start.row, session.headerRange.end.row + 1)[0];
    const headers = new Array();

    for (var i = range[0]; i <= range[1]; i++) {
      headers.push(rows[i].value)
    }

    return headers;
  }

  // Use the header values from the mapped domain object, so the target column headings and the user's data
  // for that column.
  const targetMode = (range) => {
    return noneMode;
  }

  // Calculate the range, either from the currently selected columns, or from the number
  // of items in a row (making the assumption that they're even).
  var range = {};
  if (session.headerRange.hasOwnProperty("start") && session.headerRange.hasOwnProperty("end")) {
    range = [session.headerRange.start.column, session.headerRange.end.column]
  } else {
    const r = sheets_lib.GetRows(session)
    if (!r) {
      console.warn("HeaderRowDisplay: No rows available when determining number of columns")
      return null
    } else {
      range = [0, r[0].length]
    }
  }

  switch (mode) {
    // Index as base26 name
    case "index":
      return indexMode(range);
    // Header names as selected by user
    case "source":
      return sourceMode(range);
    // Header names as the fieldnames for the domain object
    case "target":
      return targetMode(range);
  }

  // If 'none' is specified, or the value provided isn't supported...
  return noneMode(range);
}
