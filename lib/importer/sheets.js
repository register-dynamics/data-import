const backend = require("./backend");

const DEFAULT_PREVIEW_LIMIT = 20

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


// Given a session and a sheet name, gets a preview of the data held there
// returning either a 2dim array of rows/cells or null if that specific sheet
// is empty.
exports.GetPreview = (session, sheet) => {
    const dimensions = backend
        .SessionGetInputDimensions(session.backendSid)
        .sheetDimensions.get(sheet);

    const preview = backend.SessionGetInputSampleRows(session.backendSid, {
        sheet: sheet,
        start: {row: 0, column: 0},
        end: {row: dimensions.rows, column: dimensions.columns > 0 ? dimensions.columns - 1 : 0 }
    }, 10, 0, 0);

    // TODO: Is there a better way to tell if the sheet is empty than iterating all the cells?
    let cellCount = preview[0].reduce((acc, row) => {
        return acc + row.reduce((innerAcc, cell) => {
            if (cell && cell.length > 0) return innerAcc + 1;
            return innerAcc;
        },0)
    }, 0)

    return cellCount == 0 ? null : preview[0];
  };


// Returns the total number of columns from the input
exports.GetTotalColumns = (session) => {
    return backend
    .SessionGetInputDimensions(session.backendSid)
    .sheetDimensions.get(session.sheet)
    .columns;
};


// Given a session and a starting row, returns up to count rows.
exports.GetRows = (session, start=0, count=10) => {
    const sheetDimensions = backend.SessionGetInputDimensions(session.backendSid)
          .sheetDimensions.get(session.sheet);

    // We have to calculate the range containing the data based on what we believe
    // the header range to be.
    const hRange = session.headerRange;
    const rowRange = {
        sheet: session.sheet,
        start: { row: hRange.start.row, column: hRange.start.column},
        end: { row: sheetDimensions.rows - (hRange.end.row + 1), column: hRange.end.column}
    }

    return backend.SessionGetInputSampleRows(session.backendSid, rowRange, count, 0, 0)[0];
};


exports.GetColumnValues = (session, columnIndex, cellWidth=30, count=10) => {
    let dataRange = backend.SessionSuggestDataRange(session.backendSid, session.headerRange, null);

    // Limit to just the column we want
    dataRange.start.column += columnIndex;
    dataRange.end.column = dataRange.start.column;

    let values = backend.SessionGetInputValues(
        session.backendSid,
        dataRange,
        count
    )[0];

    if (values.inputValues && cellWidth > 0) {
        values.inputValues = values.inputValues.map((v) => {
            if (v && v.length > cellWidth) {
                return v.substring(0, cellWidth ) + ".."
            } else {
                return v
            }
        });
    }

    return values;
};
// Return the unique values in each column in the range. Return no more than
// maxValues values for any given column. Return format is an array, one entry
// per column, whose entries have a .values property that's an array of values
// and a .hasMore property that's a boolean set if the values array was
// truncated to maxValues.
// exports.SessionGetInputValues = (sid, range, maxValues) => {


// Uses the session provided, which must contain a sheet name and a
// mapping to perform the mapping of the data across the remaining
// rows in the sheet to return an array of objects.
exports.MapData = (session, previewLimit = DEFAULT_PREVIEW_LIMIT) => {
    // Construct the range to be mapped - everything but the first row
    const sheetDimensions = backend.SessionGetInputDimensions(session.backendSid)
          .sheetDimensions.get(session.sheet);

    const hRange = session.headerRange;
    const rowRange = backend.SessionSuggestDataRange(session.backendSid, session.headerRange, null);

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

    const recordsToPreview = Math.min(resultSummary.recordCount, previewLimit);
    const results = backend.JobGetRecords(backendJid, 0, recordsToPreview);

    // Rewrite the results to be arrays in session.fields order, rather than objects
    const fields = session.fields;
    const resultsAsArrays = results.map((row) => {
        let rowArray = fields.map((fieldName) => {
            return row[fieldName];
        });
        return rowArray;
    });

    warnings = backend.JobGetWarnings(backendJid);
    errors = backend.JobGetErrors(backendJid);

    // FIXME: As we just return up to previewLimit rows, we're throwing the rest
    // away. When used in production, we will either: (a) keep the job so they
    // can be used, (b) get them all and send them somewhere, or (c) throw them
    // away but keep the mapping so we can re-run the job later and do something
    // useful with the full results.

    // Delete the job results from the backend
    backend.JobDelete(session.backendSid, backendJid);

    // ...and return our in-memory copy, along with the counts
    return {
        resultRecords: resultsAsArrays,
        totalCount: resultSummary.recordCount,
        extraRecordCount: resultSummary.recordCount-recordsToPreview,
        warningCount: resultSummary.warningCount,
        errorCount: resultSummary.errorCount,
        warnings: warnings,
        errors: errors
    }
}
