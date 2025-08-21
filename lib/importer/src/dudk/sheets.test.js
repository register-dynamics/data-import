
const backend = require('./backend');
const sheets_lib = require('./sheets');

const SourceHeaders = {A: 0, B: 1, C: 2};

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
            {index: 1, row:[{value:"0", error:true},{value:"1",error:true}]},
            {index: 2, row: [{value:"2", error:true}, {value:"3", error:true}]}
        ];
        const result = sheets_lib.RemapErrorStructure(errors, row_data, SourceHeaders);
        expect(result).toEqual([
            {
                message: "Error 1",
                fields: [ "A"],
                meta: { first: 1, count: 2 },
                rows: [
                    {index:1, row:[{value:"0", error: true},{value:"1", error: true}]},
                    {index:2, row:[{value:"2", error: true}, {value:"3", error: true}]}
                ]
            },
            {
                message: "Error 2",
                fields: ["B"],
                meta: { first: 1, count: 2 },
                rows: [
                    {index:1, row: [{value:"0", error: true},{value:"1", error: true}]},
                    {index:2, row: [{value:"2", error: true}, {value:"3", error: true}]}
                ]
            }
        ]);
    });

    test('with row_data, includes adjacent rows', () => {
        const errors = [
            { row: 1, field: "A", message: "Error 1" },
            { row: 2, field: "A", message: "Error 1" },
        ];
        const row_data = [
            {index: 1, row: [{value:"0", error: true},{value:"1"}]},
            {index: 2, row: [{value:"2", error: true}, {value:"3"}]}
        ];
        const result = sheets_lib.RemapErrorStructure(errors, row_data, SourceHeaders);
        expect(result).toEqual([
            {
                message: "Error 1",
                fields: ["A"],
                meta: {first: 1, count: 2},
                rows: [
                    {index: 1, row: [{value:"0", error: true},{value:"1"}]},
                    {index: 2, row: [{value:"2", error: true}, {value:"3"}]}
                ]
            }
        ]);
    });

    test('does not add out-of-bounds adjacent rows', () => {
        const errors = [
            { row: 1, field: "A", message: "Error 1" },
            { row: 3, field: "A", message: "Error 1" },
        ];
        const row_data = [
            {index: 1, row: [{value:"0", error: true},{value:"1"}]},
            {index: 2, row: [{value:"2"}, {value:"3"}]}
        ];
        const result = sheets_lib.RemapErrorStructure(errors, row_data, SourceHeaders, 1);

        // For row 1: only 0, 1
        // For row 3: 2, 3
        expect(result).toEqual([
            {
                message: "Error 1",
                fields: ["A"],
                meta: { first: 1, count: 1 },
                rows: [
                    {index: 1, row: [{value:"0", error: true},{value:"1"}]},
                    {index: 2, row: [{value:"2"},{value:"3"}]}
                ]
            }
        ]);
    });

    test('returns empty array for empty input', () => {
        expect(sheets_lib.RemapErrorStructure([])).toEqual([]);
        expect(sheets_lib.RemapErrorStructure([], [])).toEqual([]);
        expect(sheets_lib.RemapErrorStructure([], [], [])).toEqual([]);
    });

    test('ignores errors with missing row in row_data', () => {
        const errors = [
            { row: 5, field: "A", message: "Error 1" }
        ];
        const row_data = [
            {index: 1, row: [{value:"0"},{value:"1"}]},
            {index: 2, row: [{value:"2"}, {value:"3"}]}
        ];
        const result = sheets_lib.RemapErrorStructure(errors, row_data, SourceHeaders);
        expect(result).toEqual([
            { message: "Error 1", meta: { count: 0, first: 0}, fields: ["A"], rows: [] }
        ]);
    });
});
