
const fs = require("node:fs")
const path = require("node:path")

const session_lib = require("./session.js");

exports.CreateSessionWithFileFixture = (plugin_config, request, filename) => {
    const sourceFile = path.join(path.resolve(process.cwd()), "../../fixtures/", filename);
    const targetFile = path.join(plugin_config.uploadPath, filename);

    fs.copyFileSync(sourceFile, targetFile);

    request.file = {
        fieldname: "file",
        originalName: filename,
        mimetype: "text/csv",
        filename: filename,
        path: targetFile,
        destination: plugin_config.uploadPath,
    };

    return session_lib.CreateSession(plugin_config, request);
}
