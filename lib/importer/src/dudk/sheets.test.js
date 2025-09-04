
const backend = require('./backend');
const sheets_lib = require('./sheets');

const RewrittenMapping = {A: 0, B: 1, C: 2};

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
            { row: 1, field: "A", type: {variant: "IncorrectType"} },
            { row: 1, field: "B", type: {variant: "IncorrectType"} },
            { row: 2, field: "B", type: {variant: "IncorrectType"} },
            { row: 3, field: "A", type: {variant: "IncorrectType"} },
        ];
        // Adjusted expected result to match grouping by error, then by field
        const row_data = [
            {index: 1, row:[{value:"0", error:true},{value:"1",error:true}]},
            {index: 2, row: [{value:"2", error:true}, {value:"3", error:true}]}
        ];
        const result = sheets_lib.RemapErrorStructure(errors, row_data, RewrittenMapping);
        expect(result).toEqual([
            {
                type: {variant: "IncorrectType"},
                field: "A",
                // Only 1 error (in the two rows) because A appears twice but in
                // rows 1 and 3 and here we have rows 1 and 2
                meta: { first: 1, count: 1 },
                rows: [
                    {index:1, error: true, row:[{value:"0", error: true},{value:"1", error: true}]},
                    {index:2, row:[{value:"2", error: true}, {value:"3", error: true}]}
                ]
            },
            {
                type: {variant: "IncorrectType"},
                field: "B",
                meta: { first: 1, count: 2 },
                rows: [
                    {index:1, error: true, row: [{value:"0", error: true},{value:"1", error: true}]},
                    {index:2, error: true, row: [{value:"2", error: true}, {value:"3", error: true}]}
                ]
            }
        ]);
    });

    test('with row_data, includes adjacent rows', () => {
        const errors = [
            { row: 1, field: "A", type: "Error 1" },
            { row: 2, field: "A", type: "Error 1" },
        ];
        const row_data = [
            {index: 1, row: [{value:"0", error: true},{value:"1"}]},
            {index: 2, row: [{value:"2", error: true}, {value:"3"}]}
        ];
        const result = sheets_lib.RemapErrorStructure(errors, row_data, RewrittenMapping);
        expect(result).toEqual([
            {
                type: "Error 1",
                field: "A",
                meta: {first: 1, count: 2},
                rows: [
                    {index: 1, error: true, row: [{value:"0", error: true},{value:"1"}]},
                    {index: 2, error: true, row: [{value:"2", error: true}, {value:"3"}]}
                ]
            }
        ]);
    });

    test('does not add out-of-bounds adjacent rows', () => {
        const errors = [
            { row: 1, field: "A", type: "Error 1" },
            { row: 3, field: "A", type: "Error 1" },
        ];
        const row_data = [
            {index: 1, row: [{value:"0", error: true},{value:"1"}]},
            {index: 2, row: [{value:"2"}, {value:"3"}]}
        ];
        const result = sheets_lib.RemapErrorStructure(errors, row_data, RewrittenMapping);

        // For row 1: only 0, 1
        // For row 3: 2, 3
        expect(result).toEqual([
            {
                type: "Error 1",
                field: "A",
                meta: { first: 1, count: 1 },
                rows: [
                    {index: 1, error: true, row: [{value:"0", error: true},{value:"1"}]},
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
            { row: 5, field: "A", type: "Error 1" }
        ];
        const row_data = [
            {index: 1, row: [{value:"0"},{value:"1"}]},
            {index: 2, row: [{value:"2"}, {value:"3"}]}
        ];
        const result = sheets_lib.RemapErrorStructure(errors, row_data, RewrittenMapping);
        expect(result).toEqual([
            { type: "Error 1", meta: { count: 0, first: 0}, field: "A", rows: [] }
        ]);
    });

    test('remapping errors - missing fields', () => {
        const errors =  [
            { row: 2, field: 'Salary', type: { variant: "FieldRequired" } },
            { row: 3, field: 'Salary', type: { variant: "FieldRequired" } },
            { row: 5, field: 'Salary', type: { variant: "FieldRequired" } }
        ] ;
        const row_data =
        [
            {index: 2, row: [{value: "2"}, {value: "Mr"}, {value: "Odie"}, {value: "Arbuckle"}, {value: "2025-02-01"}, {value: "123" }, {value: "12%"}, {value: "2025-04-01"}]},
            {index: 3, row: [{value: "1"}, {value: "Mr"}, {value: "Jon"}, {value: "Arbuckle"}, {value: "2025-01-01"}, undefined, undefined, {value: "2025-04-01"}]},
            {index: 4, row: [{value: "1"}, {value: "Mr"}, {value: "Jon"}, {value: "Arbuckle"}, {value: "2025-01-01"}, undefined, undefined, {value: "2025-04-01"}]},
            {index: 5, row: [{value: "2"}, {value: "Mr"}, {value: "Odie"}, {value: "Arbuckle"}, {value: "2025-02-01"}, {value: "123"}, {value: "12%"}, {value: "2025-04-01"}]},
            {index: 6, row: [{value: "1"}, {value: "Mr"}, {value: "Jon"}, {value: "Arbuckle"}, {value: "2025-01-01"}, undefined, undefined, {value: "2025-04-01"}]},
            {index: 7, row: [{value: "2"}, {value: "Mr"}, {value: "Odie"}, {value: "Arbuckle"}, {value: "2025-02-01"}, {value: "123"}, {value: "12%"}, {value: "2025-04-01"}]}
        ];
        const mappingIndices =  {
            'Employee number': 0,
            Title: 1,
            'First name': 2,
            Surname: 3,
            'Employment start date': 4,
            Salary: 5,
            'Contribution percentage': 6,
            'Payment date': 7
        } ;
        const headerRangeOffset = 1;

        const result = sheets_lib.RemapErrorStructure(errors, row_data, mappingIndices, headerRangeOffset);
        expect(result).toEqual([
            {
                type: {variant: "FieldRequired"},
                field: 'Salary',
                meta: { first: 3, count: 3 },
                rows: [
                    // errors in index 3, 5 and 6
                    { index: 2, row: [{value: "2"}, {value: "Mr"}, {value: "Odie"}, {value: "Arbuckle"}, {value: "2025-02-01"}, {value: "123" }, {value: "12%"}, {value: "2025-04-01"}]},
                    { index: 3, error: true, row: [{ value: "1" }, { value: "Mr" }, { value: "Jon" }, { value: "Arbuckle" }, { value: "2025-01-01" }, { value: "   ", error: true}, undefined, { value: "2025-04-01" }] },
                    { index: 4, error: true, row: [{ value: "1" }, { value: "Mr" }, { value: "Jon" }, { value: "Arbuckle" }, { value: "2025-01-01" }, { value: "   ", error: true}, undefined, { value: "2025-04-01" }] },
                    { index: 5, row: [{value: "2"}, {value: "Mr"}, {value: "Odie"}, {value: "Arbuckle"}, {value: "2025-02-01"}, {value: "123"}, {value: "12%"}, {value: "2025-04-01"}]},
                    { index: 6, error: true, row: [{ value: "1" }, { value: "Mr" }, { value: "Jon" }, { value: "Arbuckle" }, { value: "2025-01-01" }, { value: "   ", error: true}, undefined, { value: "2025-04-01" }] },
                    { index: 7, row: [{value: "2"}, {value: "Mr"}, {value: "Odie"}, {value: "Arbuckle"}, {value: "2025-02-01"}, {value: "123"}, {value: "12%"}, {value: "2025-04-01"}]}
                ]
            }
        ]);

    });

    test('remapping errors - multiple errors', () => {
        const errors =  [
            { row: 3, field: 'Salary', type: {variant: "FieldRequired"} },
            { row: 4, field: 'Salary', type: {variant: "IncorrectType"} },
            { row: 5, field: 'Salary', type: {variant: "FieldRequired"} },
            { row: 6, field: 'Salary', type: {variant: "IncorrectType"} },
            { row: 7, field: 'Salary', type: {variant: "FieldRequired"} },
            { row: 8, field: 'Salary', type: {variant: "FieldRequired"} }
        ] ;
        const row_data = [
            { index: 4, row: [
                {value: "Kris"}, {value: "1-1-24"}, {value: "1:00"}, {value: "5.5"}, {value: "Pink"}, {value: "Splotches"}, undefined
            ]},
            { index: 5, row: [
                {value: "Alex"}, {value: "2-4-24"}, {value: "4:34"}, {value: "6"}, {value: "Beige"}, {value: "N/A"}, {value: "My fave <3"}
            ]},
            { index: 6, row: [
                {value: "Drew"}, {value: "3-5-24"}, {value: "15:05"}, {value: "6.5"}, {value: "Brown"}, {value: "Blob on top"}, undefined
            ]},
            { index: 7, row: [
                {value: "Jamie"}, {value: "2-3-24"}, {value: "6:01"}, {value: "8.4"}, {value: "Pink"}, undefined, {value: "Evil!!"}
            ]},
            { index: 8, row: [
                {value: "Emm"}, {value: "1-5-24"}, {value: "9:55"}, {value: "4.9"}, {value: "Maroon"}, {value: "Yes"}, undefined
            ]},
            { index: 9, row: [
                {value: "Elm"}, {value: "4-5-24"}, {value: "10:43"}, {value: "5.6"}, {value: "Black"}, {value: "Stripese"}, undefined
            ]},
        ];
        const mappingIndices =  { 'First name': 0, Salary: 6 } ;
        const headerRangeOffset = 3 ;

        const result = sheets_lib.RemapErrorStructure(errors, row_data, mappingIndices, headerRangeOffset);
        expect(result).toMatchObject([
            {
                type: { variant: "FieldRequired" },
                meta: { first: 4, count: 4 },
                field: 'Salary',
                rows:[
                    { index: 4, row: [ {value: "Kris"}, {value: "1-1-24"}, {value: "1:00"}, {value: "5.5"}, {value: "Pink"}, {value: "Splotches"}, {value: "   ", error: true} ]},
                    { index: 5, row: [ {value: "Alex"}, {value: "2-4-24"}, {value: "4:34"}, {value: "6"}, {value: "Beige"}, {value: "N/A"}, {value: "My fave <3"} ]},
                    { index: 6, row: [ {value: "Drew"}, {value: "3-5-24"}, {value: "15:05"}, {value: "6.5"}, {value: "Brown"}, {value: "Blob on top"}, {value: "   ", error: true}]},
                    { index: 7, row: [ {value: "Jamie"}, {value: "2-3-24"}, {value: "6:01"}, {value: "8.4"}, {value: "Pink"}, undefined, {value: "Evil!!"} ]},
                    { index: 8, row: [ {value: "Emm"}, {value: "1-5-24"}, {value: "9:55"}, {value: "4.9"}, {value: "Maroon"}, {value: "Yes"}, {value: "   ", error: true} ]},
                    { index: 9, row: [ {value: "Elm"}, {value: "4-5-24"}, {value: "10:43"}, {value: "5.6"}, {value: "Black"}, {value: "Stripese"}, {value: "   ", error: true}]},
                ]
            },
            {
                type: { variant: "IncorrectType" },
                meta: { first: 5, count: 2 },
                field: 'Salary',
                rows: [
                    { index: 4, row: [ {value: "Kris"}, {value: "1-1-24"}, {value: "1:00"}, {value: "5.5"}, {value: "Pink"}, {value: "Splotches"}, undefined ]},
                    { index: 5, row: [ {value: "Alex"}, {value: "2-4-24"}, {value: "4:34"}, {value: "6"}, {value: "Beige"}, {value: "N/A"}, {value: "My fave <3", error: true} ]},
                    { index: 6, row: [ {value: "Drew"}, {value: "3-5-24"}, {value: "15:05"}, {value: "6.5"}, {value: "Brown"}, {value: "Blob on top"}, undefined]},
                    { index: 7, row: [ {value: "Jamie"}, {value: "2-3-24"}, {value: "6:01"}, {value: "8.4"}, {value: "Pink"}, undefined, {value: "Evil!!", error: true} ]},
                    { index: 8, row: [ {value: "Emm"}, {value: "1-5-24"}, {value: "9:55"}, {value: "4.9"}, {value: "Maroon"}, {value: "Yes"}, undefined ]},
                ]
            }
        ]);

    });
});
