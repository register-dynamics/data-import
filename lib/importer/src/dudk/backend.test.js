const backend = require('./backend');
const attributeTypes = require('./types/attribute-types');

const testFiles = new Map([
  ["test", [
    ["test.xlsx", "Cool Data"],
    ["test.csv", "Sheet1"],
    ["test.ods", "Cool Data"]
  ]],
  ["merged-cells", [
    ["merged-cells.xlsx", "Cool Data"],
    ["merged-cells.csv", "Sheet1"],
    ["merged-cells.ods", "Cool Data"]
  ]],
  ["tribbles", [
    ["tribbles.xlsx", "My lovely tribbles"],
    ["tribbles.csv", "Sheet1"],
    ["tribbles.ods", "My lovely tribbles"],
  ]],
  ["test-validation",
    [["test-validation.xlsx", "Cool Data"]],
    [["test-validation.csv", "Sheet1"]],
    [["test-validation.ods", "Cool Data"]],
  ]
]);

const prefix_fixture = ([fixture_name, sheetname]) => {
  return ["../../fixtures/" + fixture_name, sheetname];
}

describe("Backend tests", () => {

  // Normally calling console.error as the xlsx library does with
  // ODS number formats will result in a test fail.  For the
  // purpose of these tests, we will disable that functionality.
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => { });
  });

  test('happy path', () => {
    const fixtures = testFiles.get("test").map(prefix_fixture)
    for (let [filename, sheetname] of fixtures) {
      const sid = backend.CreateSession();
      backend.SessionSetFile(sid, filename);

      const inputDimensions = backend.SessionGetInputDimensions(sid);
      expect(inputDimensions).toMatchObject({
        sheetDimensions: new Map([
          [sheetname, {
            rows: 7,
            columns: 7,
          }],
        ]),
      });

      const dataRange = {
        sheet: sheetname,
        start: { row: 3, column: 0 },
        end: { row: 5, column: 2 }
      };

      const samples = backend.SessionGetInputSampleRows(sid, dataRange,
        1, 1, 1);
      expect(samples).toMatchObject([
        [{ index: 4, row: [{ value: 'Boris' }, { value: '13' }, { value: 'High' }] }],
        [{ index: 5, row: [{ value: 'Nelly' }, { value: '14' }, { value: 'High' }] }],
        [{ index: 6, row: [{ value: 'Sid' }, { value: '10' }, { value: 'Medium' }] }]
      ]);

      const values = backend.SessionGetInputValues(sid, dataRange, 2);
      expect(values).toMatchObject([
        { inputValues: ['Boris', 'Nelly'], hasMore: true },
        { inputValues: ['13', '14'], hasMore: true },
        { inputValues: ['High', 'Medium'], hasMore: false }
      ]);

      const mapping = {
        attributeMappings: {
          Name: 0,
          Age: 1,
          Egginess: 2
        },
        attributeTypes: {
          Name: attributeTypes.requiredType(attributeTypes.basicStringType),
          Age: attributeTypes.requiredType(attributeTypes.basicNumberType),
          Egginess: attributeTypes.requiredType(attributeTypes.basicStringType)
        },
      };

      // Do a mapping

      const jid = backend.SessionPerformMappingJob(sid, dataRange, mapping);

      // Look at the job results

      const jobSummary = backend.JobGetSummary(sid, jid);
      expect(jobSummary).toMatchObject({
        recordCount: 3,
        errorCount: 0,
        warningCount: 2
      });

      const warnings = backend.JobGetWarnings(sid, jid);
      expect(warnings).toMatchObject({});

      const errors = backend.JobGetErrors(sid, jid);
      expect(errors).toMatchObject({});

      const sampleRecords = backend.JobGetSampleRecords(sid, jid, 1, 1, 1);
      expect(sampleRecords).toMatchObject([
        [{ Name: 'Boris', Age: 13, Egginess: 'High' }],
        [{ Name: 'Nelly', Age: 14, Egginess: 'High' }],
        [{ Name: 'Sid', Age: 10, Egginess: 'Medium' }]
      ]);

      const allRecords = backend.JobGetRecords(sid, jid, 0, 3);
      expect(allRecords).toMatchObject([
        { Name: 'Boris', Age: 13, Egginess: 'High' },
        { Name: 'Nelly', Age: 14, Egginess: 'High' },
        { Name: 'Sid', Age: 10, Egginess: 'Medium' }
      ]);

      backend.JobDelete(sid, jid);

      backend.SessionDelete(sid);

    }
  });

  test('merged cells', () => {
    const sid = backend.CreateSession();
    backend.SessionSetFile(sid, '../../fixtures/merged-cells.xlsx');

    const dataRange = {
      sheet: 'Cool Data',
      start: { row: 3, column: 2 },
      end: { row: 5, column: 5 }
    };

    const samples = backend.SessionGetInputSampleRows(sid, dataRange,
      1, 1, 1);
    expect(samples).toMatchObject([
      [{
        index: 4,
        row: [{ value: 'Boris' }, undefined, { value: '13' },
        // This cell is merged with the next row
        { merge: { column: 0, columns: 1, row: 0, rows: 2 }, value: "High" }]
      }],
      [{
        index: 5,
        row: [{ value: 'Nelly' }, // These two cells are merged
        { merge: { column: 0, columns: 2, row: 0, rows: 1 }, value: '14' },
        { merge: { column: 1, columns: 2, row: 0, rows: 1 }, value: '14' },
        // This cell is merged with the previous row
        { merge: { column: 0, columns: 1, row: 1, rows: 2 }, value: "High" }]
      }],
      [{ index: 6, row: [{ value: 'Sid' }, undefined, { value: '10' }, { value: 'Medium' }] }]
    ]);

    const allRange = {
      sheet: 'Cool Data',
      start: { row: 0, column: 0 },
      end: { row: 7, column: 5 }
    };
    const wholeSheet = backend.SessionGetInputSampleRows(sid,
      allRange,
      8, 0, 0);
    // console.log(JSON.stringify(wholeSheet[0], null, 3));
    expect(wholeSheet[0]).toMatchObject([
      {
        index: 1,
        row: [
          { merge: { column: 0, columns: 8, row: 0, rows: 1 }, value: "TEST SPREADSHEET" },
          { merge: { column: 1, columns: 8, row: 0, rows: 1 }, value: "TEST SPREADSHEET" },
          { merge: { column: 2, columns: 8, row: 0, rows: 1 }, value: "TEST SPREADSHEET" },
          { merge: { column: 3, columns: 8, row: 0, rows: 1 }, value: "TEST SPREADSHEET" },
          { merge: { column: 4, columns: 8, row: 0, rows: 1 }, value: "TEST SPREADSHEET" },
          { merge: { column: 5, columns: 8, row: 0, rows: 1 }, value: "TEST SPREADSHEET" }
        ]
      },
      {
        index: 2,
        row: [undefined, undefined, undefined, undefined, undefined, undefined]
      },
      {
        index: 3,
        row: [
          { merge: { column: 0, columns: 2, row: 0, rows: 1 }, value: "Heading row:" },
          { merge: { column: 1, columns: 2, row: 0, rows: 1 }, value: "Heading row:" },
          { value: "Name" },
          undefined,
          { value: "Age" },
          { value: "Egginess" }
        ]
      },
      {
        index: 4,
        row: [
          { merge: { column: 0, columns: 2, row: 0, rows: 2 }, value: "Here are some random notes left by the user" },
          { merge: { column: 1, columns: 2, row: 0, rows: 2 }, value: "Here are some random notes left by the user" },
          { value: "Boris" },
          undefined,
          { value: "13" },
          { merge: { column: 0, columns: 1, row: 0, rows: 2 }, value: "High" }
        ]
      },
      {
        index: 5,
        row: [
          { merge: { column: 0, columns: 2, row: 1, rows: 2 }, value: "Here are some random notes left by the user" },
          { merge: { column: 1, columns: 2, row: 1, rows: 2 }, value: "Here are some random notes left by the user" },
          { value: "Nelly" },
          { merge: { column: 0, columns: 2, row: 0, rows: 1 }, value: '14' },
          { merge: { column: 1, columns: 2, row: 0, rows: 1 }, value: '14' },
          { merge: { column: 0, columns: 1, row: 1, rows: 2 }, value: "High" }
        ]
      },
      {
        index: 6,
        row: [
          { merge: { column: 0, columns: 1, row: 0, rows: 2 }, value: "And another note" },
          undefined,
          { value: "Sid" },
          undefined,
          { value: "10" },
          { value: "Medium" }
        ]
      },
      {
        index: 7,
        row: [
          { merge: { column: 0, columns: 1, row: 1, rows: 2 }, value: "And another note" },
          undefined,
          { value: "AVERAGE" },
          undefined,
          { value: "11.5" },
          undefined
        ]
      },
      {
        index: 8,
        row: [undefined, undefined, undefined, undefined, undefined, undefined]
      }

    ]);

    const values = backend.SessionGetInputValues(sid, dataRange, 2);
    expect(values).toMatchObject([
      { inputValues: ['Boris', 'Nelly'], hasMore: true },
      { inputValues: ['14', undefined], hasMore: false }, // The value 14 is merged across both these columns
      { inputValues: ['13', '14'], hasMore: true },
      { inputValues: ['High', 'Medium'], hasMore: false } // High egginess is merged between rows
    ]);

    // Do a mapping

    const mapping = {
      attributeMappings: {
        Name: 0,
        Age: 2,
        Egginess: 3
      },
      attributeTypes: {
        Name: attributeTypes.requiredType(attributeTypes.basicStringType),
        Age: attributeTypes.requiredType(attributeTypes.basicNumberType),
        Egginess: attributeTypes.requiredType(attributeTypes.basicStringType)
      }
    };

    const jid = backend.SessionPerformMappingJob(sid, dataRange, mapping);

    // Look at the job results

    const jobSummary = backend.JobGetSummary(sid, jid);
    expect(jobSummary).toMatchObject({
      recordCount: 3,
      errorCount: 0,
      warningCount: 0
    });

    const warnings = backend.JobGetWarnings(sid, jid);
    expect(warnings).toMatchObject({});

    const errors = backend.JobGetErrors(sid, jid);
    expect(errors).toMatchObject({});

    const sampleRecords = backend.JobGetSampleRecords(sid, jid, 1, 1, 1);
    expect(sampleRecords).toMatchObject([
      [{ Name: 'Boris', Age: 13, Egginess: 'High' }],
      [{ Name: 'Nelly', Age: 14, Egginess: 'High' }], // The 14 is merged across from a cell in column 1
      [{ Name: 'Sid', Age: 10, Egginess: 'Medium' }]
    ]);

  });

  test('pad narrow samples', () => {
    const fixtures = testFiles.get("test").map(prefix_fixture)
    for (let [filename, sheetname] of fixtures) {

      const sid = backend.CreateSession();
      backend.SessionSetFile(sid, filename);

      const dataRange = {
        sheet: sheetname,
        start: { row: 3, column: 0 },
        end: { row: 5, column: 3 }
      };

      const samples = backend.SessionGetInputSampleRows(sid, dataRange,
        1, 1, 1);
      expect(samples).toMatchObject([
        [
          { index: 4, row: [{ value: 'Boris' }, { value: '13' }, { value: 'High' }, undefined] }
        ],
        [
          { index: 5, row: [{ value: 'Nelly' }, { value: '14' }, { value: 'High' }, undefined] }
        ],
        [
          { index: 6, row: [{ value: 'Sid' }, { value: '10' }, { value: 'Medium' }, undefined] }
        ]
      ]);
    }
  });

  test('suggest data range', () => {
    const fixtures = testFiles.get("test").map(prefix_fixture)
    for (let [filename, sheetname] of fixtures) {
      const sid = backend.CreateSession();
      backend.SessionSetFile(sid, filename);

      const headerRange = {
        sheet: sheetname,
        start: { row: 2, column: 0 },
        end: { row: 2, column: 2 }
      };

      const footerRange = {
        sheet: sheetname,
        start: { row: 6, column: 0 },
        end: { row: 5, column: 1 }
      };

      const defaultDataRange = backend.SessionSuggestDataRange(sid, null, null);
      expect(defaultDataRange).toMatchObject({
        sheet: sheetname,
        start: { row: 1, column: 0 },
        end: { row: 6, column: 6 }
      });

      const headerBasedDataRange = backend.SessionSuggestDataRange(sid, headerRange, null);
      expect(headerBasedDataRange).toMatchObject({
        sheet: sheetname,
        start: { row: 3, column: 0 },
        end: { row: 6, column: 2 }
      });

      const headerAndFooterBasedDataRange = backend.SessionSuggestDataRange(sid, headerRange, footerRange);
      expect(headerAndFooterBasedDataRange).toMatchObject({
        sheet: sheetname,
        start: { row: 3, column: 0 },
        end: { row: 6, column: 2 }
      });
    }
  });

  test('sample clamping', () => {
    const fixtures = testFiles.get("test").map(prefix_fixture)
    for (let [filename, sheetname] of fixtures) {
      const sid = backend.CreateSession();
      backend.SessionSetFile(sid, filename);

      const dataRange = {
        sheet: sheetname,
        start: { row: 3, column: 0 },
        end: { row: 5, column: 2 }
      };

      // There are three rows available in the range. Let's see how the sampling
      // functions allocate them if we ask for too many sample rows.

      // 10:10:10 -> 1:0:2 because we reduce middleCount first, then split the difference, rounding towards endCount
      const samples1 = backend.SessionGetInputSampleRows(sid, dataRange,
        10, 10, 10);
      expect(samples1).toMatchObject([
        [
          { index: 4, row: [{ value: 'Boris' }, { value: '13' }, { value: 'High' }] }
        ],
        [],
        [
          { index: 5, row: [{ value: 'Nelly' }, { value: '14' }, { value: 'High' }] },
          { index: 6, row: [{ value: 'Sid' }, { value: '10' }, { value: 'Medium' }] }
        ]
      ]);

      // Let's see if only middleCount is clamped if startCount and endCount are reasonable
      const samples2 = backend.SessionGetInputSampleRows(sid, dataRange,
        1, 10, 1);
      expect(samples2).toMatchObject([
        [
          { index: 4, row: [{ value: 'Boris' }, { value: '13' }, { value: 'High' }] }
        ],
        [
          { index: 5, row: [{ value: 'Nelly' }, { value: '14' }, { value: 'High' }] }
        ],
        [
          { index: 6, row: [{ value: 'Sid' }, { value: '10' }, { value: 'Medium' }] }
        ]
      ]);

      // Ok, now check the same works for job result sampling

      const mapping = {
        attributeMappings: {
          Name: 0,
          Age: 1,
          Egginess: 2
        },
        attributeTypes: {
          Name: attributeTypes.requiredType(attributeTypes.basicStringType),
          Age: attributeTypes.requiredType(attributeTypes.basicNumberType),
          Egginess: attributeTypes.requiredType(attributeTypes.basicStringType)
        },
      };

      const jid = backend.SessionPerformMappingJob(sid, dataRange, mapping);

      // 10:10:10 -> 1:0:2 because we reduce middleCount first, then split the difference, rounding towards endCount

      const sampleRecords1 = backend.JobGetSampleRecords(sid, jid, 10, 10, 10);
      expect(sampleRecords1).toMatchObject([
        [{ Name: 'Boris', Age: 13, Egginess: 'High' }],
        [],
        [{ Name: 'Nelly', Age: 14, Egginess: 'High' },
        { Name: 'Sid', Age: 10, Egginess: 'Medium' }]
      ]);

      // Let's see if only middleCount is clamped if startCount and endCount are reasonable
      const sampleRecords2 = backend.JobGetSampleRecords(sid, jid, 1, 10, 1);
      expect(sampleRecords2).toMatchObject([
        [{ Name: 'Boris', Age: 13, Egginess: 'High' }],
        [{ Name: 'Nelly', Age: 14, Egginess: 'High' }],
        [{ Name: 'Sid', Age: 10, Egginess: 'Medium' }]
      ]);
    }
  });

  test('sampling algorithm', () => {
    const fixtures = testFiles.get("test").map(prefix_fixture)
    for (let [filename, sheetname] of fixtures) {
      const sid = backend.CreateSession();
      backend.SessionSetFile(sid, filename);

      const dataRange = {
        sheet: sheetname,
        start: { row: 3, column: 0 },
        end: { row: 5, column: 2 }
      };

      // We can be fairly confident startCount and endCount work right, but
      // middleCount has an *algorithm* that tries to pick a random sample of rows
      // without repeats. Previous tests have forced its hand to pick just the one
      // row, so there's always a consistent result we can easily test for. Now
      // let's really exercise the randomness.

      // First: Pick all 3
      const samples1 = backend.SessionGetInputSampleRows(sid, dataRange,
        0, 10, 0);

      // No rows in the start and end samples, 3 rows in the middle sample
      expect(samples1[0]).toHaveLength(0);
      expect(samples1[1]).toHaveLength(3);
      expect(samples1[2]).toHaveLength(0);
      expect(samples1[1]).toMatchObject([
        { index: 4, row: [{ value: 'Boris' }, { value: '13' }, { value: 'High' }] },
        { index: 5, row: [{ value: 'Nelly' }, { value: '14' }, { value: 'High' }] },
        { index: 6, row: [{ value: 'Sid' }, { value: '10' }, { value: 'Medium' }] }]);

      // Now pick 1
      const samples2 = backend.SessionGetInputSampleRows(sid, dataRange,
        0, 1, 0);

      // No rows in the start and end samples, 1 row in the middle sample
      expect(samples2[0]).toHaveLength(0);
      expect(samples2[1]).toHaveLength(1);
      expect(samples2[2]).toHaveLength(0);
      expect([
        { index: 4, row: [{ value: 'Boris' }, { value: '13' }, { value: 'High' }] },
        { index: 4, row: [{ value: 'Nelly' }, { value: '14' }, { value: 'High' }] },
        { index: 4, row: [{ value: 'Sid' }, { value: '10' }, { value: 'Medium' }] }]).toContainEqual(samples2[1][0]);

      // FIXME: Do 100 samples of 1 record, ensuring we get a roughly equal distribution of results


      // Now pick 2
      const samples3 = backend.SessionGetInputSampleRows(sid, dataRange,
        0, 2, 0);

      // No rows in the start and end samples, 2 rows in the middle sample
      expect(samples3[0]).toHaveLength(0);
      expect(samples3[1]).toHaveLength(2);
      expect(samples3[2]).toHaveLength(0);
      expect([ // Sid can't be first, if there's two rows and they're in order
        { index: 4, row: [{ value: 'Boris' }, { value: '13' }, { value: 'High' }] },
        { index: 4, row: [{ value: 'Nelly' }, { value: '14' }, { value: 'High' }] }]).toContainEqual(samples3[1][0]);
      expect([ // Boris can't be second, if there's two rows and they're in order
        { index: 5, row: [{ value: 'Nelly' }, { value: '14' }, { value: 'High' }] },
        { index: 5, row: [{ value: 'Sid' }, { value: '10' }, { value: 'Medium' }] }]).toContainEqual(samples3[1][1]);
      // Test they're not equal.
      expect(samples3[1][0]).not.toMatchObject(samples3[1][1]);
    }
  });

  test('trailing stub rows in dimensions', () => {
    const fixtures = testFiles.get("tribbles").map(prefix_fixture)
    for (let [filename, sheetname] of fixtures) {
      const sid = backend.CreateSession();
      backend.SessionSetFile(sid, filename);

      const dimensions = backend
        .SessionGetInputDimensions(sid)
        .sheetDimensions.get(sheetname);

      // There are physically 23 rows, because some of them have styles even
      // if they have no content. We only expect to process 9 rows.
      expect(dimensions.rows).toEqual(9)
      expect(dimensions.columns).toEqual(7)
    }
  });

});

test('validation', () => {
  const fixtures = testFiles.get("test-validation").map(prefix_fixture)
  for (const [filename, sheetname] of fixtures) {
    const sid = backend.CreateSession();
    backend.SessionSetFile(sid, filename);

    const dataRange = {
      sheet: sheetname,
      start: { row: 3, column: 0 },
      end: { row: 8, column: 3 }
    };

    const mapping = {
      attributeMappings: {
        Name: 0,
        Age: 1,
        Egginess: 2,
        Weight: 3,
      },
      attributeTypes: {
        Name: attributeTypes.requiredType(attributeTypes.basicStringType),
        Age: attributeTypes.requiredType(attributeTypes.basicNumberType),
        Egginess: attributeTypes.optionalType(attributeTypes.basicStringType),
        Weight: attributeTypes.optionalType(attributeTypes.basicNumberType)
      }
    };

    // Do a mapping

    const jid = backend.SessionPerformMappingJob(sid, dataRange, mapping, false);

    // Look at the job results

    const jobSummary = backend.JobGetSummary(sid, jid);
    expect(jobSummary).toMatchObject({
      recordCount: 3,
      errorCount: 2,
      warningCount: 2
    });

    const warnings = backend.JobGetWarnings(sid, jid); // Weight is optional so errors here become warnings
    expect(warnings).toMatchObject(new Map([[4, [{ "row": 4, "message": 'Row is empty' }]],
    [8, [{ "row": 8, "field": "Weight", "message": "This is not a valid number" }]]]));

    const errors = backend.JobGetErrors(sid, jid);
    expect(errors).toMatchObject(new Map([
      [6, [{ "row": 6, "field": 'Age', "message": 'This is not a valid number' }]],
      [7, [{ "row": 7, "field": 'Name', "message": 'A value must be provided' },
      { "row": 7, "field": 'Age', "message": 'This is not a valid number' }]]
    ]));

    const allRecords = backend.JobGetRecords(sid, jid, 0, 3);
    expect(allRecords).toMatchObject([
      { Name: 'Boris', Age: 13, Egginess: 'High', Weight: 5.5 },
      { Name: 'Nelly', Age: 10 },
      { Name: 'Dave', Age: 15 }
    ]);

    backend.JobDelete(sid, jid);

    backend.SessionDelete(sid);

  }

});

test('guessing types', () => {
  const sid = backend.CreateSession();
  backend.SessionSetFile(sid, "../../fixtures/type-guessing.csv");
  const dataRange = {
    sheet: 'Sheet1',
    start: { row: 1, column: 0 },
    end: { row: 6, column: 9 }
  };

  const guesses = backend.SessionGuessTypes(sid, dataRange);
  expect(guesses).toMatchObject([
    // Order is actually irrelevant for all formats lists, so this test over-specifies a bit
    {full:true, types:new Map([["number", false],["text", false]])},
    {full:true, types:new Map([["date", ["ymd"]],["text", false]])},
    {full:true, types:new Map([["date", ["ydm"]],["text", false]])},
    {full:true, types:new Map([["date", ["dmy"]],["text", false]])},
    {full:true, types:new Map([["date", ["mdy"]],["text", false]])},
    {full:true, types:new Map([["date", ["ymd","ydm"]],["text", false]])},
    {full:false, types:new Map([["number", false],["text", false]])},
    {full:true, types:new Map([["text", false]])},
    {full:false, types:new Map([["text", false]])}
  ]);

  const fieldSuggestions = backend.SessionSuggestFields(sid, guesses, [
    {
      name: "numberField",
      required: true,
      type: "number"
    },
    {
      name: "dateField",
      required: true,
      type: "date"
    },
    {
      name: "textField",
      required: true,
      type: "text"
    },
    { // This one will have no matches
      name: "postcodeField",
      required: true,
      type: "postcode"
    }
  ]);

  expect(fieldSuggestions).toMatchObject([
    // Order is actually irrelevant for all formats lists, so this test over-specifies a bit
    {full:true, types:new Map([["number", false],["text", false]]),
     fields: new Map([
       ["numberField",false],
       ["textField",false]
     ])},
    {full:true, types:new Map([["date", ["ymd"]],["text", false]]),
     fields: new Map([
       ["dateField",["ymd"]],
       ["textField",false]
     ])},
    {full:true, types:new Map([["date", ["ydm"]],["text", false]]),
     fields: new Map([
       ["dateField",["ydm"]],
       ["textField",false]
     ])},
    {full:true, types:new Map([["date", ["dmy"]],["text", false]]),
     fields: new Map([
       ["dateField",["dmy"]],
       ["textField",false]
     ])},
    {full:true, types:new Map([["date", ["mdy"]],["text", false]]),
     fields: new Map([
       ["dateField",["mdy"]],
       ["textField",false]
     ])},
    {full:true, types:new Map([["date", ["ymd","ydm"]],["text", false]]),
     fields: new Map([
       ["dateField",["ymd","ydm"]],
       ["textField",false]
     ])},
    {full:false, types:new Map([["number", false],["text", false]]),
     fields: new Map([
       ["numberField",false],
       ["textField",false]
     ])},
    {full:true, types:new Map([["text", false]]),
     fields: new Map([
       ["textField",false]
     ])},
    {full:false, types:new Map([["text", false]]),
     fields: new Map([
       ["textField",false]
     ])}
  ]);
});
