const backend = require('./backend');
const attributeTypes = require('./attribute-types');

const testFiles = new Map([
  ["test", [
     ["test.xlsx", "Cool Data"],
     ["test.csv", "Sheet1"],
     ["test.ods", "Cool Data"]
  ]],
  ["merged-cells", [
    ["merged-cells.xlsx", "Cool Data"],
    ["merged-cells.csv", "Sheet1"]
    //["merged-cells.ods", "Cool Data"]
  ]],
  ["tribbles", [
    ["tribbles.xlsx", "My lovely tribbles"],
    ["tribbles.csv", "Sheet1"]
    // ["tribbles.ods", "My lovely tribbles"],
  ]]
]);

const prefix_fixture = ([fixture_name, sheetname]) => {
  return ["../../fixtures/" + fixture_name, sheetname];
}

test('happy path', () => {
  const fixtures = testFiles.get("test").map(prefix_fixture)
  for( [filename, sheetname] of fixtures) {
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
      start: {row: 3, column: 0},
      end: {row: 5, column: 2}};

    const samples = backend.SessionGetInputSampleRows(sid, dataRange,
                                                      1, 1, 1);
    expect(samples).toMatchObject([
      [ [ {value: 'Boris'}, {value: '13'}, {value: 'High'} ] ],
      [ [ {value: 'Nelly'}, {value: '14'}, {value: 'High'} ] ],
      [ [ {value: 'Sid'}, {value: '10'}, {value: 'Medium'} ] ]
    ]);

    const values = backend.SessionGetInputValues(sid, dataRange, 2);
    expect(values).toMatchObject([
      { inputValues: [ 'Boris', 'Nelly' ], hasMore: true },
      { inputValues: [ '13', '14' ], hasMore: true },
      { inputValues: [ 'High', 'Medium' ], hasMore: false }
    ]);

    const mapping = {
      attributeMappings: {
        Name: 0,
        Age: 1,
        Egginess: 2
      },
    };

    // Do a mapping

    const jid = backend.SessionPerformMappingJob(sid, dataRange, mapping);

    // Look at the job results

    const jobSummary = backend.JobGetSummary(jid);
    expect(jobSummary).toMatchObject({
      recordCount: 3,
      errorCount: 0,
      warningCount: 0
    });

    const warnings = backend.JobGetWarnings(jid);
    expect(warnings).toMatchObject({});

    const errors = backend.JobGetErrors(jid);
    expect(errors).toMatchObject({});

    const sampleRecords = backend.JobGetSampleRecords(jid, 1, 1, 1);
    expect(sampleRecords).toMatchObject([
      [ { Name: 'Boris', Age: 13, Egginess: 'High' } ],
      [ { Name: 'Nelly', Age: 14, Egginess: 'High' } ],
      [ { Name: 'Sid', Age: 10, Egginess: 'Medium' } ]
    ]);

    const allRecords = backend.JobGetRecords(jid, 0, 3);
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
    start: {row: 3, column: 2},
    end: {row: 5, column: 5}};

  const samples = backend.SessionGetInputSampleRows(sid, dataRange,
                                                    1, 1, 1);
  expect(samples).toMatchObject([
    [ [ {value: 'Boris'}, undefined, {value: '13'},
        // This cell is merged with the next row
        {merge: {column: 0, columns: 1, row: 0, rows: 2}, value:"High"}] ],
    [ [ {value: 'Nelly'}, // These two cells are merged
        {merge: {column: 0, columns: 2, row: 0, rows: 1}, value: '14'},
        {merge: {column: 1, columns: 2, row: 0, rows: 1}, value: '14'},
        // This cell is merged with the previous row
        {merge: {column: 0, columns: 1, row: 1, rows: 2}, value:"High"} ] ],
    [ [ {value: 'Sid'}, undefined, {value: '10'}, {value: 'Medium'} ] ]
  ]);

  const allRange = {
    sheet: 'Cool Data',
    start: {row: 0, column: 0},
    end: {row: 7, column: 5}
  };
  const wholeSheet = backend.SessionGetInputSampleRows(sid,
                                                       allRange,
                                                       8, 0, 0);
  // console.log(JSON.stringify(wholeSheet[0], null, 3));
  expect(wholeSheet[0]).toMatchObject([
    [{merge: {column: 0, columns: 8, row: 0, rows: 1}, value:"TEST SPREADSHEET"},
     {merge: {column: 1, columns: 8, row: 0, rows: 1}, value:"TEST SPREADSHEET"},
     {merge: {column: 2, columns: 8, row: 0, rows: 1}, value:"TEST SPREADSHEET"},
     {merge: {column: 3, columns: 8, row: 0, rows: 1}, value:"TEST SPREADSHEET"},
     {merge: {column: 4, columns: 8, row: 0, rows: 1}, value:"TEST SPREADSHEET"},
     {merge: {column: 5, columns: 8, row: 0, rows: 1}, value:"TEST SPREADSHEET"}
    ],
    [undefined, undefined, undefined, undefined, undefined, undefined],
    [{merge: {column: 0, columns: 2, row: 0, rows:1}, value:"Heading row:"},
     {merge: {column: 1, columns: 2, row: 0, rows:1}, value:"Heading row:"},
     {value: "Name"},
     undefined,
     {value: "Age"},
     {value: "Egginess"}],
    [{merge: {column: 0, columns: 2, row: 0, rows:2}, value:"Here are some random notes left by the user"},
     {merge: {column: 1, columns: 2, row: 0, rows:2}, value:"Here are some random notes left by the user"},
     {value: "Boris"},
     undefined,
     {value: "13"},
     {merge: {column: 0, columns: 1, row: 0, rows: 2}, value:"High"}
    ],
    [{merge: {column: 0, columns: 2, row: 1, rows:2}, value:"Here are some random notes left by the user"},
     {merge: {column: 1, columns: 2, row: 1, rows:2}, value:"Here are some random notes left by the user"},
     {value: "Nelly"},
     {merge: {column: 0, columns: 2, row: 0, rows: 1}, value: '14'},
     {merge: {column: 1, columns: 2, row: 0, rows: 1}, value: '14'},
     {merge: {column: 0, columns: 1, row: 1, rows: 2}, value:"High"}
    ],
    [{merge: {column: 0, columns: 1, row: 0, rows:2}, value:"And another note"},
     undefined,
     {value: "Sid"},
     undefined,
     {value: "10"},
     {value: "Medium"}],
    [{merge: {column: 0, columns: 1, row: 1, rows:2}, value:"And another note"},
     undefined,
     {value: "AVERAGE"},
     undefined,
     {value: "11.5"},
     undefined],
    [undefined, undefined, undefined, undefined, undefined, undefined]
  ]);

  const values = backend.SessionGetInputValues(sid, dataRange, 2);
  expect(values).toMatchObject([
    { inputValues: [ 'Boris', 'Nelly' ], hasMore: true },
    { inputValues: [ '14', undefined ], hasMore: false }, // The value 14 is merged across both these columns
    { inputValues: [ '13', '14' ], hasMore: true },
    { inputValues: [ 'High', 'Medium' ], hasMore: false } // High egginess is merged between rows
  ]);

  // Do a mapping

  const mapping = {
    attributeMappings: {
      Name: 0,
      Age: 2,
      Egginess: 3
    },
  };

  const jid = backend.SessionPerformMappingJob(sid, dataRange, mapping);

  // Look at the job results

  const jobSummary = backend.JobGetSummary(jid);
  expect(jobSummary).toMatchObject({
    recordCount: 3,
    errorCount: 0,
    warningCount: 0
  });

  const warnings = backend.JobGetWarnings(jid);
  expect(warnings).toMatchObject({});

  const errors = backend.JobGetErrors(jid);
  expect(errors).toMatchObject({});

  const sampleRecords = backend.JobGetSampleRecords(jid, 1, 1, 1);
  expect(sampleRecords).toMatchObject([
    [ { Name: 'Boris', Age: 13, Egginess: 'High' } ],
    [ { Name: 'Nelly', Age: 14, Egginess: 'High' } ], // The 14 is merged across from a cell in column 1
    [ { Name: 'Sid', Age: 10, Egginess: 'Medium' } ]
  ]);

});

test('pad narrow samples', () => {
  const fixtures = testFiles.get("test").map(prefix_fixture)
  for( [filename, sheetname] of fixtures) {

    const sid = backend.CreateSession();
    backend.SessionSetFile(sid, filename);

    const dataRange = {
      sheet: sheetname,
      start: {row: 3, column: 0},
      end: {row: 5, column: 3}};

    const samples = backend.SessionGetInputSampleRows(sid, dataRange,
                                                      1, 1, 1);
    expect(samples).toMatchObject([
      [ [ {value: 'Boris'}, {value: '13'}, {value: 'High'}, undefined ] ],
      [ [ {value: 'Nelly'}, {value: '14'}, {value: 'High'}, undefined ] ],
      [ [ {value: 'Sid'}, {value: '10'}, {value: 'Medium'}, undefined ] ]
    ]);
  }
});

test('suggest data range', () => {
  const fixtures = testFiles.get("test").map(prefix_fixture)
  for( [filename, sheetname] of fixtures) {
    const sid = backend.CreateSession();
    backend.SessionSetFile(sid, filename);

    const headerRange = {
      sheet: sheetname,
      start: {row: 2, column: 0},
      end: {row: 2, column: 2}};

    const footerRange = {
      sheet: sheetname,
      start: {row: 6, column: 0},
      end: {row: 5, column: 1}};

    const defaultDataRange = backend.SessionSuggestDataRange(sid, null, null);
    expect(defaultDataRange).toMatchObject({
      sheet: sheetname,
      start: {row: 1, column: 0},
      end: {row: 6, column: 6}
    });

    const headerBasedDataRange = backend.SessionSuggestDataRange(sid, headerRange, null);
    expect(headerBasedDataRange).toMatchObject({
      sheet: sheetname,
      start: {row: 3, column: 0},
      end: {row: 6, column: 2}
    });

    const headerAndFooterBasedDataRange = backend.SessionSuggestDataRange(sid, headerRange, footerRange);
    expect(headerAndFooterBasedDataRange).toMatchObject({
      sheet: sheetname,
      start: {row: 3, column: 0},
      end: {row: 6, column: 2}
    });
  }
});

test('sample clamping', () => {
  const fixtures = testFiles.get("test").map(prefix_fixture)
  for( [filename, sheetname] of fixtures) {
    const sid = backend.CreateSession();
    backend.SessionSetFile(sid, filename);

    const dataRange = {
      sheet: sheetname,
      start: {row: 3, column: 0},
      end: {row: 5, column: 2}};

    // There are three rows available in the range. Let's see how the sampling
    // functions allocate them if we ask for too many sample rows.

    // 10:10:10 -> 1:0:2 because we reduce middleCount first, then split the difference, rounding towards endCount
    const samples1 = backend.SessionGetInputSampleRows(sid, dataRange,
                                                      10, 10, 10);
    expect(samples1).toMatchObject([
      [ [ {value: 'Boris'}, {value: '13'}, {value: 'High'} ] ],
      [ ],
      [ [ {value: 'Nelly'}, {value: '14'}, {value: 'High'} ],
        [ {value: 'Sid'}, {value: '10'}, {value: 'Medium'} ] ]
    ]);

    // Let's see if only middleCount is clamped if startCount and endCount are reasonable
    const samples2 = backend.SessionGetInputSampleRows(sid, dataRange,
                                                      1, 10, 1);
    expect(samples2).toMatchObject([
      [ [ {value: 'Boris'}, {value: '13'}, {value: 'High'} ] ],
      [ [ {value: 'Nelly'}, {value: '14'}, {value: 'High'} ] ],
      [ [ {value: 'Sid'}, {value: '10'}, {value: 'Medium'} ] ]
    ]);

    // Ok, now check the same works for job result sampling

    const mapping = {
      attributeMappings: {
        Name: 0,
        Age: 1,
        Egginess: 2
      },
    };

    const jid = backend.SessionPerformMappingJob(sid, dataRange, mapping);

    // 10:10:10 -> 1:0:2 because we reduce middleCount first, then split the difference, rounding towards endCount

    const sampleRecords1 = backend.JobGetSampleRecords(jid, 10, 10, 10);
    expect(sampleRecords1).toMatchObject([
      [ { Name: 'Boris', Age: 13, Egginess: 'High' } ],
      [  ],
      [ { Name: 'Nelly', Age: 14, Egginess: 'High' },
        { Name: 'Sid', Age: 10, Egginess: 'Medium' } ]
    ]);

    // Let's see if only middleCount is clamped if startCount and endCount are reasonable
    const sampleRecords2 = backend.JobGetSampleRecords(jid, 1, 10, 1);
    expect(sampleRecords2).toMatchObject([
      [ { Name: 'Boris', Age: 13, Egginess: 'High' } ],
      [ { Name: 'Nelly', Age: 14, Egginess: 'High' } ],
      [ { Name: 'Sid', Age: 10, Egginess: 'Medium' } ]
    ]);
  }
});

test('sampling algorithm', () => {
  const fixtures = testFiles.get("test").map(prefix_fixture)
  for( [filename, sheetname] of fixtures) {
    const sid = backend.CreateSession();
    backend.SessionSetFile(sid, filename);

    const dataRange = {
      sheet: sheetname,
      start: {row: 3, column: 0},
      end: {row: 5, column: 2}};

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
      [ {value: 'Boris'}, {value: '13'}, {value: 'High'} ],
      [ {value: 'Nelly'}, {value: '14'}, {value: 'High'} ],
      [ {value: 'Sid'}, {value: '10'}, {value: 'Medium'} ]]);

    // Now pick 1
    const samples2 = backend.SessionGetInputSampleRows(sid, dataRange,
                                                      0, 1, 0);

    // No rows in the start and end samples, 1 row in the middle sample
    expect(samples2[0]).toHaveLength(0);
    expect(samples2[1]).toHaveLength(1);
    expect(samples2[2]).toHaveLength(0);
    expect([
      [ {value: 'Boris'}, {value: '13'}, {value: 'High'} ],
      [ {value: 'Nelly'}, {value: '14'}, {value: 'High'} ],
      [ {value: 'Sid'}, {value: '10'}, {value: 'Medium'} ]]).toContainEqual(samples2[1][0]);

    // FIXME: Do 100 samples of 1 record, ensuring we get a roughly equal distribution of results


    // Now pick 2
    const samples3 = backend.SessionGetInputSampleRows(sid, dataRange,
                                                      0, 2, 0);

    // No rows in the start and end samples, 2 rows in the middle sample
    expect(samples3[0]).toHaveLength(0);
    expect(samples3[1]).toHaveLength(2);
    expect(samples3[2]).toHaveLength(0);
    expect([ // Sid can't be first, if there's two rows and they're in order
      [ {value: 'Boris'}, {value: '13'}, {value: 'High'} ],
      [ {value: 'Nelly'}, {value: '14'}, {value: 'High'} ]]).toContainEqual(samples3[1][0]);
    expect([ // Boris can't be second, if there's two rows and they're in order
      [ {value: 'Nelly'}, {value: '14'}, {value: 'High'} ],
      [ {value: 'Sid'}, {value: '10'}, {value: 'Medium'} ]]).toContainEqual(samples3[1][1]);
    // Test they're not equal.
    expect(samples3[1][0]).not.toMatchObject(samples3[1][1]);
  }
});

test('trailing stub rows in dimensions', () => {
  const fixtures = testFiles.get("tribbles").map(prefix_fixture)
  for( [filename, sheetname] of fixtures) {
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
