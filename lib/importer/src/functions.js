
const sheets_lib = require("./dudk/sheets.js");
const session_lib = require("./session.js");

const IMPORTER_SESSION_KEY = "importer.session";
const IMPORTER_ERROR_KEY = "importer.error";
const IMPORTER_ERROR_DATA_KEY = "importer.error.postdata";
const IMPORTER_ERROR_EXTRA_KEY = "importer.error.extra";

//--------------------------------------------------------------------
// Allows the templates to get a list of viable sheet names, and for
// each one also obtain a preview of the data for display when selecting
// a sheet.
//--------------------------------------------------------------------
const importSheetPreview = (data) => {
    const session_data = data[IMPORTER_SESSION_KEY];
    const session_obj = new session_lib.Session(session_data)

    return session_obj.sheets.map((sheetName) => {
        return {
            name: sheetName,
            data: { rows: sheets_lib.GetPreview(session_obj.backendSid, sheetName) },
        };
    });
}

//--------------------------------------------------------------------
// Adds a function which can be called to display an error message if
// any have been raised by the most recent post request. This allows
// users to show errors raised at each step (where the macro supports
// displaying it).
//--------------------------------------------------------------------
const importerError = (data) => {
    if (data[IMPORTER_ERROR_KEY]) {
        return { text: data[IMPORTER_ERROR_KEY], extra: data[IMPORTER_ERROR_EXTRA_KEY], data: data[IMPORTER_ERROR_DATA_KEY] };
    }

    return false;
}

//--------------------------------------------------------------------
// When submitting a mapping and getting an error response, this
// function will allow the mapping component to select the previously
// submitted values for each field.
//--------------------------------------------------------------------
const importerErrorMappingData = (error, key) => {
    if (!error || !error.data) {
        return ""
    }

    const m = new Map(Object.entries(error.data).map(([k, v]) => [parseInt(k), v]))
    return m.get(key) || ""
}

//--------------------------------------------------------------------
// Allows a template to obtain `count` rows from the start of the data
// range.
//--------------------------------------------------------------------
const importerGetRows = (data, start, count) => {
    const session_data = data[IMPORTER_SESSION_KEY];
    const session = new session_lib.Session(session_data)
    return sheets_lib.GetRows(session.backendSid, session.sheet, start, count);
}

//--------------------------------------------------------------------
// Allows a template to obtain `count` rows from the end of the data
// range.
//--------------------------------------------------------------------
const importerGetTrailingRows = (data, count) => {
    const session_data = data[IMPORTER_SESSION_KEY];
    const session = new session_lib.Session(session_data)

    return sheets_lib.GetTrailingRows(session.backendSid, session.sheet, count);
}

//--------------------------------------------------------------------
// This function generates a caption for a table given the current
// session, the number of rows requested, and the number of rows found.
// This is either of the form
//     "First/Last {n} rows of {sheet}"
// or
//     "All {n} rows of {sheet}"
//--------------------------------------------------------------------
const importerGetTableCaption =
    (data, prefix, rowsAskedFor, sheetName = null) => {
        const session_data = data[IMPORTER_SESSION_KEY];
        const session = new session_lib.Session(session_data)

        const sheet = (sheetName ??= session.sheet);
        const rowCount = sheets_lib.GetTotalRows(session.backendSid, sheet);

        if (rowCount > rowsAskedFor) {
            return `${prefix} ${rowsAskedFor} rows of '${sheet}'`;
        }

        return `All rows of '${sheet}'`;
    }

//--------------------------------------------------------------------
// In the absence of a step to choose headers, we will instead provide
// a function that will allow the system to get the headers for the
// spreadsheet.  This is used to retrieve the first row where the
// system does not provide the 'choose headers' functionality.
//--------------------------------------------------------------------
const importerGetHeaders = (data) => {
    const session_data = data[IMPORTER_SESSION_KEY];
    const session = new session_lib.Session(session_data)

    let header_names = sheets_lib.GetHeader(session.backendSid, session.sheet);

    const response = {
        data: [],
        error: false,
    };

    // Check that there is even data to map. If we have a headerRange
    // and footerRange with the same row index, then that means there
    // is no data and so add an error and go back.
    if (session.footerRange) {
        if (session.headerRange.end.row >= session.footerRange.start.row) {
            // TODO: Showing an error may not be the correct thing here, can we catch
            // the error earlier?
            response.error = { text: "There is no data in this sheet" };
            return response;
        }
    }

    if (!header_names || header_names.length == 0) {
        response.error = { text: "Unable to detect header rows" };
    } else {
        response.data = header_names.map((elem, index) => {
            let examples = sheets_lib.GetColumnValues(
                session.backendSid,
                session.sheet,
                index,
          /* cellWidth */ 20,
          /* count */ 5,
            ).inputValues;

            let exampleString = examples.join(", ").trim();

            return {
                index: index,
                name: elem,
                examples: exampleString,
            };
        });
    }
    return response;
}

//--------------------------------------------------------------------
// Extracts the data from the spreadsheet and makes it available for
// display in a macro. This is primarily used by the review step which
// shows the output data in a table.
//--------------------------------------------------------------------
const importerMappedData = (data) => {
    const session_data = data[IMPORTER_SESSION_KEY];
    const session = new session_lib.Session(session_data)

    const mapResults = sheets_lib.MapData(session.backendSid, session.sheet, session.mapping, session.fields);
    const headers = session.fields;

    // For the prototype we need to remap the errors into a more
    // renderable format so that it is easy to pass to nunjucks
    // without encapsulating logic in the templates.

    const restructuredErrors = remapErrorStructure(mapResults.errors)
    const restructuredWarnings = remapErrorStructure(mapResults.warnings)


    return {
        rows: mapResults.resultRecords,
        headers: headers,
        totalCount: mapResults.totalCount,
        extraRecordCount: mapResults.extraRecordCount,
        errorCount: mapResults.errorCount,
        warningCount: mapResults.warningCount,
        warnings: mapResults.warnings,
        errors: mapResults.errors,
        errorsDisplay: restructuredErrors,
        warningsDisplay: restructuredWarnings
    };
}

const importerHeaderRowDisplay = (data, mode) => {
    const session_data = data[IMPORTER_SESSION_KEY];
    const session = new session_lib.Session(session_data)

    return session_lib.HeaderRowDisplay(session, mode)
}

//--------------------------------------------------------------------
// Helper functions that can be used on the review page to show
// information about the data that has been mapped.
//--------------------------------------------------------------------
const data_sum = (data, column) => {
    const session_data = data[IMPORTER_SESSION_KEY];
    const session = new session_lib.Session(session_data)

    const mapResults = sheets_lib.MapData(session.backendSid, session.sheet, session.mapping, session.fields);
    const headers = session.fields;

    const idx = headers.findIndex((x) => x.name == column)
    if (idx == -1) {
        return { value: "No data found" }
    }

    let numbers = mapResults.resultRecords
        .filter((x) => x !== undefined && x[idx] !== undefined)
        .map((x) => parseNumberFromString(x[idx]))


    return { value: numbers.reduce((acc, i) => acc + i, 0), count: numbers.length }
}

const data_avg = (data, column) => {
    const session_data = data[IMPORTER_SESSION_KEY];
    const session = new session_lib.Session(session_data)

    const mapResults = sheets_lib.MapData(session.backendSid, session.sheet, session.mapping, session.fields);
    const headers = session.fields;

    const idx = headers.findIndex((x) => x.name == column)
    if (idx == -1) {
        return { value: "No data found" }
    }

    const numbers = mapResults.resultRecords
        .filter((x) => x !== undefined && x[idx] !== undefined)
        .map((x) => parseNumberFromString(x[idx]))


    const avg = numbers.reduce((acc, i) => acc + i, 0) / numbers.length
    if (Number.isNaN(avg)) {
        return { value: "0", count: 0 }
    }
    return { value: avg, count: numbers.length }
}

const parseNumberFromString = (s) => {
    if (typeof s == "number") {
        return s
    }
    if (s === undefined || s == null) return null;

    const parsed = s.match(/([0-9]*\.[0-9]+|[0-9]+)/)
    if (parsed == null) {
        return 0
    }

    if (parsed[0].indexOf(".") >= 0) {
        return parseFloat(parsed[0])
    }

    return parseInt(parsed[0])
}

// Remaps the errors/warnings structure from
// [
//  { row: 1, field: "A", message: "An error occurred" }
//  { row: 1, field: "B", message: "An error occurred" }
//  { row: 2, field: "B", message: "An error occurred" }
// ]
// to
// [
//  { field: "A", message: "An error occurred", rows: [1] }
//  { field: "B", message: "An error occurred", rows: [1, 2] }
// ]
// In the first structure, the row field represents the index
// in the row_data array, while in the second structure
// the rows field is an array of row numbers where the error occurred.
const remapErrorStructure = (errors, row_data) => {
    const errorMap = new Map();

    for (const error of errors) {
        const key = `${error.field}-${error.message}`;
        if (!errorMap.has(key)) {
            errorMap.set(key, { field: error.field, message: error.message, rows: [] });
        }

        // If row_data is provided, use the value from row_data; otherwise, use the row index
        if (row_data && Array.isArray(row_data) && error.row < row_data.length) {

            // In addition to error.row, we also want to add error.row - 1 and error.row + 1
            // as long as they are not already in the array.  However, any future error.row
            // should ALWAYS be added to the array.
            if (error.row - 1 >= 0 && !errorMap.get(key).rows.includes(row_data[error.row - 1])) {
                errorMap.get(key).rows.push(row_data[error.row - 1]);
            }

            // Ensure we remove any existing non-error row if it is already there so we don't duplicate it
            // when adding the current row.
            if (errorMap.get(key).rows.includes(row_data[error.row])) {
                errorMap.get(key).rows = errorMap.get(key).rows.filter(r => r !== row_data[error.row]);
            }
            errorMap.get(key).rows.push(row_data[error.row]);


            if (error.row + 1 < row_data.length && !errorMap.get(key).rows.includes(row_data[error.row + 1])) {
                    errorMap.get(key).rows.push(row_data[error.row + 1]);
            }
        }
    }

    return Array.from(errorMap.values());
}


module.exports = {
    importerError,
    importerErrorMappingData,
    importSheetPreview,
    importerGetRows,
    importerGetHeaders,
    importerGetTrailingRows,
    importerGetTableCaption,
    importerMappedData,
    importerHeaderRowDisplay,
    data_sum,
    data_avg
}
