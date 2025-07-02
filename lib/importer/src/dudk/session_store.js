
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

    set(id, object) {
        this.store.set(id, object)
    }

    get(id) {
        return this.store.get(id)
    }

    has(id) {
        return this.store.has(id)
    }

    delete(id) {
        this.store.delete(id)
    }
}

class DiskSessionStore {
    constructor(_params) {
        this.store = new Map();
    }

    set(id, object) { }
    get(id) { }
    has(id) { }
    delete(id) { }
}
