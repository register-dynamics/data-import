const fs = require('fs');
const path = require('path');

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


describe('remapErrorStructure', () => {
    test('groups errors by message, collects rows', () => {
        const errors = [
            { row: 1, field: "A", message: "Error 1" },
            { row: 1, field: "B", message: "Error 2" },
            { row: 2, field: "B", message: "Error 2" },
            { row: 3, field: "A", message: "Error 1" },
        ];
        // Adjusted expected result to match grouping by error, then by field
        const row_data = [
            {index: 1, row:[{value:"0"},{value:"1"}]},
            {index: 2, row: [{value:"2"}, {value:"3"}]}
        ];
        const result = sheets_lib.RemapErrorStructure(errors, row_data);
        expect(result).toEqual([
            {
                message: "Error 1",
                fields: [ "A"],
                rows: [
                    {index:1, row:[{value:"0"},{value:"1"}]},
                    {index:2, row:[{value:"2"}, {value:"3"}]}
                ]
            },
            {
                message: "Error 2",
                fields: ["B"],
                rows: [
                    {index:1, row: [{value:"0"},{value:"1"}]},
                    {index:2, row: [{value:"2"}, {value:"3"}]}
                ]
            }
        ]);
    });

    test('with row_data, includes adjacent rows', () => {
        const errors = [
            { row: 1, field: "A", message: "Error 1" },
            { row: 2, field: "A", message: "Error 1" },
        ];
        const row_data = [[{value:"0"},{value:"1"}], [{value:"2"}, {value:"3"}]];
        const result = sheets_lib.RemapErrorStructure(errors, row_data);

        expect(result).toEqual([
            { message: "Error 1", fields: ["A"], rows: [[{value:"0"},{value:"1"}], [{value:"2"}, {value:"3"}]] }
        ]);
    });

    test('does not add out-of-bounds adjacent rows', () => {
        const errors = [
            { row: 0, field: "A", message: "Error 1" },
            { row: 3, field: "A", message: "Error 1" },
        ];
        const row_data = [[{value:"0"},{value:"1"}], [{value:"2"}, {value:"3"}]];
        const result = sheets_lib.RemapErrorStructure(errors, row_data);
        // For row 0: only row0, row1
        // For row 3: row2, row3
        expect(result).toEqual([
            { message: "Error 1", fields: ["A"], rows: [[{value:"0"},{value:"1"}], [{value:"2"}, {value:"3"}]]   }
        ]);
    });

    test('returns empty array for empty input', () => {
        expect(sheets_lib.RemapErrorStructure([])).toEqual([]);
        expect(sheets_lib.RemapErrorStructure([], [])).toEqual([]);
    });

    test('ignores errors with missing row in row_data', () => {
        const errors = [
            { row: 5, field: "A", message: "Error 1" }
        ];
        const row_data = [[{value:"0"},{value:"1"}], [{value:"2"}, {value:"3"}]];
        const result = sheets_lib.RemapErrorStructure(errors, row_data);
        expect(result).toEqual([
            { message: "Error 1", fields: ["A"], rows: [] }
        ]);
    });
});
