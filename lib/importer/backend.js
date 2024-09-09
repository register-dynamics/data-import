const xlsx = require("xlsx");
const crypto = require("crypto");
const assert = require('node:assert').strict;

// An implementation of the interface described in https://struct.register-dynamics.co.uk/trac/wiki/DataImporter/API

// FIXME: State storage all in-memory for now...

let sessionStore = new Map();
let jobStore = new Map();

// Maximum number of rows/records to return in one go. While we're all
// in-memory, this merely restricts how much we allocate in one go for a shallow
// copy of a slice of the results; but when we have a non-in-memory backing
// store, this will prevent a caller from blowing out our available memory.
const MAXIMUM_BATCH_SIZE = 100;

exports.MAXIMUM_BATCH_SIZE = MAXIMUM_BATCH_SIZE;

function makeAccessToken(kind) {
    return kind + "-" + crypto.randomBytes(16).toString("hex");
}

///
/// Control Interface
///

// Create a new import session; returns session ID (sid)
exports.CreateSession = () => {
    let sid = makeAccessToken("s");
    sessionStore.set(sid, {});
    return sid;
};

///
/// Session Interface
///

// Set the filename of the file for an import session.
exports.SessionSetFile = (sid, filename) => {
    const wb = xlsx.readFile(filename, {dense: true});

    let session = {
        filename: filename,
        wb: wb,
        sheetNames: Array.from(Object.keys(wb.Sheets)),
        jobs: new Set(),
    }
    sessionStore.set(sid, session);
};

function getDimensions(sid) {
    let data = sessionStore.get(sid);
    let sheetDimensions = new Map();
    Object.keys(data.wb.Sheets).forEach((sheetName) => {
        const sheet = data.wb.Sheets[sheetName];
        const range = xlsx.utils.decode_range(sheet["!ref"]);
        sheetDimensions.set(sheetName, {
            rows: range.e.r+1,
            columns: range.e.c+1
        });
    });
    return {
        sheetDimensions: sheetDimensions,
    };
}

// Returns the input file structure, as an object with a property
// "sheetDimensions" mapping sheet names to objects with "rows" and "columns"
// properties listing how many rows and columns there are.
exports.SessionGetInputDimensions = (sid) => {
    assert(sessionStore.has(sid));
    return getDimensions(sid);
};

function randInRange(min, max) {
    return Math.floor(Math.random() * (max-min+1) + min);
}

function clampCounts(startCount, middleCount, endCount, totalRowsInRange) {
    // Enforce MAXIMUM_BATCH_SIZE
    if (startCount > MAXIMUM_BATCH_SIZE) startCount = MAXIMUM_BATCH_SIZE;
    if (middleCount > MAXIMUM_BATCH_SIZE) startCount = MAXIMUM_BATCH_SIZE;
    if (endCount > MAXIMUM_BATCH_SIZE) startCount = MAXIMUM_BATCH_SIZE;

    if ((startCount + middleCount + endCount) > totalRowsInRange) {
        // Prioritise reducing middleCount to make it fit
        middleCount = (totalRowsInRange - startCount - endCount);
        if(middleCount < 0) {
            // That wasn't enough to prevent the overflow, so force the issue

            // Clamp the start/end counts to the maximum, as a start
            startCount = Math.floor(totalRowsInRange/2);
            middleCount = 0;
            endCount = totalRowsInRange - startCount;
        }
    }

    return [startCount, middleCount, endCount];
}

function pickUniqueSortedIndexesInRange(start, end, count) {
    // Generate middleCount array indexes, in ascending order of index, without repeats

    // How many "segments" to pick one element each from are there? Count is
    // always at least (end-start+1) so this will always be at elast 1.
    let indexes = Array();
    let segmentSize = (end-start+1) / count;
    for(let i = 0; i < count; i++) {
        // Pick one element from each segment of the input range.
        const firstOfSegment = start + Math.floor(i*segmentSize);
        const lastOfSegment = start + Math.floor((i+1)*segmentSize)-1;
        const index = randInRange(firstOfSegment, lastOfSegment);
        // They will intrinsically be in order.
        indexes.push(index);
    }
    return indexes;
}

// Returns a suggested range containing just the data, given (optional) header
// and footer ranges. If neither are specified, it will take all of the first
// sheet except the top row. If the header range is specified, it will take all
// the rows below that range (including only the columns in that range). If a
// footer range is also specified, it will stop the data range at the row above
// the footer range.
exports.SessionSuggestDataRange = (sid, headerRange, footerRange) => {
    assert(sessionStore.has(sid));
    const dimensions = getDimensions(sid);
    if(headerRange) {
        const sheetName = headerRange.sheet;
        const sheetDimensions = dimensions.sheetDimensions.get(sheetName);
        if(footerRange) {
            // FIXME: Ensure footer is in same sheet as header, and is below the
            // header.  Not sure how fussy we need to be about the columns in
            // the footer. Perhaps they should at least overlap the columns in
            // the header.

            // Header and footer, so just go from the row below the header to the row above the footer
            return {
                sheet: sheetName,
                start: {
                    row: headerRange.start.row+1,
                    column: headerRange.start.column
                },
                end: {
                    row: footerRange.start.row-1,
                    column: headerRange.end.column
                }
            };
        } else {
            // Header, but no footer, so just go from the row below the header to the end
            return {
                sheet: sheetName,
                start: {
                    row: headerRange.start.row+1,
                    column: headerRange.start.column
                },
                end: {
                    row: sheetDimensions.rows-1,
                    column: headerRange.end.column
                }
            };
        }
    } else {
        // No header range specified, so take all but the first row of the first sheet
        const sheetName = sessionStore.get(sid).sheetNames[0]; // Find the first sheet
        const sheetDimensions = dimensions.sheetDimensions.get(sheetName);
        return {
            sheet: sheetName,
            start: {
                row: 1,
                column: 0
            },
            end: {
                row: sheetDimensions.rows-1,
                column: sheetDimensions.columns - 1
            }
        };
    }
}

// Take a slice from an array, but if the array isn't long enough to reach to
// end, append undefineds to make the result the correct length.
function sliceAndPad(row, start, end) {
    // Slice row; but this may result in fewer elements than we want if the row
    // wasn't that long to begin with
    const sliced = row.slice(start, end);
    const wantedLength = end-start;

    if (sliced.length < wantedLength) {
        let padding = new Array(wantedLength-sliced.length);
        padding.fill(undefined);
        const padded = sliced.concat(padding);
        return padded;
    } else {
        return sliced;
    }
}

function sliceAndPadRows(rows, start, end) {
    const slicedAndPaddedRows = rows.map((row) => sliceAndPad(row, start, end));
    return slicedAndPaddedRows;
}

// Convert a sheet.js cell object to a string for display in an input sample
function cellToSample(c) {
    if(c)
        return c.w;
    else
        return undefined;
}

function cellsToSamples(row) {
    return row.map(cellToSample);
}

// Returns a sample of rows in a range. range is of the form {sheet: 'Foo', start:{row: X, column: Y}, end:{row: X, column: Y}}.

// Returns three arrays - one with startCount rows from the top of the range,
// one with a random selectino of middleCount rows from the middle, and another
// with endCount rows from the bottom of the range.

// This function reserves the right to return fewer than requested rows.
exports.SessionGetInputSampleRows = (sid, range, startCount, middleCount, endCount) => {
    assert(sessionStore.has(sid));
    assert(sessionStore.get(sid).wb.Sheets[range.sheet]);
    assert(range.end.row >= range.start.row);
    assert(range.end.column >= range.start.column);
    // If the caller asked for more rows than we have, or if the start/middle/end would overlap, clamp the counts
    const totalRowsInRange = (range.end.row - range.start.row + 1);
    [startCount, middleCount, endCount] = clampCounts(startCount, middleCount, endCount, totalRowsInRange);

    let data = sessionStore.get(sid).wb.Sheets[range.sheet]["!data"];

    // Extract initial rows
    let startRows = sliceAndPadRows(data.slice(range.start.row, range.start.row+startCount),
                                    range.start.column, range.end.column+1);

    // Extract random sample of middle rows
    let middleStart = range.start.row + startCount; // First row eligible for middle sample
    let middleEnd = range.end.row - endCount; // Last row eligible for middle sample
    let sortedMiddleIndexes = pickUniqueSortedIndexesInRange(middleStart, middleEnd, middleCount);

    // Extract the rows with those indexes
    let middleRows = new Array();
    for(let i=0; i<sortedMiddleIndexes.length; i++) {
        middleRows.push(sliceAndPad(data[sortedMiddleIndexes[i]], range.start.column, range.end.column+1));
    }

    // Extract final rows
    let endRows = sliceAndPadRows(data.slice(range.end.row-endCount+1, range.end.row+1),
                                  range.start.column, range.end.column+1);

    // FIXME: Work out how the xlsx library represents styles and
    // rowspan/colspan and make sure that what we return does something useful
    // with that information. We DO want styling information to be available in
    // the preview, so that users can see their spreadsheet in a more familiar
    // form, and because styling information might be a significant part of the
    // data.

    return [startRows.map(cellsToSamples),
            middleRows.map(cellsToSamples),
            endRows.map(cellsToSamples)];
};

// Return the unique values in each column in the range. Return no more than
// maxValues values for any given column. Return format is an array, one entry
// per column, whose entries have a .values property that's an array of values
// and a .hasMore property that's a boolean set if the values array was
// truncated to maxValues.
exports.SessionGetInputValues = (sid, range, maxValues) => {
    assert(sessionStore.get(sid));
    assert(sessionStore.get(sid).wb.Sheets[range.sheet]);
    assert(range.end.row >= range.start.row);
    assert(range.end.column >= range.start.column);

    let data = sessionStore.get(sid).wb.Sheets[range.sheet]["!data"];

    let result = new Array(range.end.column - range.start.column + 1);
    let resultIdx = 0;

    for(let col = range.start.column; col <= range.end.column; col++) {
        let values = new Set();
        let hasMore = false;

        for(let row = range.start.row; row <= range.end.row; row++) {
            let value = cellToSample(data[row][col]);

            if (values.size < maxValues) {
                // There's room for more, keep shovelling them in
                values.add(value);
            } else {
                // It's full - but is this a NEW value?
                if (!values.has(value)) {
                    // Yes, it's a new value, so set the "hasMore" flag and stop iterating down the column
                    hasMore = true;
                    break;
                }
            }
        }

        // Convert the result to a sorted array, for neatness and consistency
        result[resultIdx] = { values: Array.from(values.values()).sort(),
                              hasMore: hasMore };
        resultIdx++;
    }

    return result;
}

exports.SessionDelete = (sid) => {
    assert(sessionStore.get(sid));
    sessionStore.get(sid).jobs.forEach((jid) => {
        jobStore.delete(jid);
    });
    sessionStore.delete(sid);
}

class JobResult {
    constructor(records, errors, warnings) {
        this.records = records;
        this.errors = errors;
        this.warnings = warnings;
    }
}

function validateMapping(range, mapping) {
    const columnsInRange = range.end.column - range.start.column + 1;

    // For now, mappings are just integer column indexes

    assert(mapping.attributeMappings);

    for(const [attribute, attrSource] of Object.entries(mapping.attributeMappings)) {
        assert(Number.isInteger(attrSource));
        assert(attrSource >= 0);
        assert(attrSource < columnsInRange);
    }
}

function mapCellValue(cell) {
    // FIXME: Be aware of the destination type, and of any other mapping operations configured by the user
    return cell.v;
}

exports.SessionPerformMappingJob = (sid, range, mapping) => {
    assert(sessionStore.get(sid));
    assert(sessionStore.get(sid).wb.Sheets[range.sheet]);
    assert(range.end.row >= range.start.row);
    assert(range.end.column >= range.start.column);

    validateMapping(range, mapping);

    let records = new Array(); // Array of output records
    let errors = new Map(); // Maps input row number to list of errors
    let warnings = new Map(); // Maps input row number to list of warnings

    let data = sessionStore.get(sid).wb.Sheets[range.sheet]["!data"];
    let attrMap = Object.entries(mapping.attributeMappings);

    for(let rowIdx=range.start.row; rowIdx <= range.end.row; rowIdx++) {
        let row = data[rowIdx];
        let record = {};
        let foundSomeValues = false;
        let rowWarnings = [];
        let rowErrors = [];
        if (row) {
            attrMap.forEach((element) => {
                const [attr, m] = element;
                // For now, attribute mappings are just integer column offsets
                const inputColumn = range.start.column + m;
                if (inputColumn >= row.length) {
                    // If a row is missing values at the end, this may be
                    // represented as a "short" row array.
                    record[attr] = undefined;
                } else {
                    record[attr] = mapCellValue(row[range.start.column + m]);
                    foundSomeValues = true;
                }
            });
        }

        if (foundSomeValues) {
            records.push(record);
        } else {
            rowWarnings.push("Row is blank");
        }

        if(rowWarnings.length > 0) {
            warnings.set(rowIdx, rowWarnings);
        }
        if(rowErrors.length > 0) {
            errors.set(rowIdx, rowErrors);
        }
    }

    let jid = makeAccessToken("j");
    let job = new JobResult(records, errors, warnings);
    jobStore.set(jid, job);
    sessionStore.get(sid).jobs.add(jid);
    return jid;
}

///
/// Job Interface
///

// Returns number of records, number of rows with errors, number of rows with warnings
exports.JobGetSummary = (jid) => {
    assert(jobStore.has(jid));
    job = jobStore.get(jid);

    return {
        recordCount: job.records.length,
        errorCount: job.errors.size,
        warningCount: job.warnings.size
    };
};

exports.JobGetWarnings = (jid) => {
    assert(jobStore.has(jid));
    job = jobStore.get(jid);

    return job.warnings;
}

exports.JobGetErrors = (jid) => {
    assert(jobStore.has(jid));
    job = jobStore.get(jid);

    return job.errors;
}

exports.JobGetSampleRecords = (jid, startCount, middleCount, endCount) => {
    assert(jobStore.has(jid));

    let records = jobStore.get(jid).records;

    // If the caller asked for more rows than we have, or if the start/middle/end would overlap, clamp the counts
    const totalRowsInRange = records.length;
    [startCount, middleCount, endCount] = clampCounts(startCount, middleCount, endCount, totalRowsInRange);

    // Extract initial records
    let startRecords = records.slice(0, startCount);

    // Extract random sample of middle records
    let middleStart = startCount; // First record eligible for middle sample
    let middleEnd = records.length - endCount - 1; // Last record eligible for middle sample
    let sortedMiddleIndexes = pickUniqueSortedIndexesInRange(middleStart, middleEnd, middleCount);

    // Extract the records with those indexes
    let middleRecords = new Array();
    for(let i=0; i<sortedMiddleIndexes.length; i++) {
        middleRecords.push(records[sortedMiddleIndexes[i]]);
    }

    // Extract final records
    let endRecords = records.slice(records.length-endCount, records.length);

    return [startRecords,
            middleRecords,
            endRecords];
}

exports.JobGetRecords = (jid, start, count) => {
    assert(jobStore.has(jid));

    const allRecords = jobStore.get(jid).records;

    // Clamp start,count to range
    if(start < 0) start = 0;
    if(start >= allRecords.length) start = allRecords.length-1;
    if(start+count > allRecords.length) count = allRecords.length - start;

    if(count > MAXIMUM_BATCH_SIZE) count = MAXIMUM_BATCH_SIZE;
    const desiredRecords = allRecords.slice(start, start+count);
    return desiredRecords;
}

exports.JobDelete = (sid, jid) => {
    assert(sessionStore.has(sid));
    assert(jobStore.has(jid));

    jobStore.delete(jid);
    sessionStore.get(sid).jobs.delete(jid);
}
