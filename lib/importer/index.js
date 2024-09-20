const multer = require("multer");
const session_lib = require("./session.js");
const sheets_lib = require("./sheets.js");

const fs = require("fs");
const path = require('node:path');
const os = require('node:os');


const IMPORTER_SESSION_KEY = "importer.session"
const IMPORTER_ERROR_KEY = "importer.error"
const MAPPING_ERROR_KEY = "mapping.errors"
const MAPPING_WARNING_KEY = "mapping.warnings"

//--------------------------------------------------------------------
// The endpoints used to receive POST requests from importer macros,
// and used to generate template functions that can be used to find
// the URL for each step (to be used in form actions)
//--------------------------------------------------------------------
const IMPORTER_ROUTE_MAP = new Map([
  ["importerStartPath", "/importer/start"],
  ["importerUploadPath", "/importer/upload"],
  ["importerSelectSheetPath", "/importer/sheets"],
  ["importerMapDataPath", "/importer/mapping"],
  ["importerReviewDataPath","/importer/review"],
  ["importerSelectHeaderPath", "/importer/header_selection"],
  ["importerSelectFooterPath", "/importer/footer_selection"]
]);

exports.Initialise = (config, router, prototypeKit) => {
  // Ensure config has uploadPath specified, either it's current value or
  // one created by us.
  config.uploadPath ??= path.join(os.tmpdir(), 'reg-dyn-importer'); ;


  //--------------------------------------------------------------------
  // Removes any previous importer error from the session. When we set
  // an error we redirect to the referer and we expect that page to show
  // the error. Calling this in each POST endpoint ensures that we don't
  // remember errors after they have been shown,
  //--------------------------------------------------------------------
  router.all("*", (request, res, next) => {
    delete request.session.data[IMPORTER_ERROR_KEY]
    delete request.session.data[MAPPING_ERROR_KEY]
    delete request.session.data[MAPPING_WARNING_KEY]
    next();
  });


  //--------------------------------------------------------------------
  // Make the route functions available in the templates. These functions
  // allow users to find the path that they should use to submit data,
  // and also allows them to specify which url to redirect to after
  // the POST data has been processed. Where an extra error url is provided
  // it will be used if the POST request does not succeed (e.g. when
  // mapping the data this can be used to redirect to the review page
  // to view warnings)
  //--------------------------------------------------------------------
  for ([key, value] of IMPORTER_ROUTE_MAP) {
    const k = key;
    const v = value;

    prototypeKit.views.addFunction(k, (next, errorPage=null)=>{
      let url = `${v}?next=${encodeURIComponent(next)}`;
      if (errorPage) {
        url = url + `&error=${encodeURIComponent(errorPage)}`
      }
      return url
    }, {})
  }

   //--------------------------------------------------------------------
  // Allows the templates to get a list of viable sheet names, and for
  // each one also obtain a preview of the data for display when selecting
  // a sheet.
  //--------------------------------------------------------------------
  prototypeKit.views.addFunction("importSheetPreview", (data) => {
    let session = data[IMPORTER_SESSION_KEY];
    return session.sheets.map((sheetName) => {
      return {
        name: sheetName,
        data: {rows: sheets_lib.GetPreview(session, sheetName)}
      }
    })
  }, {})

  //--------------------------------------------------------------------
  // Adds a function which can be called to display an error message if
  // any have been raised by the most recent post request. This allows
  // users to show errors raised at each step (where the macro supports
  // displaying it).
  //--------------------------------------------------------------------
  prototypeKit.views.addFunction("importerError", (data) => {
    if (data[IMPORTER_ERROR_KEY]) {
      return {text: data[IMPORTER_ERROR_KEY]};
    }

    return false;
  }, {})


  //--------------------------------------------------------------------
  // Returns warnings or errors arising from applying a mapping.
  //--------------------------------------------------------------------
  prototypeKit.views.addFunction("importerMappingErrors", (data) => {
    if (data[MAPPING_ERROR_KEY]) {
        return data[MAPPING_ERROR_KEY]
    }

    return false;
  }, {})

  prototypeKit.views.addFunction("importerMappingWarnings", (data) => {
    if (data[MAPPING_WARNING_KEY]) {
        return data[MAPPING_WARNING_KEY]
    }

    return false;
  }, {})


  //--------------------------------------------------------------------
  // Allows a template to obtain `count` rows from the start of the data
  // range.
  //--------------------------------------------------------------------
  prototypeKit.views.addFunction("importerGetRows", (data, start, count) => {
    const session = data[IMPORTER_SESSION_KEY];
    return sheets_lib.GetRows(session, start, count)
  }, {});

  //--------------------------------------------------------------------
  // Allows a template to obtain `count` rows from the end of the data
  // range.
  //--------------------------------------------------------------------
  prototypeKit.views.addFunction("importerGetTrailingRows", (data, count) => {
    const session = data[IMPORTER_SESSION_KEY];
    return sheets_lib.GetTrailingRows(session, count)
  }, {});


  //--------------------------------------------------------------------
  // In the absence of a step to choose headers, we will instead provide
  // a function that will allow the system to get the headers for the
  // spreadsheet.  This is used to retrieve the first row where the
  // system does not provide the 'choose headers' functionality.
  //--------------------------------------------------------------------
  prototypeKit.views.addFunction("importerGetHeaders", (data) => {
    const session = data[IMPORTER_SESSION_KEY];
    let header_names = sheets_lib.GetHeader(session);

    const response = {
      data: [],
      error: false
    }

    // Check that there is even data to map. If we have a headerRange
    // and footerRange with the same row index, then that means there
    // is no data and so add an error and go back.
    if (session.footerRange) {
      if (session.headerRange.end.row >= session.footerRange.start.row ) {
        // TODO: Showing an error may not be the correct thing here, can we catch
        // the error earlier?
        response.error = {text: "There is no data in this sheet"}
        return response
      }
    }


    if (!header_names || header_names.length == 0) {
      response.error = {text: "Unable to detect header rows"}
    } else {
      response.data = header_names.map((elem, index, _arr) => {

        let examples = sheets_lib.GetColumnValues(session, index, cellWidth=20, count=5).inputValues
        let exampleString = examples.join(", ").trim();

        return {
          index: index,
          name: elem,
          examples: exampleString
        }
      })
    }

    return response
  });


  //--------------------------------------------------------------------
  // Extracts the data from the spreadsheet and makes it available for
  // display in a macro. This is primarily used by the review step which
  // shows the output data in a table.
  //--------------------------------------------------------------------
  prototypeKit.views.addFunction("importerMappedData", (data) => {
    const session = data[IMPORTER_SESSION_KEY];

    const mapResults = sheets_lib.MapData(session);
    const headers = session.fields;

    return { rows: mapResults.resultRecords, headers: headers, totalCount: mapResults.totalCount, extraRecordCount: mapResults.extraRecordCount };
  });

  //--------------------------------------------------------------------
  // Redirects the current request to the 'next' URL after decoding the
  // encoded URI.
  //--------------------------------------------------------------------
  const redirectOnwards = (request, response, failed=false) => {
    console.log(request.query)
    if (failed && request.query.error) {
      response.redirect(decodeURIComponent(request.query.error));
    } else {
      response.redirect(decodeURIComponent(request.query.next));
    }
  }

  //--------------------------------------------------------------------
  // Starts the upload process by clearing any lingering error messages
  // from the session. We can't rely on clearing _all_ of the session so
  // we are a bit more selective in what is deleted before redirecting
  // to the next step. This avoids us having to 'clear session data' each
  // time we run through the process.
  //--------------------------------------------------------------------
  router.all(IMPORTER_ROUTE_MAP.get("importerStartPath"),(request, response) => {
    redirectOnwards(request, response);
  });

  //--------------------------------------------------------------------
  // Uploads a file and initiates a new upload session, storing the
  // resulting object in the prototype kit request data.
  //--------------------------------------------------------------------
  const uploader = getUploader(config);

  router.post(IMPORTER_ROUTE_MAP.get("importerUploadPath"), uploader.single("file"), (request, response) => {
      let createResponse = session_lib.CreateSession(config, request);

      if (createResponse.error) {
        request.session.data[IMPORTER_ERROR_KEY] = createResponse.error
        response.redirect(request.get('Referrer'))
        return
      }

      let session = createResponse.session;

      if(session.sheets.length == 1) {
          session.sheet = session.sheets[0];
      }

      // Ensure the session is persisted. Currently in session, eventually another way
      request.session.data[IMPORTER_SESSION_KEY] = session;
      redirectOnwards(request, response);
  });

  //--------------------------------------------------------------------
  // When the user has chosen a sheet to use, this route stores the sheet
  // name in the session for later steps.  If no sheet name is provided
  // then an error is set and a redirect to the referrer.
  //--------------------------------------------------------------------
  router.post(IMPORTER_ROUTE_MAP.get("importerSelectSheetPath"), (request, response) => {
    let session = request.session.data[IMPORTER_SESSION_KEY];
    if (!session) {
      response.status(404);
      return;
    }

    if (!request.body.sheet || request.body.sheet == "" ) {
      request.session.data[IMPORTER_ERROR_KEY] = "Please select a sheet to continue"
      response.redirect(request.get('Referrer'))
      return
    }

    let check = sheets_lib.GetPreview(session, request.body.sheet)
    if (check == null) {
      request.session.data[IMPORTER_ERROR_KEY] = "Please select a non-empty sheet"
      response.redirect(request.get('Referrer'))
      return
    }

    session.sheet = request.body.sheet;

    // In some cases, the user will next select a header row which tells us where
    // the headers are. Sometimes, this will not be part of the flow, and so we
    // should default to the first row in the sheet.
    let maxCol = sheets_lib.GetTotalColumns(session);

    session.headerRange = {
      sheet: session.sheet,
      start: {row: 0, column: 0},
      end: {row: 0, column: maxCol-1},
    };

    // Ensure the session is persisted. Currently in session, eventually another way
    request.session.data[IMPORTER_SESSION_KEY] = session;
    redirectOnwards(request, response);
  });

  //--------------------------------------------------------------------
  // Allows the user to optionally select a header row
  //--------------------------------------------------------------------
  router.post(IMPORTER_ROUTE_MAP.get("importerSelectHeaderPath"), (request, response) => {
    let session = request.session.data[IMPORTER_SESSION_KEY];
    if (!session) {
      response.status(404);
      return;
    }

    let maxCol = sheets_lib.GetTotalColumns(session);

    // Find the selected range, or default to the first row (0,0)->(0,maxCol)
    session.headerRange = getSelectionFromRequest(request, session, optional=false);

    // Ensure the session is persisted. Currently in session, eventually another way
    request.session.data[IMPORTER_SESSION_KEY] = session;
    redirectOnwards(request, response);
  });


  //--------------------------------------------------------------------
  // Allows the user to optionally select a footer row should the data
  // contain one
  //--------------------------------------------------------------------
  router.post(IMPORTER_ROUTE_MAP.get("importerSelectFooterPath"), (request, response) => {
    let session = request.session.data[IMPORTER_SESSION_KEY];
    if (!session) {
      response.status(404);
      return;
    }

    let selectionRange = getSelectionFromRequest(request, session, optional=true);
    if (!selectionRange) {
      redirectOnwards(request, response);
      return;
    }

    // We will assume we asked for the default of 10 rows, and calculate the offset
    // we need to apply to the selection range so that it is valid
    let previewRange = sheets_lib.GetRowRangeFromEnd(session, 10)
    selectionRange.start.row += previewRange.start.row -1
    selectionRange.end.row += previewRange.start.row -1

    session.footerRange = selectionRange;

    // Ensure the session is persisted. Currently in session, eventually another way
    request.session.data[IMPORTER_SESSION_KEY] = session;
    redirectOnwards(request, response);
  });

  //--------------------------------------------------------------------
  // Sets the mapping that the user has selected for this session.  It
  // is expected that the mapping will be an associative array (map/dict)
  // mapping the column index to the target object field.
  //--------------------------------------------------------------------
  router.post(IMPORTER_ROUTE_MAP.get("importerMapDataPath"), (request, response) => {
    let session = request.session.data[IMPORTER_SESSION_KEY];
    if (!session) {
      response.status(404);
      return;
    }

    session.mapping = request.body;
    if (Object.values(session.mapping).every((v) => v=='') ) {
      request.session.data[IMPORTER_ERROR_KEY] = "No columns were mapped to the expected fields"
      if (!request.query.error) {
        response.redirect(request.get('Referrer'))
      } else {
        redirectOnwards(request, response, failed=true);
      }
      return;
    }

    const mapResults = sheets_lib.MapData(session);
    if (mapResults.warningCount >= 0 || mapResults.errorCount >= 0) {
      request.session.data[MAPPING_ERROR_KEY] = ["a test error"]
      request.session.data[MAPPING_WARNING_KEY] = ["a test warning", "another warning"]

      redirectOnwards(request, response, failed=true);
      return
    }

    // Ensure the session is persisted. Currently in session, eventually another way
    request.session.data[IMPORTER_SESSION_KEY] = session;
    redirectOnwards(request, response);
  });


  //--------------------------------------------------------------------
  // Review the processing for the current session before continuing.
  // Currently this just checks the session exists and then redirects to
  // the provided next URL, but in future may contain more functionality
  // around handling any errors in data extraction.
  //--------------------------------------------------------------------
  router.all(IMPORTER_ROUTE_MAP.get("importerReviewDataPath"), (request, response) => {
    let session = request.session.data[IMPORTER_SESSION_KEY];
    if (!session) {
      response.status(404);
      return;
    }
    redirectOnwards(request, response);
  });

};

//--------------------------------------------------------------------
// Where the user has not configured an upload path in their prototype's
// config.json, we will instead create one.
//--------------------------------------------------------------------

const getUploader = (config) => {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = config.uploadPath;

      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }

      cb(null, uploadPath);
    },

    filename: (req, file, cb) => {
      cb(null, file.filename + "-" + Date.now());
    },
  });

  return multer({ storage });
}

exports.CreateSession = session_lib.CreateSession;
exports.GetSession = session_lib.GetSession;
exports.UpdateSession = session_lib.UpdateSession;
exports.ListSessions = session_lib.ListSessions;

//--------------------------------------------------------------------
// Parse the given key into an int if it is truthy, or returns the
// default value (whose default is 0)
//--------------------------------------------------------------------
const getIntOrDefault = (key, dflt=0) => {
  if (key) {
    return parseInt(key)
  }
  return dflt;
};

// Given a POST request from the client, we will look for the cell range for
// any potential selection. If we are not-optional, it will return a range
// (which might be the default). If we are optional but can't find values
// then we will return no range.
const getSelectionFromRequest = (request, session, optional=false) => {
  let defaultVal = optional ? -1 : 0;
  let defaultMaxCol = optional ? -1 : sheets_lib.GetTotalColumns(session);

  let tlRow = getIntOrDefault(request.body['importer:selection:TLRow'], defaultVal);
  let tlCol = getIntOrDefault(request.body['importer:selection:TLCol'], defaultVal);
  let brRow = getIntOrDefault(request.body['importer:selection:BRRow'], defaultVal);
  let brCol = getIntOrDefault(request.body['importer:selection:BRCol'], defaultVal);

  // If optional is set to true and we don't have any valid values, we will bail
  // early
  if (optional && [tlRow, tlCol, brRow, brCol].filter((x) => x >= 0).length < 4) {
    return null;
  }

  // Normalise the rows
  if (tlRow > brRow) {
    [tlRow, brRow] = [brRow, tlRow];
  }
  if (tlCol > brCol) {
    [tlCol, brCol] = [brCol, tlCol];
  }

  return {
    sheet: session.sheet,
    start: {row: tlRow, column: tlCol},
    end: {row: brRow, column: brCol},
  };
};