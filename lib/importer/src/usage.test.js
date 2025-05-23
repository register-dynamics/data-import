const mock_files = require('mock-fs');
var usage = require('./usage');


describe("Usage recording tests", () => {
    beforeEach(() => {
        process.env.KIT_PROJECT_DIR = "./empty/app"
    });

    afterEach(() => {
        mock_files.restore();
    });

    test('not present', () => {
        mock_files({
            './empty/usage-data-config.json': JSON.stringify({ collectUsageData: false })
        })

        const u = new usage.UsageCollection()
        expect(u).not.toBeNull()
        expect(u.recordEvent("test")).toBe(false)
    });


    test('not enabled', () => {
        mock_files({
            './empty/usage-data-config.json': JSON.stringify({ collectUsageData: false, dudkCollectUsageData: false })
        })

        const u = new usage.UsageCollection()
        expect(u).not.toBeNull()
        expect(u.recordEvent("test")).toBe(false)
    });

    test('enabled with prototype kit enabled', () => {
        mock_files({
            './empty/usage-data-config.json': JSON.stringify({ collectUsageData: true, dudkCollectUsageData: true, clientId: "1" })
        })

        const u = new usage.UsageCollection()
        expect(u).not.toBeNull()

        expect(u.recordEvent("test")).toBe(true)
        expect(u.clientId).toBe("1")
    });

    test('enabled with prototype kit disabled', () => {
        mock_files({
            './empty/usage-data-config.json': JSON.stringify({ collectUsageData: false, dudkCollectUsageData: true, clientId: "1" })
        })

        const u = new usage.UsageCollection()
        expect(u).not.toBeNull()

        expect(u.recordEvent("test")).toBe(true)
        expect(u.clientId).toBe("1")
    });

});
