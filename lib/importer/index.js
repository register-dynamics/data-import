const multer = require("multer");
const session_lib = require("./session.js");
const sheets_lib = require("./sheets.js");

exports.Initialise = (config, router) => {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      var fs = require("fs");
      if (!fs.existsSync(config.uploadPath)) {
        fs.mkdirSync(config.uploadPath, { recursive: true });
      }

      cb(null, config.uploadPath);
    },

    filename: (req, file, cb) => {
      cb(null, file.filename + "-" + Date.now());
    },
  });

  const uploader = multer({ storage });

  //--------------------------------------------------------------------
  // Upload a file and initiate a new session
  //--------------------------------------------------------------------
  router.all("/upload", uploader.single("file"), (request, response) => {
    if (request.method == "GET") {
      response.render("upload.html");
    } else {
      let session = session_lib.CreateSession(config, request);

      if (session.error) {
        response.render("upload.html", { error: session.error });
        return;
      }

      response.redirect(`/upload/${session.id}/sheet/`);
    }
  });

  //--------------------------------------------------------------------
  // Choose a specific sheet (if more than one) in the current session
  //--------------------------------------------------------------------
  router.all("/upload/:session/sheet/", (request, response) => {
    let session = session_lib.GetSession(request.params.session);
    if (!session) {
      response.status(404);
      return;
    }

    switch (request.method) {
      case "GET":
        let sheets = sheets_lib.ListSheets(session);
        response.render("select_sheet.html", { sheets: sheets, selected: sheets[0] });
        break;
      case "POST":
        session.sheet = request.body.sheet;
        session_lib.UpdateSession(session);
        response.redirect(`/upload/${session.id}/mapping/`);
        break;
      default:
        response.send(405, "Method Not Allowed");
        break;
    }
  });

  //--------------------------------------------------------------------
  // Perform mapping of current header row to target fields
  //--------------------------------------------------------------------
  router.all("/upload/:session/mapping/", (request, response) => {
    let session = session_lib.GetSession(request.params.session);
    if (!session) {
      response.status(404);
      return;
    }

    switch (request.method) {
      case "GET":
        let header_names = sheets_lib.GetHeader(session);
        let headings = header_names.map((elem, index, _arr) => ({index: index, name: elem}))

        response.render("mapping.html", {
          sheet: session.sheet,
          fields: session.fields,
          headings: headings,
        });
        break;
      case "POST":
        session.mapping = request.body;
        session_lib.UpdateSession(session);

        response.redirect(`/upload/${session.id}/review/`);
        break;
      default:
        response.send(405, "Method Not Allowed");
        break;
    }
  });

  //--------------------------------------------------------------------
  // Review the processing for the current session before continuing
  //--------------------------------------------------------------------
  router.all("/upload/:session/review/", (request, response) => {
    let session = session_lib.GetSession(request.params.session);
    if (!session) {
      response.status(404);
      return;
    }

    switch (request.method) {
      case "GET":
        const objects = sheets_lib.MapData(session)
        const headers = Object.keys(objects[0]);

        response.render("review.html", { rows: objects, headers: session.fields });
        break;
      case "POST":
        response.redirect(`/upload/${session.id}/success/`);
        break;
      default:
        response.send(405, "Method Not Allowed");
        break;
    }
  });

  //--------------------------------------------------------------------
  // End of process page
  //--------------------------------------------------------------------
  router.get("/upload/:session/success/", (request, response) => {
    let session = session_lib.GetSession(request.params.session);
    if (!session) {
      response.status(404);
      return;
    }

    response.render("success.html", { session: session });
  });
};

exports.CreateSession = session_lib.CreateSession;
exports.GetSession = session_lib.GetSession;
exports.UpdateSession = session_lib.UpdateSession;
exports.ListSessions = session_lib.ListSessions;
