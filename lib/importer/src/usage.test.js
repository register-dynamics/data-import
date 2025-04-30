const mock_files = require('mock-fs');
var usage = require('./usage');


describe("Usage recording tests", () => {
    beforeEach(() => {
        process.env.KIT_PROJECT_DIR = "./empty"
    });

    afterEach(() => {
        mock_files.restore();
    });

    test('not enabled', () => {
        mock_files({
            './empty/usage-data-config.json': JSON.stringify({ collectUsageData: false })
        })

        const u = new usage.UsageCollection()
        expect(u).not.toBeNull()
        expect(u.recordEvent("test")).toBe(false)
    });

    test('enabled', () => {
        mock_files({
            './empty/usage-data-config.json': JSON.stringify({ collectUsageData: true, clientId: "1" })
        })

        const u = new usage.UsageCollection()
        expect(u).not.toBeNull()

        expect(u.recordEvent("test")).toBe(true)
        expect(u.clientId).toBe("1")
    });

    test('enabled and importer not disabled explicitly', () => {
        mock_files({
            './empty/usage-data-config.json': JSON.stringify({ collectUsageData: true, clientId: "1", disableImporterUsageData: false })
        })

        const u = new usage.UsageCollection()
        expect(u).not.toBeNull()

        expect(u.recordEvent("test")).toBe(true)
        expect(u.clientId).toBe("1")
    });

    test('enabled but importer disabled', () => {
        mock_files({
            './empty/usage-data-config.json': JSON.stringify({ collectUsageData: true, clientId: "1", disableImporterUsageData: true })
        })

        const u = new usage.UsageCollection()
        expect(u).not.toBeNull()

        expect(u.recordEvent("test")).toBe(false)
    });
});
