const b26 = require('./util/base26')
const backend = require("./backend");
const attributeTypes = require('./types/attribute-types');

const DEFAULT_PREVIEW_LIMIT = 20

// Returns the name of all of the sheets in the file attached to
// the current session id
exports.ListSheets = (sid) => {
  const dimensions = backend.SessionGetInputDimensions(sid);
  const sheets = Array.from(dimensions.sheetDimensions.keys());
  return sheets;
};

// Given a session id and a range returns the text in the cells found for that
// row. Just leaves merged cells replicated across all cells in the merge, as
// it's intended for driving a list of available columns in the header.
exports.GetHeader = (sid, sheet) => {
  const headerRange = backend.SessionGetHeaderRange(sid, sheet)
  const headerSample = backend.SessionGetInputSampleRows(sid, headerRange, 1, 0, 0);

  const samples = headerSample[0][0].row;
  const columns = new Array();

  for (let i = 0; i < samples.length; i++) {
    if (samples[i]) {
      columns.push(samples[i].value)
    } else {
      const name = b26.toBase26(i + 1);
      columns.push(name)
    }
  }

  return columns
};

function processMergedCells(wantedColumns, preview) {
  // Pre-process colspan/rowspan attributes in cells, so the nunjucks macro
  // that makes an HTML table doesn't need to do clever things

  // When we have a cell that's merged with cells down and/or right of it, we
  // need to (a) add colspan/rowspan to the cell and (b) NOT emit the copies
  // of the cell that are spanned over.

  // Note that this isn't as trivial as it sounds - the range of the sheet
  // we're looking at might intersect the sides of merged cells in the input
  // sheet, so we might drop into a merged cell "midway". This is why the
  // backend spreads a merged cell out into lots of copies of itself in all
  // the cells covered by the merge, so we can slice out rows/columns at will,
  // then THIS code recombines the result into single rowspan/colspan cells
  // suitable for the HTML table model.

  // When we generated a rowspanning cell, we need to inhibit generation of that column for the corresponding number of upcoming rows.
  let rowSpansInProgress = new Array(wantedColumns);
  rowSpansInProgress.fill(0);
  let result = new Array();

  for (let row = 0; row < preview.length; row++) {
    let rowData = preview[row].row;
    let outputRow = new Array();
    for (let col = 0; col < wantedColumns; col++) {
      if (rowSpansInProgress[col]) {
        // Skip rowspan-merged cell
        rowSpansInProgress[col]--;
      } else {
        let cellData = rowData[col];
        if (cellData) {
          if (cellData.merge) {
            // Oooh ooh we need to emit a merged cell
            let augmentedCellData = Object.assign({}, cellData);

            // How much further right/down do we need to span this cell?
            augmentedCellData.colspan = cellData.merge.columns - cellData.merge.column;
            augmentedCellData.rowspan = cellData.merge.rows - cellData.merge.row;

            // Check our rowspan/colspan doesn't hang beyond the end of the table, by clamping it
            if (augmentedCellData.colspan > wantedColumns - col) {
              augmentedCellData.colspan = wantedColumns - col;
            }
            if (augmentedCellData.rowspan > preview.length - row) {
              augmentedCellData.rowspan = preview.length - row;
            }

            // Set rowSpansInProgress for subsequent columns to suppress
            // them as we continue along the row, and for THIS column but with the
            // rowspan number - 1 as we've already dealt with it ourselves
            rowSpansInProgress[col] = augmentedCellData.rowspan - 1;
            if (augmentedCellData.colspan > 1) {
              rowSpansInProgress.fill(augmentedCellData.rowspan, col + 1, col + augmentedCellData.colspan);
            }

            // Generate the cell
            outputRow.push(augmentedCellData);
          } else {
            // Normal cell
            outputRow.push(cellData);
          }
        } else {
          // Blank cell
          outputRow.push({ value: '' });
        }
      }
    }
    result.push({ index: preview[row].index, row: outputRow });
  }

  return result;
}

// Given a session id and a sheet name, gets a preview of the data held there
// returning either a 2dim array of rows/cells or null if that specific sheet
// is empty.
exports.GetPreview = (sid, sheet, count = 10) => {
  const dimensions = backend
    .SessionGetInputDimensions(sid)
    .sheetDimensions.get(sheet);

  const preview = backend.SessionGetInputSampleRows(sid, {
    sheet: sheet,
    start: { row: 0, column: 0 },
    end: { row: dimensions.rows, column: dimensions.columns > 0 ? dimensions.columns - 1 : 0 }
  }, Math.min(count, dimensions.rows), 0, 0)[0];

  // TODO: Is there a better way to tell if the sheet is empty than iterating
  // all the cells? - we should have something in SessionGetInputDimensions
  // that flags completely empty sheets in the backend, probably
  let cellCount = preview.reduce((acc, obj) => {
    return acc + obj.row.reduce((innerAcc, cell) => {
      if (cell && cell.value.length > 0) return innerAcc + 1;
      return innerAcc;
    }, 0)
  }, 0)

  if (cellCount == 0) {
    return null;
  }

  return processMergedCells(dimensions.columns, preview);
};


// Returns the total number of columns from the input
exports.GetTotalColumns = (sid, sheet) => {
  return backend
    .SessionGetInputDimensions(sid)
    .sheetDimensions.get(sheet)
    .columns;
};

// Returns the total number of rows from the input either the named
// sheet or the currently selected sheet
exports.GetTotalRows = (sid, sheet) => {
  return backend
    .SessionGetInputDimensions(sid)
    .sheetDimensions.get(sheet)
    .rows;
};



// Given a session id and a sheet returns up to count rows.
exports.GetRows = (sid, sheet, start = 0, count = 10) => {
  const sheetDimensions = backend.SessionGetInputDimensions(sid)
    .sheetDimensions.get(sheet);

  // Try to provide rows from start to start+count-1, but limit ourselves to
  // the rows in the sheet.
  const rowRange = {
    sheet: sheet,
    start: { row: start, column: 0 },
    end: { row: Math.min(start + count, sheetDimensions.rows), column: sheetDimensions.columns - 1 }
  }
  const wantedRows = rowRange.end.row - start;
  const preview = backend.SessionGetInputSampleRows(sid, rowRange, wantedRows, 0, 0)[0];

  return processMergedCells(rowRange.end.column - rowRange.start.column + 1, preview);
};

exports.GetRowRangeFromEnd = (sid, sheet, count = 10) => {
  const sheetDimensions = backend.SessionGetInputDimensions(sid)
    .sheetDimensions.get(sheet);

  // We have to calculate the range containing the data based on what we believe
  // the header range to be.
  const hRange = backend.SessionGetHeaderRange(sid, sheet)

  const end = sheetDimensions.rows - 1;
  return {
    sheet: sheet,
    start: { row: Math.max(end - count, hRange.start.row + 1), column: hRange.start.column },
    end: { row: end, column: hRange.end.column }
  }
}

// Given a session id and a sheet returns up to count rows.
exports.GetTrailingRows = (sid, sheet, count = 10) => {
  const hRange = backend.SessionGetHeaderRange(sid, sheet);
  const rowRange = exports.GetRowRangeFromEnd(sid, sheet, count)
  const wantedRows = Math.min(count, rowRange.end.row - hRange.end.row);
  return backend.SessionGetInputSampleRows(sid, rowRange, 0, 0, wantedRows)[2];
};


// Retrieves 'count' items from the column at columnIndex.  Each item be
// shorter than `cellWidth` otherwise it will be truncated.
exports.GetColumnValues = (sid, sheet, columnIndex, cellWidth = 30, count = 10) => {
  const hRange = backend.SessionGetHeaderRange(sid, sheet)
  const fRange = backend.SessionGetFooterRange(sid, sheet)

  let dataRange = backend.SessionSuggestDataRange(sid, hRange, fRange);
  // Limit to just the column we want
  dataRange.start.column += columnIndex;
  dataRange.end.column = dataRange.start.column;
  let values = backend.SessionGetInputValues(
    sid,
    dataRange,
    count
  )[0];

  if (values.inputValues && cellWidth > 0) {
    values.inputValues = values.inputValues.map((v) => {
      if (v && v.length > cellWidth) {
        return v.substring(0, cellWidth) + ".."
      } else {
        return v
      }
    });
  }

  return values;
};


// Convert source mapping (a map from column index -> attribute name) into a mapping for the backend
// TODO: This should be in the front-end and we should set expectations for what the mapping should
// look like when sending to the backend.
const RewriteMapping = (mapping, fields) => {
  let rewrittenMapping = new Map();

  const attrTypes = {}

  for (const [columnIndex, attributeName] of Object.entries(mapping)) {
    if (attributeName !== null && attributeName !== undefined && attributeName != '') {
      rewrittenMapping[attributeName] = parseInt(columnIndex);
    }

    const f = fields.find((x) => x.name == attributeName)
    if (f) {
      // FIXME: Actually let the user pick a format, for types that need one. Hardcoding "false" for now.
      attrTypes[f.name] = attributeTypes.mapperForField(f, false)
    }
  }

  return {
    attributeMappings: rewrittenMapping,
    attributeTypes: attrTypes
  };
}

// Uses the session ID provided, which must contain a sheet name and a
// mapping to perform the mapping of the data across the remaining
// rows in the sheet to return an array of objects.
exports.MapData = (sid, sheet, mapping, fields, previewLimit = DEFAULT_PREVIEW_LIMIT) => {
  const hRange = backend.SessionGetHeaderRange(sid, sheet)
  const fRange = backend.SessionGetFooterRange(sid, sheet)

  // Construct the range to be mapped - everything but the first row
  const rowRange = backend.SessionSuggestDataRange(sid, hRange, fRange);

  // Convert source mapping (a map from column index -> attribute name) into a mapping for the backend
  let rewrittenMapping = RewriteMapping(mapping, fields)

  // Apply the mapping
  const backendJid = backend.SessionPerformMappingJob(sid, rowRange, rewrittenMapping);

  // Read all the results into memory
  const resultSummary = backend.JobGetSummary(sid, backendJid);

  const recordsToPreview = Math.min(resultSummary.recordCount, previewLimit);
  const results = backend.JobGetRecords(sid, backendJid, 0, recordsToPreview);

  // Rewrite the results to be arrays in fields order, rather than objects

  const resultsAsArrays = results.map((row) => {
    let rowArray = fields.map((field) => {
      return row[field.name];
    });
    return rowArray;
  });

  let warnings = backend.JobGetWarnings(sid, backendJid);
  let errors = backend.JobGetErrors(sid, backendJid);

  // FIXME: As we just return up to previewLimit rows, we're throwing the rest
  // away. When used in production, we will either: (a) keep the job so they
  // can be used, (b) get them all and send them somewhere, or (c) throw them
  // away but keep the mapping so we can re-run the job later and do something
  // useful with the full results.

  errors = remapErrorStructure(errors, resultsAsArrays);
  warnings = remapErrorStructure(warnings, resultsAsArrays);

  // Delete the job results from the backend
  backend.JobDelete(sid, backendJid);
  // ...and return our in-memory copy, along with the counts
  return {
    resultRecords: resultsAsArrays,
    totalCount: resultSummary.recordCount,
    extraRecordCount: resultSummary.recordCount - recordsToPreview,
    warningCount: resultSummary.warningCount,
    errorCount: resultSummary.errorCount,
    warnings: warnings,
    errors: errors
  }
}

// Remaps the errors/warnings structure from
// [
//  { row: [{index:1, row:[]}], field: "A", message: "An error occurred" },
//  { row: [{index:1, row:[]}], field: "B", message: "An error occurred" },
//  { row: [{index:2, row:[]}], field: "B", message: "An error occurred" }
// ]
// to
// [
//  {
//    message: "An error occurred",
//    meta: {first: 1, count: 2}
//    fields: [ "A", "B"] },
//    rows: [[{index:1, row:[]}], [{index:2, row:[]}]] },
// ]
//
// This groups results first by error message, highlighting which fields (columns) have that error, and then
// which rows have that error. This is useful for displaying errors in a table format. Ideally, we want the
// cell object to contain an indication of whether it has an error or not, so we can highlight it in the table.
const remapErrorStructure = (errors, row_data) => {
    const messageMap = new Map();

    for (const error of errors) {
        if (!messageMap.has(error.message)) {
            messageMap.set(error.message, new Map());
        }

        const errorObj = messageMap.get(error.message);
        errorObj.message = error.message;
        if( !errorObj.fields) {
            errorObj.fields = new Set();
        }
        if( !errorObj.rows) {
            errorObj.rows = new Set();
        }

        errorObj.fields.add(error.field);

        if (row_data && Array.isArray(row_data) && error.row < row_data.length)  {
            // If row_data is provided, use the value from row_data; otherwise, use the row index
            let rowValue = row_data[error.row];

            // Add previous, current, and next row values if available
            if (error.row > 0) {
                errorObj.rows.add(row_data[error.row - 1]);
            }

            errorObj.rows.add(rowValue);

            if (error.row < row_data.length - 1) {
                errorObj.rows.add(row_data[error.row + 1]);
            }
        }
    }

    // Convert the nested maps/sets to the desired array structure
    return Array.from(messageMap.entries().map(([message, errorObj]) => {
        // Some rows may not have any errors because they are for surrounding context,
        // so we need to filter them out for the meta info
        const errorRows = Array.from(errorObj.rows).filter(rowObj => rowObj.row.some(element=>element.error) );

        return {
            message: message,
            meta: {
                first: errorRows[0]?.index || 0,
                count: errorObj.rows?.size
            },
            fields: Array.from(errorObj.fields),
            rows: Array.from(errorObj.rows)
        }
    }));
}

exports.RemapErrorStructure = remapErrorStructure
