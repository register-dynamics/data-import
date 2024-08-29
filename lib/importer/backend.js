const xlsx = require("node-xlsx").default;
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
    const data = xlsx.parse(filename);
    let session = {
        filename: filename,
        data: data,
        jobs: new Set(),
        sheets: new Map(),
    }
    data.forEach((sheet) => {
        session.sheets.set(sheet.name, sheet.data);
    });
    sessionStore.set(sid, session);
};

// Returns the input file structure, as an object with a property
// "sheetDimensions" mapping sheet names to objects with "rows" and "columns"
// properties listing how many rows and columns there are.
exports.SessionGetInputDimensions = (sid) => {
    assert(sessionStore.has(sid));
    let data = sessionStore.get(sid).data;
    let sheetDimensions = new Map();
    data.forEach((sheet) => {
        sheetDimensions.set(sheet.name, {
            rows: sheet.data.length,
            columns: sheet.data.reduce(
                (maxLength, currentRow) => Math.max(maxLength, currentRow.length),
                0)
        });
    });
    return {
        sheetDimensions: sheetDimensions,
    };
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

// Returns a sample of rows in a range. range is of the form {sheet: 'Foo', start:{row: X, column: Y}, end:{row: X, column: Y}}.

// Returns three arrays - one with startCount rows from the top of the range,
// one with a random selectino of middleCount rows from the middle, and another
// with endCount rows from the bottom of the range.

// This function reserves the right to return fewer than requested rows.
exports.SessionGetInputSampleRows = (sid, range, startCount, middleCount, endCount) => {
    assert(sessionStore.has(sid));
    assert(sessionStore.get(sid).sheets.has(range.sheet));
    assert(range.end.row >= range.start.row);
    assert(range.end.column >= range.start.column);
    // If the caller asked for more rows than we have, or if the start/middle/end would overlap, clamp the counts
    const totalRowsInRange = (range.end.row - range.start.row + 1);
    [startCount, middleCount, endCount] = clampCounts(startCount, middleCount, endCount, totalRowsInRange);

    let data = sessionStore.get(sid).sheets.get(range.sheet);

    // Extract initial rows
    let startRows = data.slice(range.start.row, range.start.row+startCount);

    // Extract random sample of middle rows
    let middleStart = range.start.row + startCount; // First row eligible for middle sample
    let middleEnd = range.end.row - endCount; // Last row eligible for middle sample

    // Generate middleCount array indexes, in ascending order of index, without repeats
    let middleIndexes = new Set();

    // If the chosen value is already present, we won't increase the size of
    // the set so this loop body may execute more than middleCount
    // times. However, we don't want it to keep trying forever if it keeps
    // picking already-picked indexes, so we restrict it to 2*middleCount
    // iterations. The caller will cope if we return too few middleCount
    // rows
    let middleSearchIterations = 0;
    const middleSearchLimit = middleCount * 2;
    while(middleIndexes.size < middleCount && middleSearchIterations < middleSearchLimit) {
        middleIndexes.add(randInRange(middleStart, middleEnd));
        middleSearchIterations++;
    }
    let sortedMiddleIndexes = Array.from(middleIndexes.values()).sort();

    // Extract the rows with those indexes
    let middleRows = new Array(middleCount);
    for(let i=0; i<middleCount; i++) {
        middleRows[i] = data[sortedMiddleIndexes[i]];
    }

    // Extract final rows
    let endRows = data.slice(range.end.row-endCount+1, range.end.row+1);

    // FIXME: Work out how the xlsx library represents styles and
    // rowspan/colspan and make sure that what we return does something useful
    // with that information. We DO want styling information to be available in
    // the preview, so that users can see their spreadsheet in a more familiar
    // form, and because styling information might be a significant part of the
    // data.

    // Slice out only desired columns from these rows, and return the results
    return [startRows.map((row) => row.slice(range.start.column, range.end.column+1)),
            middleRows.map((row) => row.slice(range.start.column, range.end.column+1)),
            endRows.map((row) => row.slice(range.start.column, range.end.column+1))];
};

// Return the unique values in each column in the range. Return no more than
// maxValues values for any given column. Return format is an array, one entry
// per column, whose entries have a .values property that's an array of values
// and a .hasMore property that's a boolean set if the values array was
// truncated to maxValues.
exports.SessionGetInputValues = (sid, range, maxValues) => {
    assert(sessionStore.get(sid));
    assert(sessionStore.get(sid).sheets.has(range.sheet));
    assert(range.end.row >= range.start.row);
    assert(range.end.column >= range.start.column);

    let data = sessionStore.get(sid).sheets.get(range.sheet);
    let result = new Array(range.end.column - range.start.column + 1);
    let resultIdx = 0;

    for(let col = range.start.column; col <= range.end.column; col++) {
        let values = new Set();
        let hasMore = false;

        for(let row = range.start.row; row <= range.end.row; row++) {
            let value = data[row][col];

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

exports.SessionPerformMappingJob = (sid, range, mapping) => {
    assert(sessionStore.get(sid));
    assert(sessionStore.get(sid).sheets.has(range.sheet));
    assert(range.end.row >= range.start.row);
    assert(range.end.column >= range.start.column);

    validateMapping(range, mapping);

    let records = new Array(); // Array of output records
    let errors = new Map(); // Maps input row number to list of errors
    let warnings = new Map(); // Maps input row number to list of warnings

    let data = sessionStore.get(sid).sheets.get(range.sheet);
    let attrMap = Object.entries(mapping.attributeMappings);

    for(let rowIdx=range.start.row; rowIdx <= range.end.row; rowIdx++) {
        let row = data[rowIdx];
        let record = {};
        attrMap.forEach((element) => {
            const [attr, m] = element;
            // For now, attribute mappings are just integer column offsets
            const inputColumn = range.start.column + m;
            if (inputColumn >= row.length) {
                // If a row is missing values at the end, this may be
                // represented as a "short" row array. Let's make it null rather
                // than undefined.
                record[attr] = null;
            } else {
                record[attr] = row[range.start.column + m];
            }
        });
        records.push(record);
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

    // Generate middleCount array indexes, in ascending order of index, without repeats
    let middleIndexes = new Set();

    // If the chosen value is already present, we won't increase the size of
    // the set so this loop body may execute more than middleCount
    // times. However, we don't want it to keep trying forever if it keeps
    // picking already-picked indexes, so we restrict it to 2*middleCount
    // iterations. The caller will cope if we return too few middleCount
    // rows
    let middleSearchIterations = 0;
    const middleSearchLimit = middleCount * 2;

    while(middleIndexes.size < middleCount && middleSearchIterations < middleSearchLimit) {
        middleIndexes.add(randInRange(middleStart, middleEnd));
        middleSearchIterations++;
    }
    let sortedMiddleIndexes = Array.from(middleIndexes.values()).sort();

    // Extract the records with those indexes
    let middleRecords = new Array(middleCount);
    for(let i=0; i<middleCount; i++) {
        middleRecords[i] = records[sortedMiddleIndexes[i]];
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
