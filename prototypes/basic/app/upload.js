const multer = require("multer");
const cfg = require("govuk-prototype-kit/lib/config");
const config = cfg.getConfig();

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

function validateUpload(file) {
  if (
    file.mimetype !=
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return "Uploaded file was not an XLSX file";
  }

  return undefined;
}

module.exports = {
  uploader,
  validateUpload,
};
