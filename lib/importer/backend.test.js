const backend = require('./backend');

test('happy path', () => {
    const sid = backend.CreateSession();
    backend.SessionSetFile(sid, '../../fixtures/test.xlsx');

    const inputDimensions = backend.SessionGetInputDimensions(sid);
    expect(inputDimensions).toMatchObject({
        sheetDimensions: new Map([
            ['Cool Data', {
                rows: 7,
                columns: 7,
            }],
        ]),
    });

    const dataRange = {
        sheet: 'Cool Data',
        start: {row: 3, column: 0},
        end: {row: 5, column: 2}};

    const samples = backend.SessionGetInputSampleRows(sid, dataRange,
                                                      1, 1, 1);
    expect(samples).toMatchObject([
        [ [ 'Boris', '13', 'High' ] ],
        [ [ 'Nelly', '14', 'High' ] ],
        [ [ 'Sid', '10', 'Medium' ] ]
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
});

test('pad narrow samples', () => {
    const sid = backend.CreateSession();
    backend.SessionSetFile(sid, '../../fixtures/test.xlsx');

    const dataRange = {
        sheet: 'Cool Data',
        start: {row: 3, column: 0},
        end: {row: 5, column: 3}};

    const samples = backend.SessionGetInputSampleRows(sid, dataRange,
                                                      1, 1, 1);
    expect(samples).toMatchObject([
        [ [ 'Boris', '13', 'High', undefined ] ],
        [ [ 'Nelly', '14', 'High', undefined ] ],
        [ [ 'Sid', '10', 'Medium', undefined ] ]
    ]);
});

test('suggest data range', () => {
    const sid = backend.CreateSession();
    backend.SessionSetFile(sid, '../../fixtures/test.xlsx');

    const headerRange = {
        sheet: 'Cool Data',
        start: {row: 2, column: 0},
        end: {row: 2, column: 2}};

    const footerRange = {
        sheet: 'Cool Data',
        start: {row: 6, column: 0},
        end: {row: 6, column: 1}};

    const defaultDataRange = backend.SessionSuggestDataRange(sid, null, null);
    expect(defaultDataRange).toMatchObject({
        sheet: 'Cool Data',
        start: {row: 1, column: 0},
        end: {row: 6, column: 6}
    });

    const headerBasedDataRange = backend.SessionSuggestDataRange(sid, headerRange, null);
    expect(headerBasedDataRange).toMatchObject({
        sheet: 'Cool Data',
        start: {row: 3, column: 0},
        end: {row: 6, column: 2}
    });

    const headerAndFooterBasedDataRange = backend.SessionSuggestDataRange(sid, headerRange, footerRange);
    expect(headerAndFooterBasedDataRange).toMatchObject({
        sheet: 'Cool Data',
        start: {row: 3, column: 0},
        end: {row: 5, column: 2}
    });
});

test('sample clamping', () => {
    const sid = backend.CreateSession();
    backend.SessionSetFile(sid, '../../fixtures/test.xlsx');

    const dataRange = {
        sheet: 'Cool Data',
        start: {row: 3, column: 0},
        end: {row: 5, column: 2}};

    // There are three rows available in the range. Let's see how the sampling
    // functions allocate them if we ask for too many sample rows.

    // 10:10:10 -> 1:0:2 because we reduce middleCount first, then split the difference, rounding towards endCount
    const samples1 = backend.SessionGetInputSampleRows(sid, dataRange,
                                                      10, 10, 10);
    expect(samples1).toMatchObject([
        [ [ 'Boris', '13', 'High' ] ],
        [ ],
        [ [ 'Nelly', '14', 'High' ],
          [ 'Sid', '10', 'Medium' ] ]
    ]);

    // Let's see if only middleCount is clamped if startCount and endCount are reasonable
    const samples2 = backend.SessionGetInputSampleRows(sid, dataRange,
                                                      1, 10, 1);
    expect(samples2).toMatchObject([
        [ [ 'Boris', '13', 'High' ] ],
        [ [ 'Nelly', '14', 'High' ] ],
        [ [ 'Sid', '10', 'Medium' ] ]
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

});

test('sampling algorithm', () => {
    const sid = backend.CreateSession();
    backend.SessionSetFile(sid, '../../fixtures/test.xlsx');

    const dataRange = {
        sheet: 'Cool Data',
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
        [ 'Boris', '13', 'High' ],
        [ 'Nelly', '14', 'High' ],
        [ 'Sid', '10', 'Medium' ]]);

    // Now pick 1
    const samples2 = backend.SessionGetInputSampleRows(sid, dataRange,
                                                       0, 1, 0);

    // No rows in the start and end samples, 1 row in the middle sample
    expect(samples2[0]).toHaveLength(0);
    expect(samples2[1]).toHaveLength(1);
    expect(samples2[2]).toHaveLength(0);
    expect([
        [ 'Boris', '13', 'High' ],
        [ 'Nelly', '14', 'High' ],
        [ 'Sid', '10', 'Medium' ]]).toContainEqual(samples2[1][0]);

    // FIXME: Do 100 samples of 1 record, ensuring we get a roughly equal distribution of results


    // Now pick 2
    const samples3 = backend.SessionGetInputSampleRows(sid, dataRange,
                                                       0, 2, 0);

    // No rows in the start and end samples, 2 rows in the middle sample
    expect(samples3[0]).toHaveLength(0);
    expect(samples3[1]).toHaveLength(2);
    expect(samples3[2]).toHaveLength(0);
    expect([ // Sid can't be first, if there's two rows and they're in order
        [ 'Boris', '13', 'High' ],
        [ 'Nelly', '14', 'High' ]]).toContainEqual(samples3[1][0]);
    expect([ // Boris can't be second, if there's two rows and they're in order
        [ 'Nelly', '14', 'High' ],
        [ 'Sid', '10', 'Medium' ]]).toContainEqual(samples3[1][1]);
    // Test they're not equal.
    expect(samples3[1][0]).not.toMatchObject(samples3[1][1]);
});
