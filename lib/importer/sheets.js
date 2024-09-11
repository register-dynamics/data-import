const backend = require("./backend");

const DEFAULT_PREVIEW_LIMIT = 20

// Returns the name of all of the sheets in the file attached to
// the current session
exports.ListSheets = (session) => {
  const dimensions = backend.SessionGetInputDimensions(session.backendSid);
  const sheets = Array.from(dimensions.sheetDimensions.keys());
  return sheets;
};

// Given a session and a range returns the text in the cells found for that
// row. Just leaves merged cells replicated across all cells in the merge, as
// it's intended for driving a list of available columns in the header.
exports.GetHeader = (session) => {
  const headerSample = backend.SessionGetInputSampleRows(session.backendSid, session.headerRange, 1, 0, 0);
  return headerSample[0][0].map((sample) => sample.value);
};

function processMergedCells(wantedColumns, preview) {
  // FIXME: Disable colspan/rowspan generation for now, until
  // selectable_table.js is able to correctly handle selections across them.
  const disableSpans = true;

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

  for(let row=0; row<preview.length; row++) {
    let rowData = preview[row];
    let outputRow = new Array();
    for(let col=0; col<wantedColumns; col++) {
      if(rowSpansInProgress[col]) {
        // Skip rowspan-merged cell
        rowSpansInProgress[col]--;
        if(disableSpans) {
          // Blank cell
          outputRow.push({value: ''});
        }
      } else {
        let cellData = rowData[col];
        if(cellData) {
          if(cellData.merge) {
            // Oooh ooh we need to emit a merged cell
            let augmentedCellData = Object.assign({}, cellData);

            // How much further right/down do we need to span this cell?
            augmentedCellData.colspan = cellData.merge.columns - cellData.merge.column;
            augmentedCellData.rowspan = cellData.merge.rows - cellData.merge.row;

            // Check our rowspan/colspan doesn't hang beyond the end of the table, by clamping it
            if(augmentedCellData.colspan > wantedColumns-col) {
              augmentedCellData.colspan = wantedColumns-col;
            }
            if(augmentedCellData.rowspan > preview.length-row) {
              augmentedCellData.rowspan = preview.length-row;
            }

            // Set rowSpansInProgress for subsequent columns to suppress
            // them as we continue along the row, and for THIS column but with the
            // rowspan number - 1 as we've already dealt with it ourselves
            rowSpansInProgress[col] = augmentedCellData.rowspan-1;
            if (augmentedCellData.colspan > 1) {
              rowSpansInProgress.fill(augmentedCellData.rowspan, col+1, col+augmentedCellData.colspan);
            }

            // Generate the cell
            if(disableSpans) {
              delete augmentedCellData.colspan;
              delete augmentedCellData.rowspan;
            }
            outputRow.push(augmentedCellData);
          } else {
            // Normal cell
            outputRow.push(cellData);
          }
        } else {
          // Blank cell
          outputRow.push({value: ''});
        }
      }
    }
    result.push(outputRow);
  }

  return result;
}

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
  }, 10, 0, 0)[0];

  // TODO: Is there a better way to tell if the sheet is empty than iterating
  // all the cells? - we should have something in SessionGetInputDimensions
  // that flags completely empty sheets in the backend, probably
  let cellCount = preview.reduce((acc, row) => {
    return acc + row.reduce((innerAcc, cell) => {
      if (cell && cell.value.length > 0) return innerAcc + 1;
      return innerAcc;
    },0)
  }, 0)

  if (cellCount == 0) {
    return null;
  }

  return processMergedCells(Math.min(10, dimensions.rows), preview);
};


// Returns the total number of columns from the input
exports.GetTotalColumns = (session) => {
  return backend
    .SessionGetInputDimensions(session.backendSid)
    .sheetDimensions.get(session.sheet)
    .columns;
};


// Given a session returns up to count rows.
exports.GetRows = (session, count=10) => {
    const sheetDimensions = backend.SessionGetInputDimensions(session.backendSid)
          .sheetDimensions.get(session.sheet);

  // Try to provide rows from start to start+count-1, but limit ourselves to
  // the rows in the sheet.
  const rowRange = {
    sheet: session.sheet,
    start: { row: start, column: 0},
    end: { row: Math.min(start + count - 1, sheetDimensions.rows-1), column: sheetDimensions.columns-1}
  }

  const preview = backend.SessionGetInputSampleRows(session.backendSid, rowRange, Math.min(count, sheetDimensions.rows), 0, 0)[0];
  return processMergedCells(rowRange.end.column - rowRange.start.column + 1, preview);
};

// Given a session returns up to count rows.
exports.GetTrailingRows = (session, count=10) => {
    const sheetDimensions = backend.SessionGetInputDimensions(session.backendSid)
          .sheetDimensions.get(session.sheet);

    // We have to calculate the range containing the data based on what we believe
    // the header range to be.
    const hRange = session.headerRange;

    const rowRange = {
        sheet: session.sheet,
        start: { row: hRange.end.row, column: hRange.start.column},
        end: { row: sheetDimensions.rows -1, column: hRange.end.column}
    }

    return backend.SessionGetInputSampleRows(session.backendSid, rowRange, 0, 0, Math.min(count, sheetDimensions.rows))[2];
};


// Retrieves 'count' items from the column at columnIndex.  Each item be
// shorter than `cellWidth` otherwise it will be truncated.
exports.GetColumnValues = (session, columnIndex, cellWidth=30, count=10) => {
  let dataRange = backend.SessionSuggestDataRange(session.backendSid, session.headerRange, session.footerRange);

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


// Uses the session provided, which must contain a sheet name and a
// mapping to perform the mapping of the data across the remaining
// rows in the sheet to return an array of objects.
exports.MapData = (session, previewLimit = DEFAULT_PREVIEW_LIMIT) => {
  // Construct the range to be mapped - everything but the first row
  const sheetDimensions = backend.SessionGetInputDimensions(session.backendSid)
        .sheetDimensions.get(session.sheet);

<<<<<<< HEAD
  const hRange = session.headerRange;
  const rowRange = backend.SessionSuggestDataRange(session.backendSid, session.headerRange, null);
=======
    const hRange = session.headerRange;
    const rowRange = backend.SessionSuggestDataRange(session.backendSid, session.headerRange, session.footerRange);
>>>>>>> 980c7b6 (Use footer range when asking for data)

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
