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
const httplib = require('https');
const { URL } = require('url');

exports.UsageCollection = class {
    constructor() {
        const settings = prototypeKitUsageCollectionSettings()
        this.clientId = settings.clientId
        this.enabled = settings.dudkCollectUsageData
    }

    setPermission(perm) {
        this.updateDUDKPermission(perm)
        this.enabled = perm
    }

    updateDUDKPermission(dudkPermission) {
        const projectDir = path.resolve(projectDirectory() || process.cwd());
        const usage_config = path.join(projectDir, "usage-data-config.json")

        // We are running in production mode, usage tracking now enabled here.
        if (!fs.existsSync(usage_config)) {
            return
        }

        const data = fs.readFileSync(usage_config);
        const obj = JSON.parse(data)
        obj.dudkCollectUsageData = dudkPermission

        // If no clientid because the user said no to the prototype kit,
        // then we will create and save one.
        if (!('clientId' in obj)) {
            obj.clientId = crypto.randomUUID();
        }


        fs.writeFileSync(usage_config, JSON.stringify(obj))
    }



    recordEvent(eventName) {
        if (!this.enabled) return false;

        // Make the request in a block that will allow us to return
        // immediately whilst the event is recorded
        (async () => {
            const response = await this.create_event_request(eventName, this.clientId);
            if (response.error) {
                console.log("Failed to record event");
            }
        })();


        return eventName != ""
    }

    // Create a promise that will make our HTTP request for us, ensuring
    // that it will swallow any errors so that we don't interupt the operation
    // of the prototype.
    async create_event_request(eventName, clientID) {
        // Creates a path that acts as our event record. For now this is
        // just a simple path with no extra payload.
        const url = new URL(`https://union.register-dynamics.co.uk/dudk-metrics/${clientID}/${eventName}`);

        return new Promise((resolve) => {
            try {

                const options = {
                    method: "GET",
                    hostname: url.hostname,
                    path: url.pathname + url.search,
                    port: 443,
                };

                const req = httplib.request(options, (res) => {
                    res.on('end', () => {
                        resolve({
                            statusCode: res.statusCode,
                            headers: res.headers,
                        });
                    });
                });

                req.on('error', (err) => {
                    resolve({
                        error: true,
                        message: err.message,
                    });
                });

                req.end();
            } catch (err) {
                resolve({
                    error: true,
                    message: err.message,
                });
            }
        });
    }

}

// KIT_PROJECT_DIR contains the app folder, and so if it exists in prod or dev
// then we need to pop the /app off the end of the path to find the usage config.
const projectDirectory = () => {
    if (!process.env.KIT_PROJECT_DIR) return null
    const projectDir = path.resolve(process.env.KIT_PROJECT_DIR)
    return path.resolve(projectDir, '../')
}

const prototypeKitUsageCollectionSettings = () => {
    const projectDir = path.resolve(projectDirectory() || process.cwd());
    const usage_config = path.join(projectDir, "usage-data-config.json")
    if (!fs.existsSync(usage_config)) {
        return {}
    }

    const data = fs.readFileSync(usage_config);
    return JSON.parse(data)
}


