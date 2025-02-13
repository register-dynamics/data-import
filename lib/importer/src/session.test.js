const session = require('./session');

describe("Session tests", () => {

    test('default session', () => {
        const response = session.CreateSession(
            {
                fields: ['field'],
                uploadPath: "../../fixtures",
            },
            {
                file: {
                    mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    filename: "test.xlsx"
                }
            }
        );

        expect(response.error).toBe(undefined);
        expect(response.id).not.toBe('');

        expect(response.session.filename).toEqual('../../fixtures/test.xlsx');
        expect(response.session.fields).toEqual(['field']);
    });
});
