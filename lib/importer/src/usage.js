//--------------------------------------------------------------------
// This class handles the recording of usage data where the user
// has enabled data collection for the prototype and not explicitly
// disabled it for the plugin.
//
// Once constructed the class can be used to `recordEvent` but
// will check it is enabled before doing anything to ensure the
// user's preferences are respected and correctly applied.
//--------------------------------------------------------------------


const fs = require('node:fs');
const path = require('node:path');


exports.UsageCollection = class {
    constructor() {
        const settings = prototypeKitUsageCollectionSettings()
        this.clientId = settings.clientId
        this.enabled = settings.ddukCollectUsageData
    }

    setPermission(perm) {
        updateDDUKPermission(perm)
        this.enabled = perm
    }

    recordEvent(eventName) {
        if (!this.enabled) return false;

        //TODO: Actually record the usage against eventName
        console.log("EVENT: " + eventName)
        return eventName != ""
    }
}

const prototypeKitUsageCollectionSettings = () => {
    const projectDir = path.resolve(
        process.env.KIT_PROJECT_DIR || process.cwd(),
    );
    const usage_config = path.join(projectDir, "usage-data-config.json")
    const data = fs.readFileSync(usage_config);
    return JSON.parse(data)
}

const updateDDUKPermission = (ddukPermission) => {
    const projectDir = path.resolve(
        process.env.KIT_PROJECT_DIR || process.cwd(),
    );
    const usage_config = path.join(projectDir, "usage-data-config.json")
    const data = fs.readFileSync(usage_config);

    const obj = JSON.parse(data)
    obj.ddukCollectUsageData = ddukPermission

    fs.writeFileSync(usage_config, JSON.stringify(obj))
}
