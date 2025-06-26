
const fs = require("node:fs")
const path = require("node:path")

const session_lib = require("./session.js");

exports.CreateSessionWithFileFixture = (plugin_config, request, filename) => {
    const sourceFile = path.join(path.resolve(process.cwd()), "../../fixtures/", filename);
    const targetFile = path.join(plugin_config.uploadPath, filename);

    fs.copyFileSync(sourceFile, targetFile);
    const fstats = fs.statSync(targetFile)

    let encoding = "utf8";
    let mimetype = "text/csv"

    if (!filename.toLowerCase().endsWith(".csv")) {
        encoding = "7bit";
        mimetype = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    }

    request.file = {
        fieldname: "file",
        originalname: filename,
        mimetype: mimetype,
        encoding: encoding,
        path: targetFile,
        size: fstats.size,
        destination: plugin_config.uploadPath,
        filename: filename
    };

    return session_lib.CreateSession(plugin_config, request)
}
