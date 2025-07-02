const fs = require('node:fs')
const path = require('node:path')

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
    constructor(_params) {
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
    constructor(params) {
        if (!Object.prototype.hasOwnProperty.call(params, 'folder') || params.folder.trim() == "") {
            throw new Error("folder parameter is required for Disk Session Store");
        }

        this.folder = path.join(params.folder, "data-importer-session-store")
        if (!fs.existsSync(this.folder)) {
            fs.mkdirSync(this.folder);
        }
    }

    path_for_id(id) {
        return path.join(this.folder, `${id}.json`)
    }

    apply(id, f) {
        const s = this.get(id)
        f(s)
        this.set(id, s)
    }

    set(id, obj) {
        fs.writeFileSync(this.path_for_id(id), JSON.stringify(obj, null, 2), 'utf8');
    }

    get(id) {
        if (!this.has(id)) return null;

        const data = fs.readFileSync(this.path_for_id(id));
        return JSON.parse(data)
    }

    has(id) {
        return fs.existsSync(this.path_for_id(id))
    }

    delete(id) {
        fs.unlinkSync(this.path_for_id(id))
    }
}
