const multer = require("multer");
const conf = require("./config.js");
const fs = require("node:fs");
const path = require("node:path");
const session_lib = require("./session.js");
const sheets_lib = require("./sheets.js");
const tpl_functions = require("./functions.js")
const tpl_filters = require("./filters.js")

const IMPORTER_SESSION_KEY = "importer.session";
const IMPORTER_ERROR_KEY = "importer.error";
const IMPORTER_ERROR_DATA_KEY = "importer.error.postdata";
const IMPORTER_ERROR_EXTRA_KEY = "importer.error.extra";

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
    delete request.session.data[IMPORTER_ERROR_EXTRA_KEY];
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
      (next, other = null) => {
        if (next && other) {
          return `${v}?next=${encodeURIComponent(next)}&other=${encodeURIComponent(other)}`;
        }

        return `${v}?next=${encodeURIComponent(next)}`;
      },
      {},
    );
  }

  for (const [k, v] of Object.entries(tpl_functions)) {
    prototypeKit.views.addFunction(k, v)
  }

  for (const [k, v] of Object.entries(tpl_filters)) {
    prototypeKit.views.addFilter(k, v)
  }


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

        // When there is only a single sheet, and if the prototype is configured to
        // automatically progress, then this will do so if the 'other' url is
        // specified.
        if (plugin_config.sheetSelection.toLowerCase() == "automatic" && "other" in request.query) {
          const otherPage = decodeURIComponent(request.query.other)
          if (otherPage) { request.query.next = request.query.other }
        }
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

      request.session.data['reference_number'] = session.id.match(/\d+/g).join("").substring(0, 8);

      session.mapping = request.body;

      const values = new Array();

      for (const value of Object.values(session.mapping)) {
        if (value != '') {
          values.push(value)
        }
      }

      // For each key in the config that is required, we need to ensure that the field name is present
      // in the values array. If not then we will
      const required_fields = plugin_config.fields
        .filter((f) => f.required)
        .filter((f) => !values.includes(f.name))
        .map((f) => f.name)

      // If required_fields has any values left, then they are required fields not present in the
      // mapping. In which case we should return an error for the user.
      if (required_fields.length > 0) {
        request.session.data[IMPORTER_ERROR_KEY] = "The following fields are required"
        request.session.data[IMPORTER_ERROR_EXTRA_KEY] = required_fields
        request.session.data[IMPORTER_ERROR_DATA_KEY] = session.mapping
        response.redirect(request.get('Referrer'));
        return;
      } else {
        delete request.session.data[IMPORTER_ERROR_KEY]
        delete request.session.data[IMPORTER_ERROR_EXTRA_KEY]
        delete request.session.data[IMPORTER_ERROR_DATA_KEY]
      }

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
        }, 2500)

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
          plugin_config.setFields(plugin_config.fields.filter((x) => x.name != request.body.field))
        } else {
          // We don't want to add a field if it already exists (by name), and so we will
          // just return if it is already included.
          if (!plugin_config.fields.find((x) => x.name.toUpperCase() == request.body.field.toUpperCase())) {
            const t = request.body.type ?? "text"
            const r = (/true/).test(request.body.required)
            plugin_config.setFields([...plugin_config.fields, { name: request.body.field, type: t, required: r }])
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
