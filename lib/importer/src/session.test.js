const session_lib = require('./session');

const basic_config = {
    fields: [{ name: 'field', type: 'text', required: false }],
    uploadPath: "../../fixtures",
};

const basic_session = (filename = "test.xlsx") => {
    return {
        file: {
            mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename: filename
        }
    }
}

describe("Session tests", () => {

    test('default session', () => {
        const response = session_lib.CreateSession(
            basic_config,
            basic_session()
        );

        expect(response.error).toBe(undefined);
        expect(response.id).not.toBe('');

        expect(response.session.filename).toEqual('../../fixtures/test.xlsx');
        expect(response.session.fields).toEqual([{ name: "field", type: "text", required: false }]);
    });
});


describe("Header Row Display tests", () => {

    // NONE mode
    test('none mode with a header range available', () => {
        const s = session_lib.CreateSession(
            basic_config,
            basic_session("validation-test.csv")
        ).session;

        s.headerRange = { start: { column: 0 }, end: { column: 1 } }
        const headers = session_lib.HeaderRowDisplay(s, "None")
        expect(headers).toBeNull();
    });

    test('none mode with no header range available', () => {
        const s = session_lib.CreateSession(
            basic_config,
            basic_session("validation-test.csv")
        ).session;

        console.warn = jest.fn();

        const headers = session_lib.HeaderRowDisplay(s, "None")
        expect(headers).toBeNull();
        expect(console.warn.mock.calls[0][0]).toBe('HeaderRowDisplay: No sheet selected so finding mode from rows is not possible');
    });

    // INDEX mode
    test('index mode with no sheet specified', () => {
        const s = session_lib.CreateSession(
            basic_config,
            basic_session("validation-test.csv")
        ).session;

        console.warn = jest.fn();

        const headers = session_lib.HeaderRowDisplay(s, "index")
        expect(headers).toBeNull();
        expect(console.warn.mock.calls[0][0]).toBe('HeaderRowDisplay: No sheet selected so finding mode from rows is not possible');
    });

    test('index mode with header range available', () => {
        const s = session_lib.CreateSession(
            basic_config,
            basic_session("validation-test.csv")
        ).session;

        s.sheet = "Sheet1"
        s.headerRange = { start: { column: 0 }, end: { column: 2 } }

        const headers = session_lib.HeaderRowDisplay(s, "index")
        expect(headers).toStrictEqual(["A", "B", "C"])
    });

    test('index mode with no header range specified', () => {
        const s = session_lib.CreateSession(
            basic_config,
            basic_session("validation-test.csv")
        ).session;

        s.sheet = "Sheet1";

        const headers = session_lib.HeaderRowDisplay(s, "index")
        expect(headers).toStrictEqual(["A", "B", "C", "D", "E", "F", "G", "H", "I"])
    });
});
