const multer = require("multer");
const conf = require("./config.js");
const fs = require("node:fs");
const path = require("node:path");
const session_lib = require("./session.js");
const sheets_lib = require("./sheets.js");

const IMPORTER_SESSION_KEY = "importer.session";
const IMPORTER_ERROR_KEY = "importer.error";

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
  ["importerReviewDataPath", "/importer/review"],
  ["importerSelectHeaderPath", "/importer/header_selection"],
  ["importerSelectFooterPath", "/importer/footer_selection"],
  ["importerConfiguration", "/importer/config"],
  ["importerConfigurationField", "/importer/config/field"],
  ["importerConfigurationPath", "/importer/config/path"]
]);

exports.Initialise = (config, router, prototypeKit) => {

  const developmentMode = config.isDevelopment;

  const plugin_config = new conf.PluginConfig(config);

  //--------------------------------------------------------------------
  // To be able to add a local views folder, we need to update the
  // nunjucks environment's default loader to include the local folder.
  // We can only do that with a reference to the underlying app, so
  // this middleware is used to check if the local directory is already
  // included, and add it if not.  This is enough to ensure that the
  // first request to `importerConfiguration` will be able to render
  // the template with the standard styling.
  //--------------------------------------------------------------------
  router.use("/importer", function (request, response, next) {
    ensureLocalViews(request.app);
    next()
  })

  // Add globals to the nunjucks namespace where we do not have access to the
  // nunjucks environment
  router.use("/", function (request, response, next) {
    request.app.settings.nunjucksEnv.addGlobal("isDevelopmentMode", developmentMode)
    next()
  })

  const ensureLocalViews = (app) => {
    const currentLoader = app.settings.nunjucksEnv.loaders[0]
    const localViewsDir = path.resolve(__dirname, '../views')

    // Only add the local views directory if it is not already included
    if (!currentLoader.appViews.find((element) => element == localViewsDir)) {
      currentLoader.init([...currentLoader.appViews, localViewsDir])
    }
  }


  //--------------------------------------------------------------------
  // Removes any previous importer error from the session. When we set
  // an error we redirect to the referer and we expect that page to show
  // the error. Calling this in each POST endpoint ensures that we don't
  // remember errors after they have been shown,
  //--------------------------------------------------------------------
  const cleanRequest = (request) => {
    delete request.session.data['reference_number'];
    delete request.session.data[IMPORTER_ERROR_KEY];
  };


  //--------------------------------------------------------------------
  // Make the route functions available in the templates. These functions
  // allow users to find the path that they should use to submit data,
  // and also allows them to specify which url to redirect to after
  // the POST data has been processed.
  //--------------------------------------------------------------------
  for (let [key, value] of IMPORTER_ROUTE_MAP) {
    const k = key;
    const v = value;

    prototypeKit.views.addFunction(
      k,
      (next) => {
        return `${v}?next=${encodeURIComponent(next)}`;
      },
      {},
    );
  }

  //--------------------------------------------------------------------
  // Allows the templates to get a list of viable sheet names, and for
  // each one also obtain a preview of the data for display when selecting
  // a sheet.
  //--------------------------------------------------------------------
  prototypeKit.views.addFunction(
    "importSheetPreview",
    (data) => {
      let session = data[IMPORTER_SESSION_KEY];
      return session.sheets.map((sheetName) => {
        return {
          name: sheetName,
          data: { rows: sheets_lib.GetPreview(session, sheetName) },
        };
      });
    },
    {},
  );

  //--------------------------------------------------------------------
  // Adds a function which can be called to display an error message if
  // any have been raised by the most recent post request. This allows
  // users to show errors raised at each step (where the macro supports
  // displaying it).
  //--------------------------------------------------------------------
  prototypeKit.views.addFunction(
    "importerError",
    (data) => {
      if (data[IMPORTER_ERROR_KEY]) {
        return { text: data[IMPORTER_ERROR_KEY] };
      }

      return false;
    },
    {},
  );

  //--------------------------------------------------------------------
  // Allows a template to obtain `count` rows from the start of the data
  // range.
  //--------------------------------------------------------------------
  prototypeKit.views.addFunction(
    "importerGetRows",
    (data, start, count) => {
      const session = data[IMPORTER_SESSION_KEY];
      return sheets_lib.GetRows(session, start, count);
    },
    {},
  );

  //--------------------------------------------------------------------
  // Allows a template to obtain `count` rows from the end of the data
  // range.
  //--------------------------------------------------------------------
  prototypeKit.views.addFunction(
    "importerGetTrailingRows",
    (data, count) => {
      const session = data[IMPORTER_SESSION_KEY];
      return sheets_lib.GetTrailingRows(session, count);
    },
    {},
  );

  //--------------------------------------------------------------------
  // This function generates a caption for a table given the current
  // session, the number of rows requested, and the number of rows found.
  // This is either of the form
  //     "First/Last {n} rows of {sheet}"
  // or
  //     "All {n} rows of {sheet}"
  //--------------------------------------------------------------------
  prototypeKit.views.addFunction(
    "importerGetTableCaption",
    (data, prefix, rowsAskedFor, sheetName = null) => {
      const session = data[IMPORTER_SESSION_KEY];

      const sheet = (sheetName ??= session.sheet);
      const rowCount = sheets_lib.GetTotalRows(session, sheet);

      if (rowCount > rowsAskedFor) {
        return `${prefix} ${rowsAskedFor} rows of '${sheet}'`;
      }

      return `All rows of '${sheet}'`;
    },
    {},
  );

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

    return {
      rows: mapResults.resultRecords,
      headers: headers,
      totalCount: mapResults.totalCount,
      extraRecordCount: mapResults.extraRecordCount,
      errorCount: mapResults.errorCount,
      warningCount: mapResults.warningCount,
    };
  });


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

  //--------------------------------------------------------------------
  // Helper functions that can be used on the review page to show
  // information about the data that has been mapped.
  //--------------------------------------------------------------------
  prototypeKit.views.addFunction(
    "data_sum",
    (data, column) => {
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
    },
    {},
  );

  prototypeKit.views.addFunction(
    "data_avg",
    (data, column) => {
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
    },
    {},
  );

  prototypeKit.views.addFilter('currency', function (content) {
    const num = parseInt(content)
    if (num === undefined) {
      return content
    }

    return "£" + num.toLocaleString()
  })


  //--------------------------------------------------------------------
  // Redirects the current request to the 'next' URL after decoding the
  // encoded URI.
  //--------------------------------------------------------------------
  const redirectOnwards = (request, response) => {
    response.redirect(decodeURIComponent(request.query.next));
  };

  //--------------------------------------------------------------------
  // Starts the upload process by clearing any lingering error messages
  // from the session. We can't rely on clearing _all_ of the session so
  // we are a bit more selective in what is deleted before redirecting
  // to the next step. This avoids us having to 'clear session data' each
  // time we run through the process.
  //--------------------------------------------------------------------
  router.all(
    IMPORTER_ROUTE_MAP.get("importerStartPath"),
    (request, response) => {

      cleanRequest(request);
      redirectOnwards(request, response);
    },
  );


  //--------------------------------------------------------------------
  // Uploads a file and initiates a new upload session, storing the
  // resulting object in the prototype kit request data.
  //--------------------------------------------------------------------
  const uploader = getUploader(plugin_config);

  router.post(
    IMPORTER_ROUTE_MAP.get("importerUploadPath"),
    uploader.single("file"),
    (request, response) => {
      cleanRequest(request);

      let createResponse = session_lib.CreateSession(plugin_config, request);

      if (createResponse.error) {
        request.session.data[IMPORTER_ERROR_KEY] = createResponse.error;
        response.redirect(request.get("Referrer"));
        return;
      }

      let session = createResponse.session;

      if (session.sheets.length == 1) {
        session.sheet = session.sheets[0];
      }

      // Ensure the session is persisted. Currently in session, eventually another way
      request.session.data[IMPORTER_SESSION_KEY] = session;
      redirectOnwards(request, response);
    },
  );

  //--------------------------------------------------------------------
  // When the user has chosen a sheet to use, this route stores the sheet
  // name in the session for later steps.  If no sheet name is provided
  // then an error is set and a redirect to the referrer.
  //--------------------------------------------------------------------
  router.post(
    IMPORTER_ROUTE_MAP.get("importerSelectSheetPath"),
    (request, response) => {
      let session = request.session.data[IMPORTER_SESSION_KEY];
      if (!session) {
        response.status(404);
        return;
      }

      if (!request.body.sheet || request.body.sheet == "") {
        request.session.data[IMPORTER_ERROR_KEY] =
          "Please select a sheet to continue";
        response.redirect(request.get("Referrer"));
        return;
      }

      let check = sheets_lib.GetPreview(session, request.body.sheet);
      if (check == null) {
        request.session.data[IMPORTER_ERROR_KEY] =
          "Please select a non-empty sheet";
        response.redirect(request.get("Referrer"));
        return;
      }

      session.sheet = request.body.sheet;

      // In some cases, the user will next select a header row which tells us where
      // the headers are. Sometimes, this will not be part of the flow, and so we
      // should default to the first row in the sheet.
      let maxCol = sheets_lib.GetTotalColumns(session);

      session.headerRange = {
        sheet: session.sheet,
        start: { row: 0, column: 0 },
        end: { row: 0, column: maxCol - 1 },
      };

      // Ensure the session is persisted. Currently in session, eventually another way
      request.session.data[IMPORTER_SESSION_KEY] = session;
      redirectOnwards(request, response);
    },
  );

  //--------------------------------------------------------------------
  // Allows the user to optionally select a header row
  //--------------------------------------------------------------------
  router.post(
    IMPORTER_ROUTE_MAP.get("importerSelectHeaderPath"),
    (request, response) => {
      let session = request.session.data[IMPORTER_SESSION_KEY];
      if (!session) {
        response.status(404);
        return;
      }

      // Find the selected range, or default to the first row (0,0)->(0,maxCol)
      session.headerRange = getSelectionFromRequest(
        request,
        session,
        /* optional */ false,
      );

      // Ensure the session is persisted. Currently in session, eventually another way
      request.session.data[IMPORTER_SESSION_KEY] = session;
      redirectOnwards(request, response);
    },
  );

  //--------------------------------------------------------------------
  // Allows the user to optionally select a footer row should the data
  // contain one
  //--------------------------------------------------------------------
  router.post(
    IMPORTER_ROUTE_MAP.get("importerSelectFooterPath"),
    (request, response) => {
      let session = request.session.data[IMPORTER_SESSION_KEY];
      if (!session) {
        response.status(404);
        return;
      }

      let selectionRange = getSelectionFromRequest(
        request,
        session,
        /* optional */ true,
      );
      if (!selectionRange) {
        redirectOnwards(request, response);
        return;
      }

      // We will assume we asked for the default of 10 rows, and calculate the offset
      // we need to apply to the selection range so that it is valid
      let previewRange = sheets_lib.GetRowRangeFromEnd(session, 10);
      selectionRange.start.row += previewRange.start.row - 1;
      selectionRange.end.row += previewRange.start.row - 1;

      session.footerRange = selectionRange;

      // Ensure the session is persisted. Currently in session, eventually another way
      request.session.data[IMPORTER_SESSION_KEY] = session;
      redirectOnwards(request, response);
    },
  );

  //--------------------------------------------------------------------
  // Sets the mapping that the user has selected for this session.  It
  // is expected that the mapping will be an associative array (map/dict)
  // mapping the column index to the target object field.
  //--------------------------------------------------------------------
  router.post(
    IMPORTER_ROUTE_MAP.get("importerMapDataPath"),
    (request, response) => {
      let session = request.session.data[IMPORTER_SESSION_KEY];
      if (!session) {
        response.status(404);
        return;
      }

      session.mapping = request.body;

      request.session.data['reference_number'] = session.id.match(/\d+/g).join("").substring(0, 8);

      // Ensure the session is persisted. Currently in session, eventually another way
      request.session.data[IMPORTER_SESSION_KEY] = session;
      redirectOnwards(request, response);
    },
  );

  //--------------------------------------------------------------------
  // Configuration management routes.
  //--------------------------------------------------------------------

  if (developmentMode) {
    // Render the config page
    router.get(
      IMPORTER_ROUTE_MAP.get("importerConfiguration"),
      (request, response) => {
        const pc = {
          config: {
            fields: plugin_config.fields
          }
        }

        // Copy flash message to template object and then remove from memory
        if (request.session.data['internal-message']) {
          pc.message = request.session.data['internal-message']
          request.session.data['internal-message'] = null
        }

        // This is a bit of a hacky way to render the error in the GET counterpart to a
        // previous POST request at this URL.
        if (request.session.data['internal-error']) {
          pc.error_summary = request.session.data['internal-error'].summary
          pc.error = request.session.data['internal-error'].error
          request.session.data['internal-error'] = null
        }

        response.status(200)
        response.render("plugin_config.html", pc)
      }
    );


    router.post(
      IMPORTER_ROUTE_MAP.get("importerConfiguration"),
      (request, response) => {
        request.session.data['internal-message'] = "Configuration changes have been saved, and the application will restart shortly"

        setTimeout(function () {
          plugin_config.persistConfig()
        }, 5000)

        response.redirect(IMPORTER_ROUTE_MAP.get("importerConfiguration"))
      }
    );

    router.post(
      IMPORTER_ROUTE_MAP.get("importerConfigurationPath"),
      (request, response) => {
        let newPath = request.body.uploadPath

        if (newPath && !fs.existsSync(newPath)) {
          request.session.data['internal-error'] = {
            summary: "Directory does not exist",
            error: "The specified path does not exist on the computer where the prototype kit is executing. Please choose another path or set to empty for the default value. The plugin will not operate until this error is corrected",
            parameter: newPath
          }
          response.redirect(IMPORTER_ROUTE_MAP.get("importerConfiguration"))
          return
        }

        response.redirect(IMPORTER_ROUTE_MAP.get("importerConfiguration"))
      }
    )

    // Render the add a field page
    router.get(
      IMPORTER_ROUTE_MAP.get("importerConfigurationField"),
      (request, response) => {
        render_add_field(response)
      }
    );

    // Add or delete a field based on the action supplied by the form
    router.post(
      IMPORTER_ROUTE_MAP.get("importerConfigurationField"),
      (request, response) => {
        if (!request.body.field) {
          render_add_field(response, "Missing value", "You must provide a name for the field using only alphanumeric characters or whitespace")
          return
        }

        if (request.body.action == "delete") {
          plugin_config.setFields(plugin_config.fields.filter((x) => x != request.body.field))
        } else {
          // We don't want to add a field if it already exists (by name), and so we will
          // just return if it is already included.
          if (!plugin_config.fields.find((x) => x.name.toUpperCase() == request.body.field.toUpperCase())) {
            plugin_config.setFields([...plugin_config.fields, { name: request.body.field, type: "string", required: false }])
          }
        }

        response.redirect(IMPORTER_ROUTE_MAP.get("importerConfiguration"));
      }
    );
  } else {
    // Disable all handling for configuration pages when not in development mode
    router.all(
      IMPORTER_ROUTE_MAP.get("importerConfiguration"),
      (request, response) => {
        response.status(200)
        response.render("plugin_config_disabled.html")
      })
  }


  function render_add_field(res, summary, error) {
    if (summary) {
      res.status(400)
      res.render("plugin_config_add_field.html", { error: error, error_summary: summary })
    } else {
      res.status(200)
      res.render("plugin_config_add_field.html")
    }
  }


  //--------------------------------------------------------------------
  // Review the processing for the current session before continuing.
  // Currently this just checks the session exists and then redirects to
  // the provided next URL, but in future may contain more functionality
  // around handling any errors in data extraction.
  //--------------------------------------------------------------------
  router.all(
    IMPORTER_ROUTE_MAP.get("importerReviewDataPath"),
    (request, response) => {
      let session = request.session.data[IMPORTER_SESSION_KEY];
      if (!session) {
        response.status(404);
        return;
      }

      redirectOnwards(request, response);
    },
  );
};

const getUploader = (plugin_config) => {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, plugin_config.uploadPath);
    },

    filename: (req, file, cb) => {
      cb(null, file.filename + "-" + Date.now());
    },
  });

  return multer({ storage });
};

exports.CreateSession = session_lib.CreateSession;
exports.GetSession = session_lib.GetSession;
exports.UpdateSession = session_lib.UpdateSession;
exports.ListSessions = session_lib.ListSessions;

//--------------------------------------------------------------------
// Parse the given key into an int if it is truthy, or returns the
// default value (whose default is 0)
//--------------------------------------------------------------------
const getIntOrDefault = (key, dflt = 0) => {
  if (key) {
    return parseInt(key);
  }
  return dflt;
};

// Given a POST request from the client, we will look for the cell range for
// any potential selection. If we are not-optional, it will return a range
// (which might be the default). If we are optional but can't find values
// then we will return no range.
const getSelectionFromRequest = (request, session, optional = false) => {
  let defaultVal = optional ? -1 : 0;
  let defaultMaxCol = optional ? -1 : sheets_lib.GetTotalColumns(session);

  let tlRow = getIntOrDefault(
    request.body["importer:selection:TLRow"],
    defaultVal,
  );
  let tlCol = getIntOrDefault(
    request.body["importer:selection:TLCol"],
    defaultVal,
  );
  let brRow = getIntOrDefault(
    request.body["importer:selection:BRRow"],
    defaultVal,
  );
  let brCol = getIntOrDefault(
    request.body["importer:selection:BRCol"],
    defaultMaxCol,
  );

  // If optional is set to true and we don't have any valid values, we will bail
  // early
  if (
    optional &&
    [tlRow, tlCol, brRow, brCol].filter((x) => x >= 0).length < 4
  ) {
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
    start: { row: tlRow, column: tlCol },
    end: { row: brRow, column: brCol },
  };
};
