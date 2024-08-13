const multer = require("multer");
const cfg = require("govuk-prototype-kit/lib/config");
const config = cfg.getConfig();

// TODO: Move this storage configuration into the importer library
// so that it is not tied to the frontend.
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

module.exports = {
  uploader,
};
