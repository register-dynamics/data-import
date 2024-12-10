const path = require('node:path');


exports.getFixture = (name) => {
    return path.join(__dirname, "../../../../fixtures", name)
}