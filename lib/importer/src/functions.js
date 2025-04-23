
const sheets_lib = require("./sheets.js");

const IMPORTER_SESSION_KEY = "importer.session";
const IMPORTER_ERROR_KEY = "importer.error";
const IMPORTER_ERROR_EXTRA_KEY = "importer.error.extra";

//--------------------------------------------------------------------
// Allows the templates to get a list of viable sheet names, and for
// each one also obtain a preview of the data for display when selecting
// a sheet.
//--------------------------------------------------------------------
const importSheetPreview = (data) => {
    let session = data[IMPORTER_SESSION_KEY];
    return session.sheets.map((sheetName) => {
        return {
            name: sheetName,
            data: { rows: sheets_lib.GetPreview(session, sheetName) },
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
        return { text: data[IMPORTER_ERROR_KEY], extra: data[IMPORTER_ERROR_EXTRA_KEY] };
    }

    return false;
}
//--------------------------------------------------------------------
// Allows a template to obtain `count` rows from the start of the data
// range.
//--------------------------------------------------------------------
const importerGetRows = (data, start, count) => {
    const session = data[IMPORTER_SESSION_KEY];
    return sheets_lib.GetRows(session, start, count);
}

//--------------------------------------------------------------------
// Allows a template to obtain `count` rows from the end of the data
// range.
//--------------------------------------------------------------------
const importerGetTrailingRows = (data, count) => {
    const session = data[IMPORTER_SESSION_KEY];
    return sheets_lib.GetTrailingRows(session, count);
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
        const session = data[IMPORTER_SESSION_KEY];

        const sheet = (sheetName ??= session.sheet);
        const rowCount = sheets_lib.GetTotalRows(session, sheet);

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
    const session = data[IMPORTER_SESSION_KEY];
    let header_names = sheets_lib.GetHeader(session);

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
                session,
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
    const session = data[IMPORTER_SESSION_KEY];

    const mapResults = sheets_lib.MapData(session);
    const headers = session.fields;

    return {
        rows: mapResults.resultRecords,
        headers: headers,
        totalCount: mapResults.totalCount,
        extraRecordCount: mapResults.extraRecordCount,
        errorCount: mapResults.errorCount,
        warningCount: mapResults.warningCount,
        warnings: mapResults.warnings,
        errors: mapResults.errors
    };
}

//--------------------------------------------------------------------
// Helper functions that can be used on the review page to show
// information about the data that has been mapped.
//--------------------------------------------------------------------
const data_sum = (data, column) => {
    const session = data[IMPORTER_SESSION_KEY];
    const mapResults = sheets_lib.MapData(session);
    const headers = session.fields;

    const idx = headers.findIndex((x) => x.name == column)
    if (idx == -1) {
        return "No data found"
    }

    let numbers = mapResults.resultRecords
        .filter((x) => x !== undefined && x[idx] !== undefined)
        .map((x) => parseNumberFromString(x[idx]))


    return numbers.reduce((acc, i) => acc + i, 0)
}

const data_avg = (data, column) => {
    const session = data[IMPORTER_SESSION_KEY];
    const mapResults = sheets_lib.MapData(session);
    const headers = session.fields;

    const idx = headers.findIndex((x) => x.name == column)
    if (idx == -1) {
        return "No data found"
    }

    const numbers = mapResults.resultRecords
        .filter((x) => x !== undefined && x[idx] !== undefined)
        .map((x) => parseNumberFromString(x[idx]))

    const avg = numbers.reduce((acc, i) => acc + i, 0) / numbers.length
    if (Number.isNaN(avg)) {
        return "0"
    }
    return avg
}

const parseNumberFromString = (s) => {
    const parsed = s.match(/([0-9]*\.[0-9]+|[0-9]+)/)
    if (parsed == null) {
        return 0
    }

    if (parsed[0].indexOf(".") >= 0) {
        return parseFloat(parsed[0])
    }

    return parseInt(parsed[0])
}



module.exports = {
    importerError,
    importSheetPreview,
    importerGetRows,
    importerGetHeaders,
    importerGetTrailingRows,
    importerGetTableCaption,
    importerMappedData,
    data_sum,
    data_avg
}
