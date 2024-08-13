//
// For guidance on how to create routes see:
// https://prototype-kit.service.gov.uk/docs/create-routes
//
const upload = require("./upload.js");
const importer = require("importer");
const govukPrototypeKit = require("govuk-prototype-kit");
const router = govukPrototypeKit.requests.setupRouter();

const uploader = upload.uploader;

router.post("/upload", uploader.single("file"), (request, response) => {
  session = importer.CreateSession(request);

  if (session.error) {
    response.render("upload.html", { error: session.error });
    return;
  }

  console.log(session.id);
  console.log(importer.ListSessions());

  response.render("success.html");
});
