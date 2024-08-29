//
// For guidance on how to create routes see:
// https://prototype-kit.service.gov.uk/docs/create-routes
//
const govukPrototypeKit = require("govuk-prototype-kit");
const router = govukPrototypeKit.requests.setupRouter();

const cfg = require("govuk-prototype-kit/lib/config");
const importer = require("@register-dynamics/importer");

importer.Initialise(cfg.getConfig(), router, govukPrototypeKit);
