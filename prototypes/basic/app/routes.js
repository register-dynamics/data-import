//
// For guidance on how to create routes see:
// https://prototype-kit.service.gov.uk/docs/create-routes
//
const importer = require("importer");
const govukPrototypeKit = require("govuk-prototype-kit");
const router = govukPrototypeKit.requests.setupRouter();
const cfg = require("govuk-prototype-kit/lib/config");

importer.Initialise(cfg.getConfig(), router);
