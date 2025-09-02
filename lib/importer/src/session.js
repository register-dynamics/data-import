const base26 = require("./dudk/util/base26.js");
const crypto = require("crypto");
const sheets_lib = require("./dudk/sheets.js");
const backend = require("./dudk/backend");

class Session {
  constructor(p = {}) {
    this.id = p.id;
    this.filename = p.filename;
    if ('backendSid' in p) {
      this.backendSid = p.backendSid
    } else {
      this.backendSid = backend.CreateSession();
      backend.SessionSetFile(this.backendSid, p.filename);
    }

    this.fields = p.fields;
    this.sheet = p.sheet ?? "";
  }

  get sheets() {
    return backend.SessionGetSheets(this.backendSid)
  }

  get headerRange() {
    return backend.SessionGetHeaderRange(this.backendSid, this.sheet)
  }

  set headerRange(range) {
    if (!range) return;

    const r = range;
    if (!r.sheet) {
      r.sheet = this.sheet
    }
    backend.SessionSetHeaderRange(this.backendSid, r)
  }

  get footerRange() {
    return backend.SessionGetFooterRange(this.backendSid, this.sheet)
  }

  set footerRange(range) {
    const r = range;
    if (!r.sheet) {
      r.sheet = this.sheet
    }

    backend.SessionSetFooterRange(this.backendSid, r)
  }

  get mapping() {
    return backend.SessionGetMappingRules(this.backendSid)
  }

  set mapping(rules) {
    backend.SessionSetMappingRules(this.backendSid, rules)
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

// It's possible the user has not specified any headers, and so
// that we can construct a header range, we need to know the
// possible widest row so that we can later map those values.
exports.GuessHeaderRange = (session, sheet) => {
  // If we have to guess the header range, then we will ask for the
  // dimensions and use whatever the sheets library tells us is the
  // end column
  const dimensions = backend.SessionGetSheetDimensions(session.backendSid, sheet);
  return [-1, dimensions.columns]
}

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
    if (!session.sheet) {
      console.warn("HeaderRowDisplay: No sheet selected so header display mode is 'none'")
      return null
    }

    const hrange = session.headerRange
    if (!hrange) {
      console.warn("HeaderRowDisplay: No header range available for source headers")
      return null
    }

    const headerRow = sheets_lib.GetRows(session.backendSid, session.sheet, session.headerRange.start.row, session.headerRange.end.row + 1)[0];
    const headers = new Array();
    for (var i = range.start; i <= range.end; i++) {
      headers.push(headerRow.row[i]?.value ?? "")
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
  const hrange = session.headerRange;
  if (hrange) {
    return new Range(hrange.start.column, hrange.end.column)
  }

  if (!session.sheet || session.sheet == "") {
    console.warn("HeaderRowDisplay: No sheet selected so finding mode from rows is not possible")
    return null
  }

  // With no specified headers, try and default to the first row. This may already be set
  // earlier in the flow, but we add this defensively.
  const r = sheets_lib.GetRows(session.backendSid, session.sheet)
  if (r) {
    return new Range(0, r[0].row.length)
  }

  console.warn("HeaderRowDisplay: No rows available when determining number of columns")
  return null
}

exports.Session = Session
