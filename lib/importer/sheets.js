const backend = require("./backend");

// Returns the name of all of the sheets in the file attached to 
// the current session
exports.ListSheets = (session) => {
  const dimensions = backend.SessionGetInputDimensions(session.backendSid);
  const sheets = Array.from(dimensions.sheetDimensions.keys());
  return sheets;
};

// Given a session and a range (row number initially) returns the text in 
// the cells found for that row.
exports.GetHeader = (session, range=0) => {
  const totalColumns = backend
        .SessionGetInputDimensions(session.backendSid)
        .sheetDimensions.get(session.sheet)
        .columns;
  const headerRange = {
      sheet: session.sheet,
      start: {row: range, column: 0},
      end: {row: range, column: totalColumns-range-1}
  };
  // We are assuming the first row is the headings for now but will
  // do better matching in future.
  const headerSample = backend.SessionGetInputSampleRows(session.backendSid, headerRange, 1, 0, 0);
  return headerSample[0][0];
};

// Uses the session provided, which must contain a sheet name and a 
// mapping to perform the mapping of the data across the remaining 
// rows in the sheet to return an array of objects.
exports.MapData = (session) => {
    // Construct the range to be mapped - everything but the first row
    const sheetDimensions = backend.SessionGetInputDimensions(session.backendSid)
          .sheetDimensions.get(session.sheet);
    const range = {
        sheet: session.sheet,
        start: {
            row: 1,
            column: 0
        },
        end: {
            row: sheetDimensions.rows-1,
            column: sheetDimensions.columns-1
        }
    };

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
    const backendJid = backend.SessionPerformMappingJob(session.backendSid, range, mapping);

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
