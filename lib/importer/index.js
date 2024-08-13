const multer = require("multer");
const session_lib = require("./session.js");

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
      let session = session_lib.CreateSession(request);

      if (session.error) {
        response.render("upload.html", { error: session.error });
        return;
      }

      response.redirect(`/upload/${session.id}/select/sheet/`);
    }
  });

  //--------------------------------------------------------------------
  // Choose a specific sheet (if more than one) in the current session
  //--------------------------------------------------------------------
  router.all("/upload/:session/select/sheet/", (request, response) => {
    let session = session_lib.GetSession(request.params.session);
    if (!session) {
      response.status(404);
      return;
    }

    switch (request.method) {
      case "GET":
        response.render("select_sheet.html", { error: session.error });
        break;
      case "POST":
        console.log(request.params);
        response.redirect(`/upload/${session.id}/select/header/`);
        break;
    }
  });

  //--------------------------------------------------------------------
  // Select headers for the current session
  //--------------------------------------------------------------------
  router.all("/upload/:session/select/header/", (request, response) => {
    let session = session_lib.GetSession(request.params.session);
    if (!session) {
      response.status(404);
      return;
    }

    switch (request.method) {
      case "GET":
        response.render("select_header.html", { error: session.error });
        break;
      case "POST":
        response.redirect(`/upload/${session.id}/select/footer/`);
        break;
    }
  });

  //--------------------------------------------------------------------
  // Select footers for the current session
  //--------------------------------------------------------------------
  router.all("/upload/:session/select/footer/", (request, response) => {
    let session = session_lib.GetSession(request.params.session);
    if (!session) {
      response.status(404);
      return;
    }

    switch (request.method) {
      case "GET":
        response.render("select_footer.html", { error: session.error });
        break;
      case "POST":
        response.redirect(`/upload/${session.id}/review`);
        break;
    }
  });

  //--------------------------------------------------------------------
  // Review the processing for the current session before continuing
  //--------------------------------------------------------------------
  router.get("/upload/:session/review", (request, response) => {
    let session = session_lib.GetSession(request.params.session);
    if (!session) {
      response.status(404);
      return;
    }

    response.render("review.html", { error: session.error });
  });
};

exports.CreateSession = session_lib.CreateSession;
exports.GetSession = session_lib.GetSession;
exports.UpdateSession = session_lib.UpdateSession;
exports.ListSessions = session_lib.ListSessions;
