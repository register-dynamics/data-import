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
        const settings = usageCollectionSettings()
        this.disableImporterUsageData = settings.disableImporterUsageData
        this.enabled = settings.collectUsageData && !this.disableImporterUsageData
        this.clientId = settings.clientId
    }

    recordEvent(eventName) {
        if (!this.enabled) return false;

        //TODO: Actually record the usage against eventName

        return eventName != ""
    }

    // If tracking is currently enabled, ensure we explain to the user how they can
    // turn it off if they wish to do so.
    explain() {
        if (!this.enabled) return;
        if (this.disableImporterUsageData == true) return;

        const explanation = [
            "You are currently sending anonymous usage data to the prototype kit team.",
            "In addition to this, anonymous usage data is also being sent to the authors",
            "of the Data Upload Design Kit.",
            "Should you wish to disable this you can do so by adding",
            "",
            "    disableImporterUsageData: true",
            "",
            "to the usage-data-config.json file in the prototype's directory.",
            "", "",

        ]

        console.log(explanation.join('\n'));
    }
}

const usageCollectionSettings = () => {
    const projectDir = path.resolve(
        process.env.KIT_PROJECT_DIR || process.cwd(),
    );
    const usage_config = path.join(projectDir, "usage-data-config.json")
    const data = fs.readFileSync(usage_config);
    return JSON.parse(data)
}
