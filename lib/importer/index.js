const multer = require("multer");
const session_lib = require("./session.js");
const sheets_lib = require("./sheets.js");

const fs = require("fs");
const path = require('node:path');
const os = require('node:os');


const IMPORTER_SESSION_KEY = "importer.session"
const IMPORTER_ERROR_KEY = "importer.error"

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
  ["importerSelectHeaderPath", "/importer/header_selection"]
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
  const cleanRequest = (request) => {
    delete request.session.data[IMPORTER_ERROR_KEY]
  }

  //--------------------------------------------------------------------
  // Make the route functions available in the templates. These functions
  // allow users to find the path that they should use to submit data,
  // and also allows them to specify which url to redirect to after
  // the POST data has been processed.
  //--------------------------------------------------------------------
  for ([key, value] of IMPORTER_ROUTE_MAP) {
    const k = key;
    const v = value;

    prototypeKit.views.addFunction(k, (next)=>{
      return `${v}?next=${encodeURIComponent(next)}`;
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

  prototypeKit.views.addFunction("importerGetRows", (data, start, count) => {
    const session = data[IMPORTER_SESSION_KEY];
    return sheets_lib.GetRows(session, start, count)
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

    if (!header_names || header_names.length == 0) {
      response.error = {text: "Unable to detect header rows"}
    } else {
      response.data = header_names.map((elem, index, _arr) => {
        let examples = sheets_lib.GetColumnValues(session, index, cellWidth=20, count=5).inputValues
        let exampleString = examples.join(", ").trim().slice(0, -1);

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
  const redirectOnwards = (request, response) => {
    response.redirect(decodeURIComponent(request.query.next));
  }

  //--------------------------------------------------------------------
  // Starts the upload process by clearing any lingering error messages
  // from the session. We can't rely on clearing _all_ of the session so
  // we are a bit more selective in what is deleted before redirecting
  // to the next step. This avoids us having to 'clear session data' each
  // time we run through the process.
  //--------------------------------------------------------------------
  router.all(IMPORTER_ROUTE_MAP.get("importerStartPath"),(request, response) => {
    cleanRequest(request);
    redirectOnwards(request, response);
  });

  //--------------------------------------------------------------------
  // Uploads a file and initiates a new upload session, storing the
  // resulting object in the prototype kit request data.
  //--------------------------------------------------------------------
  const uploader = getUploader(config);

  router.post(IMPORTER_ROUTE_MAP.get("importerUploadPath"), uploader.single("file"), (request, response) => {
      cleanRequest(request);

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
    // We should probably find a better way of handling no selection, and we still
    // need to decide how users can decide between auto-choose header and user-chosen
    // headers.
    let tlRow = request.body['importer:selection:TLRow'] ?? 0;
    let tlCol = request.body['importer:selection:TLCol'] ?? 0;
    let brRow = request.body['importer:selection:BRRow'] ?? 0;
    let brCol = request.body['importer:selection:BRCol'] ?? maxCol;

    session.headerRange = {
      sheet: session.sheet,
      start: {row: parseInt(tlRow), column: parseInt(tlCol)},
      end: {row: parseInt(brRow), column: parseInt(brCol)},
    };

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
