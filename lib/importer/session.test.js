const session = require('./session');

test('default session', () => {
    const response = session.CreateSession(
        {
            fields: ['field'],
            uploadPath: "testpath",
        }, 
        {
            file: {
                mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                filename: "testfile.xlsx"
            }
        }
    );

    expect(response.error).toBe(undefined);
    expect(response.id).not.toBe(''); 

    expect(response.session.filename).toEqual('testpath/testfile.xlsx'); 
    expect(response.session.fields).toEqual(['field']);
});