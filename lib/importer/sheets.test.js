const session_lib = require('./session');
const sheets_lib = require('./sheets');

test('trailing columns', () => {
    const response = session_lib.CreateSession(
        {
            fields: ['field'],
            uploadPath: "../../fixtures",
        },
        {
            file: {
                mimetype: "text/csv",
                filename: "trailing-column.csv"
            }
        }
    );

    expect(response.error).toBe(undefined);
    expect(response.id).not.toBe('');

    const session = response.session
    session.sheet = "Sheet1" // It's a CSV, and this is the default sheet name
    session.headerRange = {
        sheet: session.sheet,
        start: {row: 0, column: 0},
        end: {row: 0, column: 2},
      };


    let headers = sheets_lib.GetHeader(session)
    expect(headers.length).toBe(3);
    expect(headers).toStrictEqual(['A', 'B', '[Untitled column 1]'])
});
