//
// For guidance on how to create routes see:
// https://prototype-kit.service.gov.uk/docs/create-routes
//
const govukPrototypeKit = require("govuk-prototype-kit");
const router = govukPrototypeKit.requests.setupRouter();
const path = require("path");

// Below 3 lines added by the Data Upload Design Kit plugin.
// If you uninstall the plugin, remove the 3 lines below.
const importer = require("@register-dynamics/importer");
const cfg = require("govuk-prototype-kit/lib/config");
importer.Initialise(cfg.getConfig(), router, govukPrototypeKit);

// This custom route handles file downloads from the samples folder.
// To use it, link to /download/filename.ext
// where filename.ext is the name of the file in the samples folder.
router.get("/download/:filename", function (req, res) {
    res.sendFile(req.params.filename, { root: path.join(process.cwd(), "samples") });
});
