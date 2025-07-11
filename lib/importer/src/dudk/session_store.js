const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')

const SessionStoreType = {
    DISK: "disk",
    MEMORY: "inmemory",
};

exports.SessionStoreType = SessionStoreType

exports.MakeSessionStore = (impl, params) => {
    switch (impl) {
        case SessionStoreType.DISK:
            return new DiskSessionStore(params)
        case SessionStoreType.MEMORY:
        default:
            return new InMemorySessionStore(params)
    }
}

class InMemorySessionStore {
    constructor() {
        this.store = new Map();
    }

    // Apply the function f to the item behind the provided id
    // For inmemory, we don't need to get _and_ set as it's a
    // reference and will work without the persistence.
    apply(id, f) {
        f(this.get(id))
    }

    set(id, object) { this.store.set(id, object) }

    get(id) { return this.store.get(id) }

    has(id) { return this.store.has(id) }

    delete(id) { this.store.delete(id) }
}

class DiskSessionStore {
    constructor() {
        // Make a subfolder in the /tmp directory
        this.folder = fs.mkdtempSync(path.join(os.tmpdir(), "dudk-session-store"));
        if (!fs.existsSync(this.folder)) {
            fs.mkdirSync(this.folder);
        }

        // On SIGINT and SIGTERM, we want the opportunity to cleanup sessions stored on disk,
        // but as the signal handlers are not run in the context of this class instance, the
        // instance variables (like this.folder) will be unavailable and so we must wrap it
        // in a lambda capturing the current value of this.folder instead.
        process.on('SIGTERM', () => { this.cleanup(this.folder) });
        process.on('SIGINT', () => { this.cleanup(this.folder) });
    }

    // Removes all of the .json files from the specified folder.
    cleanup(folder) {
        const files = fs.readdirSync(folder)
        files.forEach(file => {
            if (file.endsWith(".json")) {
                const p = path.join(folder, file)
                fs.unlinkSync(p)
            }
        });

        // Ideally we would perhaps have a better way of giving classes an opportunity to
        // register shutdown handlers and exit the process more centrally instead, but
        // until we have that we need to shutdown the process after SIG*
        process.exit(0);
    }

    path_for_id(id) {
        return path.join(this.folder, `${id}.json`)
    }

    apply(sid, f) {
        let sess = this.get(sid)
        f(sess)
        this.set(sid, sess) // persist the changes
    }

    set(id, obj) {
        if (!Object.prototype.hasOwnProperty.call(obj, 'jobs') || !obj.jobs) {
            obj.jobs = new Map();
        }

        const toProcess = ["jobs", "warnings", "errors"]

        const mapReplacer = (key, value) => {
            if (value instanceof Map) {
                return { __instanceof__: 'Map', data: Object.fromEntries(value) };
            } else if (value instanceof Date) {
                return { __instanceof__: 'Date', data: value };
            } else if (typeof value === 'object' && value !== null && key in toProcess) {
                // Recursively process each propertoes
                for (const prop in value) {
                    if (Object.prototype.hasOwnProperty.call(value, prop)) {
                        value[prop] = mapReplacer(prop, value[prop]);
                    }
                }
            }
            return value;
        }

        // Convert the session to JSON ensuring any Maps are serialized correctly for
        // retrieval
        const data = JSON.stringify(obj, mapReplacer, 2);
        fs.writeFileSync(this.path_for_id(id), data, 'utf8');
    }

    get(id) {
        if (!this.has(id)) return null;

        const data = fs.readFileSync(this.path_for_id(id));

        function mapRestorer(key, value) {
            if (value && typeof value === 'object' && value.__instanceof__ === 'Map') {
                return new Map(Object.entries(value.data));
            }
            if (value && typeof value === 'object' && value.__instanceof__ === 'Date') {
                return new Date(value.data);
            }
            return value;
        }

        // Reload the JSOn but make sure we create any maps where they exist
        const obj = JSON.parse(data, mapRestorer)

        // Because we have gone from a map, to an object (in the json), and then back to a
        // map, the stopover in Object forced the keys to become strings. And now we
        // need to convert them back.  Now we need to iterate through each error and warning
        // adding them to a new map ... ludicrous
        obj.jobs.forEach((job) => {
            if (job.errors) {
                const newErrorsMap = new Map();
                job.errors.forEach((v, k) => { newErrorsMap.set(parseInt(k), v) })
                job.errors = newErrorsMap;
            }
            if (job.warnings) {
                const newWarningsMap = new Map();
                job.warnings.forEach((v, k) => { newWarningsMap.set(parseInt(k), v) })
                job.warnings = newWarningsMap;
            }
        })

        return obj
    }

    has(id) {
        return fs.existsSync(this.path_for_id(id))
    }

    delete(id) {
        fs.unlinkSync(this.path_for_id(id))
    }
}
