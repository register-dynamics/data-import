#!/usr/bin/env node

const fs = require("fs")
const path = require("path")

const requiredLines = [
    `const importer = require("@register-dynamics/importer");`,
    `const cfg = require("govuk-prototype-kit/lib/config");`,
    `importer.Initialise(cfg.getConfig(), router, govukPrototypeKit);\n`
]

const optionalLines = [
    `\n\n// Below ${requiredLines.length} lines added by the Data Design Kit plugin.`,
    `// If you uninstall the plugin, remove the ${requiredLines.length} lines below.`
]

const routesFilename = path.join(process.env.INIT_CWD, "app", "routes.js")
if (!fs.existsSync(routesFilename)) return

const routesFile = fs.readFileSync(routesFilename, {encoding: "utf-8"})
const looksLikePrototypeKit = routesFile.includes("govukPrototypeKit")
const containsRequiredLines = requiredLines.find(line => !routesFile.includes(line)) === undefined
if (looksLikePrototypeKit && !containsRequiredLines) {
    console.info(`Patching ${routesFilename}`)
    fs.appendFileSync(routesFilename, [...optionalLines, ...requiredLines].join("\n"))
}
