const base26 = require("./dudk/util/base26.js");
const crypto = require("crypto");
const sheets_lib = require("./dudk/sheets.js");
const backend = require("./dudk/backend");

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

class Range {
  constructor(start, end) {
    this.start = start
    this.end = end
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
  // the user does not want to show them. No pre-requisites.
  // eslint-disable-next-line no-unused-vars
  const noneMode = (_range) => {
    return null
  }

  // Index mode, shows the index as base26 where the values are taken from the range.
  // Requires a selected sheet
  const indexMode = (range) => {
    if (!session.sheet || session.sheet == "") {
      console.warn("HeaderRowDisplay: No sheet selected so header display mode is 'none'")
      return null
    }

    const headers = new Array();
    for (var i = range.start; i <= range.end; i++) {
      headers.push(base26.toBase26(i + 1))
    }

    return headers
  }

  // Using the header values selected by the user, use those instead of column indices.
  // Requires a selected sheet and a headerRange
  const sourceMode = (range) => {
    if (!session.sheet || session.sheet == "" || !session.headerRange) {
      console.warn("HeaderRowDisplay: No sheet selected so header display mode is 'none'")
      return null
    }

    if (!Object.prototype.hasOwnProperty.call(session.headerRange, "start") ||
      !Object.prototype.hasOwnProperty.call(session.headerRange, "end")) {
      console.warn("HeaderRowDisplay: No header range available for source headers")
      return null
    }

    const rows = sheets_lib.GetRows(session, session.headerRange.start.row, session.headerRange.end.row + 1)[0];
    const headers = new Array();

    for (var i = range.start; i <= range.end; i++) {
      headers.push(rows[i]?.value ?? "")
    }

    return headers;
  }

  // Use the header values from the mapped domain object, so the target column headings and the user's data
  // for that column.
  // Requires a selected sheet and a mapping
  // eslint-disable-next-line no-unused-vars
  const targetMode = (_range) => {
    if (!session.sheet || session.sheet == "") {
      console.warn("HeaderRowDisplay: No sheet selected so header display mode is 'none'")
      return null
    }

    if (!session.mapping) {
      console.warn("HeaderRowDisplay: No mapping available so header display mode is 'none'")
      return null
    }

    return noneMode;
  }

  var range = calculateHeaderRange(session)

  // Unless the mode is 'none' then a sheet is required to return headers for display
  if (mode != "none" && (!session.sheet || session.sheet == "")) {
    console.warn("HeaderRowDisplay: No sheet selected so header display mode is 'none'")
    return null
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

// Calculate the range, either from the currently selected columns, or from the number
// of items in a row (making the assumption that they're even).
const calculateHeaderRange = (session) => {
  if (Object.prototype.hasOwnProperty.call(session, "headerRange") &&
    Object.prototype.hasOwnProperty.call(session.headerRange, "start") &&
    Object.prototype.hasOwnProperty.call(session.headerRange, "end")) {
    return new Range(session.headerRange.start.column, session.headerRange.end.column)
  }

  if (!session.sheet || session.sheet == "") {
    console.warn("HeaderRowDisplay: No sheet selected so finding mode from rows is not possible")
    return null
  }

  // With no specified headers, try and default to the first row. This may already be set
  // earlier in the flow, but we add this defensively.
  const r = sheets_lib.GetRows(session)
  if (r) {
    return new Range(0, r[0].length)
  }

  console.warn("HeaderRowDisplay: No rows available when determining number of columns")
  return null
}
