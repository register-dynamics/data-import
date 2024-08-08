//
// For guidance on how to create routes see:
// https://prototype-kit.service.gov.uk/docs/create-routes
//

const upload = require("./upload.js");
const govukPrototypeKit = require("govuk-prototype-kit");
const router = govukPrototypeKit.requests.setupRouter();

const uploader = upload.uploader;

router.post("/upload", uploader.single("file"), (request, response) => {
  const file = request.file;
  if (!file) {
    response.render("upload.html", { error: "Please attach a file" });
    return;
  }

  const err = upload.validateUpload(file);
  if (err != undefined) {
    response.render("upload.html", { error: err });
    return;
  }

  response.render("success.html");
});
