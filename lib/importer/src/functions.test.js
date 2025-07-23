const fs = require('fs');
const path = require('path');

let functionsFile = fs.readFileSync(path.join(__dirname, 'functions.js'), 'utf8');
let unexportedRemapFunction;
eval(functionsFile + '\nunexportedRemapFunction = remapErrorStructure;');

describe('remapErrorStructure', () => {
    test('groups errors by field and message, collects rows', () => {
        const errors = [
            { row: 1, field: "A", message: "Error 1" },
            { row: 1, field: "B", message: "Error 2" },
            { row: 2, field: "B", message: "Error 2" },
            { row: 3, field: "A", message: "Error 1" },
        ];
        // Adjusted expected result to match grouping by error, then by field
        const row_data = ['row0', 'row1', 'row2', 'row3'];
        const result = unexportedRemapFunction(errors, row_data);
        expect(result).toEqual([
            {
            message: "Error 1",
            fields: [
                { field: "A", rows: ["row0", "row1", "row2", "row3"] }
            ]
            },
            {
            message: "Error 2",
            fields: [
                { field: "B", rows: ["row0", "row1", "row2", "row3"] }
            ]
            }
        ]);
    });

    test('with row_data, includes adjacent rows', () => {
        const errors = [
            { row: 1, field: "A", message: "Error 1" },
            { row: 2, field: "A", message: "Error 1" },
        ];
        const row_data = ['row0', 'row1', 'row2', 'row3'];
        const result = unexportedRemapFunction(errors, row_data);

        expect(result).toEqual([
            { message: "Error 1", fields: [
                { field: "A", rows: ["row0", "row1", "row2", "row3"] }
        ]},
        ]);
    });

    test('does not add out-of-bounds adjacent rows', () => {
        const errors = [
            { row: 0, field: "A", message: "Error 1" },
            { row: 3, field: "A", message: "Error 1" },
        ];
        const row_data = ['row0', 'row1', 'row2', 'row3'];
        const result = unexportedRemapFunction(errors, row_data);
        // For row 0: only row0, row1
        // For row 3: row2, row3
        expect(result).toEqual([
            { message: "Error 1", fields: [
                { field: "A", rows: ['row0', 'row1', 'row2', 'row3']   }
            ]}
        ]);
    });

    test('returns empty array for empty input', () => {
        expect(unexportedRemapFunction([])).toEqual([]);
        expect(unexportedRemapFunction([], [])).toEqual([]);
    });

    test('ignores errors with missing row in row_data', () => {
        const errors = [
            { row: 5, field: "A", message: "Error 1" }
        ];
        const row_data = ['row0', 'row1'];
        const result = unexportedRemapFunction(errors, row_data);
        expect(result).toEqual([
            { message: "Error 1", fields: [
                { field: "A", rows: [] }
            ]}
        ]);
    });
});
