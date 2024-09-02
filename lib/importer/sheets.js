const backend = require("./backend");

// Returns the name of all of the sheets in the file attached to 
// the current session
exports.ListSheets = (session) => {
  const dimensions = backend.SessionGetInputDimensions(session.backendSid);
  const sheets = Array.from(dimensions.sheetDimensions.keys());
  return sheets;
};

// Given a session and a range returns the text in 
// the cells found for that row.
exports.GetHeader = (session) => {
  const headerSample = backend.SessionGetInputSampleRows(session.backendSid, session.headerRange, 1, 0, 0);
  return headerSample[0][0];
};


// Returns the total number of columns from the input
exports.GetTotalColumns = (session) => {
    return backend
    .SessionGetInputDimensions(session.backendSid)
    .sheetDimensions.get(session.sheet)
    .columns;
};


// Given a session and a range returns the text in 
// the cells found for that row.
exports.GetRows = (session, start=0, count=10) => {
    const sheetDimensions = backend.SessionGetInputDimensions(session.backendSid)
          .sheetDimensions.get(session.sheet);

    const hRange = session.headerRange;
    const rowRange = {
        sheet: session.sheet,
        start: { row: hRange.start.row, column: hRange.start.column},
        end: { row: sheetDimensions.rows - (hRange.end.row + 1), column: hRange.end.column}
    }

    return backend.SessionGetInputSampleRows(session.backendSid, rowRange, count, 0, 0)[0];
};


// Uses the session provided, which must contain a sheet name and a 
// mapping to perform the mapping of the data across the remaining 
// rows in the sheet to return an array of objects.
exports.MapData = (session) => {
    // Construct the range to be mapped - everything but the first row
    const sheetDimensions = backend.SessionGetInputDimensions(session.backendSid)
          .sheetDimensions.get(session.sheet);

    const hRange = session.headerRange;
    const rowRange = {
        sheet: session.sheet,
        start: { row: hRange.start.row + 1, column: hRange.start.column},
        end: { row: sheetDimensions.rows - (hRange.end.row + 1), column: hRange.end.column}
    }

    // Convert session.mapping (a map from column index -> attribute name) into a mapping for the backend
    const mappingSettings = session.mapping;
    let rewrittenMapping = new Map();

    for (const [columnIndex, attributeName] of Object.entries(session.mapping)) {
        if (attributeName !== null && attributeName !== undefined && attributeName != '') {
            rewrittenMapping[attributeName] = parseInt(columnIndex);
        }
    }

    const mapping = {
        attributeMappings: rewrittenMapping
    };

    // Apply the mapping
    const backendJid = backend.SessionPerformMappingJob(session.backendSid, rowRange, mapping);

    // Read all the results into memory
    const resultSummary = backend.JobGetSummary(backendJid);

    const results = backend.JobGetRecords(backendJid, 0, resultSummary.recordCount);

    // Rewrite the results to be arrays in session.fields order, rather than objects
    const fields = session.fields;
    const resultsAsArrays = results.map((row) => {
        let rowArray = fields.map((fieldName) => {
            return row[fieldName];
        });
        return rowArray;
    });

    // Delete the job results from the backend
    backend.JobDelete(session.backendSid, backendJid);

    // ...and return our in-memory copy
    return resultsAsArrays;
}
