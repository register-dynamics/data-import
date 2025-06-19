const backend = require('./backend');
const sheets_lib = require('./sheets');

test('trailing columns', () => {

    const sid = backend.CreateSession()
    expect(sid).not.toBeNull();

    backend.SessionSetFile(sid, "../../fixtures/trailing-column.csv")
    backend.SessionSetHeaderRange(sid, {
        sheet: "Sheet1",
        start: { row: 0, column: 0 },
        end: { row: 0, column: 2 },
    })

    let headers = sheets_lib.GetHeader(sid, "Sheet1")
    expect(headers.length).toBe(3);
    expect(headers).toStrictEqual(['A', 'B', 'C'])
});
