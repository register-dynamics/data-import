const multer = require("multer");
const session = require("./session.js");

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

  router.post("/upload", uploader.single("file"), (request, response) => {
    s = session.CreateSession(request);

    if (s.error) {
      response.render("upload.html", { error: s.error });
      return;
    }

    response.render("success.html");
  });
};

exports.CreateSession = session.CreateSession;
exports.ListSessions = session.ListSessions;
