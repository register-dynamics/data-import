const xlsx = require("node-xlsx").default;
const crypto = require("crypto");
const assert = require('node:assert').strict;

// An implementation of the interface described in https://struct.register-dynamics.co.uk/trac/wiki/DataImporter/API

// FIXME: State storage all in-memory for now...

let sessionStore = new Map();
let jobStore = new Map();

function makeAccessToken(kind) {
    return kind + "-" + crypto.randomBytes(16).toString("hex");
}

///
/// Control Interface
///

// Create a new import session; returns session ID (sid)
exports.CreateSession = () => {
    let sid = makeAccessToken("s");
    sessionStore[sid] = new Map();
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
        session.sheets[sheet.name] = sheet.data;
    });
    sessionStore[sid] = session;
};

// Returns the input file structure, as an object with a property
// "sheetDimensions" mapping sheet names to objects with "rows" and "columns"
// properties listing how many rows and columns there are.
exports.SessionGetInputDimensions = (sid) => {
    assert(sessionStore[sid]);
    let data = sessionStore[sid].data;
    let sheetDimensions = new Map();
    data.forEach((sheet) => {
        sheetDimensions[sheet.name] = {
            rows: sheet.data.length,
            columns: sheet.data.reduce(
                (maxLength, currentRow) => Math.max(maxLength, currentRow.length),
                0)
        };
    });
    return {
        sheetDimensions: sheetDimensions,
    };
};

function randInRange(min, max) {
    return Math.floor(Math.random() * (max-min+1) + min);
}

// Returns a sample of rows in a range. range is of the form {sheet: 'Foo', start:{row: X, column: Y}, end:{row: X, column: Y}}.

// Returns three arrays - one with startCount rows from the top of the range,
// one with a random selectino of middleCount rows from the middle, and another
// with endCount rows from the bottom of the range.

// This function reserves the right to return fewer than requested rows.
exports.SessionGetInputSampleRows = (sid, range, startCount, middleCount, endCount) => {
    assert(sessionStore[sid]);
    assert(sessionStore[sid].sheets[range.sheet]);
    assert(range.end.row >= range.start.row);
    assert(range.end.column >= range.start.column);
    // FIXME: Just clamp these, rather than asserting on them.
    assert((startCount + middleCount + endCount) <= (range.end.row - range.start.row + 1));

    let data = sessionStore[sid].sheets[range.sheet];

    // Extract initial rows
    let startRows = data.slice(range.start.row, range.start.row+startCount);

    // Extract random sample of middle rows
    let middleStart = range.start.row + startCount; // First row eligible for middle sample
    let middleEnd = range.end.row - endCount; // Last row eligible for middle sample

    // Generate middleCount array indexes, in ascending order of index, without repeats
    let middleIndexes = new Set();
    while(middleIndexes.size < middleCount) {
        // FIXME: If the chosen value is already present, we won't increase the size of
        // the set so this loop body may execute more than middleCount
        // times. The assertion on the number of rows we request being smaller
        // than the size of the range constrains it to terminate eventually,
        // however we might want to put in a limit of no more than 2*middleCount
        // iterations total; the caller should cope if we return too few
        // middleCount rows
        middleIndexes.add(randInRange(middleStart, middleEnd));
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
    assert(sessionStore[sid]);
    assert(sessionStore[sid].sheets[range.sheet]);
    assert(range.end.row >= range.start.row);
    assert(range.end.column >= range.start.column);

    let data = sessionStore[sid].sheets[range.sheet];
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
    assert(sessionStore[sid]);
    sessionStore[sid].jobs.forEach((jid) => {
        delete jobStore[jid];
    });
    delete sessionStore[sid];
}

class JobResult {
    constructor(records, errors, warnings) {
        this.records = records;
        this.errors = errors;
        this.warnings = warnings;
    }
}

exports.SessionPerformMappingJob = (sid, range, mapping) => {
    assert(sessionStore[sid]);
    assert(sessionStore[sid].sheets[range.sheet]);
    assert(range.end.row >= range.start.row);
    assert(range.end.column >= range.start.column);
    // FIXME: More asserts that the mapping makes sense

    let records = []; // Array of output records
    let errors = new Map(); // Maps input row number to list of errors
    let warnings = new Map(); // Maps input row number to list of warnings

    let data = sessionStore[sid].sheets[range.sheet];
    let attrMap = Object.entries(mapping.attributeMappings);

    for(let rowIdx=range.start.row; rowIdx <= range.end.row; rowIdx++) {
        let row = data[rowIdx];
        let record = new Map();
        attrMap.forEach((element) => {
            const [attr, m] = element;
            // For now, attribute mappings are just integer column offsets
            record[attr] = row[range.start.column + m];
        });
        records.push(record);
    }

    let jid = makeAccessToken("j");
    let job = new JobResult(records, errors, warnings);
    jobStore[jid] = job;
    sessionStore[sid].jobs.add(jid);
    return jid;
}

///
/// Job Interface
///

// Returns number of records, number of rows with errors, number of rows with warnings
exports.JobGetSummary = (jid) => {
    assert(jobStore[jid]);
    job = jobStore[jid];

    return [job.records.length, job.errors.size, job.warnings.size];
};

exports.JobGetWarnings = (jid) => {
    assert(jobStore[jid]);
    job = jobStore[jid];

    return job.warnings;
}

exports.JobGetErrors = (jid) => {
    assert(jobStore[jid]);
    job = jobStore[jid];

    return job.errors;
}

exports.JobGetSampleRecords = (jid, startCount, middleCount, endCount) => {
    assert(jobStore[jid]);

    let records = jobStore[jid].records;

    // FIXME: Just clamp these, rather than asserting on them
    assert((startCount + middleCount + endCount) <= (records.length));

    // Extract initial records
    let startRecords = records.slice(0, startCount);

    // Extract random sample of middle records
    let middleStart = startCount; // First record eligible for middle sample
    let middleEnd = records.length - endCount - 1; // Last record eligible for middle sample

    // Generate middleCount array indexes, in ascending order of index, without repeats
    let middleIndexes = new Set();
    while(middleIndexes.size < middleCount) {
        // FIXME: If the chosen value is already present, we won't increase the size of
        // the set so this loop body may execute more than middleCount
        // times. The assertion on the number of rows we request being smaller
        // than the size of the range constrains it to terminate eventually,
        // however we might want to put in a limit of no more than 2*middleCount
        // iterations total; the caller should cope if we return too few
        // middleCount rows
        middleIndexes.add(randInRange(middleStart, middleEnd));
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
    assert(jobStore[jid]);
    // FIXME: Clamp start,count to range
    // FIXME: Maybe enforce maximum count in one batch, by clamping count
    return jobStore[jid].records.slice(start, start+count);
}

exports.JobDelete = (sid, jid) => {
    assert(sessionStore[sid]);
    assert(jobStore[jid]);

    delete jobStore[jid];
    sessionStore[sid].jobs.delete(jid);
}
