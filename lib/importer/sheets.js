const backend = require("./backend");

// Returns the name of all of the sheets in the file attached to 
// the current session
exports.ListSheets = (session) => {
  const dimensions = backend.SessionGetInputDimensions(session.backendSid);
  const sheets = dimensions.sheetDimensions.keys();

  return sheets;
};

// Given a session and a range (row number initially) returns the text in 
// the cells found for that row.
exports.GetHeader = (session, range=0) => {
  const totalColumns = backend
        .SessionGetInputDimensions(session.backendSid)
        .sheetDimensions[session.sheet]
        .columns;
  const range = {
      sheet: session.sheet,
      start: {row: 0, column: 0},
      end: {row: 0, column: totalColumns-1}
  };
  // We are assuming the first row is the headings for now but will
  // do better matching in future.
  const headerSample = backend.SessionGetInputSampleRows(session.backendSid, range, 1, 0, 0);

  return headerSample[0][0];
};

// Uses the session provided, which must contain a sheet name and a 
// mapping to perform the mapping of the data across the remaining 
// rows in the sheet to return an array of objects.
exports.MapData = (session) => {
    // Construct the range to be mapped - everything but the first row
    const sheetDimensions = backend.SessionGetInputDimensions(session.sid)
          .sheetDimensions[session.sheet];
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
    const backendJid = backend.SessionPerformMappingJob(session.sid, range, mapping);

    // Read all the results into memory
    const resultSummary = backend.JobGetSampleRecords(backendJid);
    const results = backend.JobGetRecords(backendJid, 0, resultsSummary.records);

    // Delete the job results from the backend
    backend.JobDelete(session.sid, backendJid);

    // ...and return our in-memory copy
    return results;
}
