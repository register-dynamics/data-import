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
        [ [ 'Boris', 13, 'High' ] ],
        [ [ 'Nelly', 14, 'High' ] ],
        [ [ 'Sid', 10, 'Medium' ] ]
    ]);

    const values = backend.SessionGetInputValues(sid, dataRange, 2);
    expect(values).toMatchObject([
        { values: [ 'Boris', 'Nelly' ], hasMore: true },
        { values: [ 13, 14 ], hasMore: true },
        { values: [ 'High', 'Medium' ], hasMore: false }
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

test('sample clamping', () => {
    const sid = backend.CreateSession();
    backend.SessionSetFile(sid, '../../fixtures/test.xlsx');

    const dataRange = {
        sheet: 'Cool Data',
        start: {row: 3, column: 0},
        end: {row: 5, column: 2}};

    // There are three rows in the range. Let's ask for a 10:10:10 sample; that should be rewritten to 1:0:2
    const samples1 = backend.SessionGetInputSampleRows(sid, dataRange,
                                                      10, 10, 10);
    expect(samples1).toMatchObject([
        [ [ 'Boris', 13, 'High' ] ],
        [ ],
        [ [ 'Nelly', 14, 'High' ],
          [ 'Sid', 10, 'Medium' ] ]
    ]);

    // Let's see if only middleCount is clamped if startCount and endCount are reasonable
    const samples2 = backend.SessionGetInputSampleRows(sid, dataRange,
                                                      1, 10, 1);
    expect(samples2).toMatchObject([
        [ [ 'Boris', 13, 'High' ] ],
        [ [ 'Nelly', 14, 'High' ] ],
        [ [ 'Sid', 10, 'Medium' ] ]
    ]);

    // Ok, now check the same works for job result sampling

    const mapping = {
        attributeMappings: {
            Name: 0,
            Age: 1,
            Egginess: 2
        },
    };

    // Do a mapping

    const jid = backend.SessionPerformMappingJob(sid, dataRange, mapping);

    const sampleRecords1 = backend.JobGetSampleRecords(jid, 10, 10, 10);
    expect(sampleRecords1).toMatchObject([
        [ { Name: 'Boris', Age: 13, Egginess: 'High' } ],
        [  ],
        [ { Name: 'Nelly', Age: 14, Egginess: 'High' },
          { Name: 'Sid', Age: 10, Egginess: 'Medium' } ]
    ]);

    const sampleRecords2 = backend.JobGetSampleRecords(jid, 1, 10, 1);
    expect(sampleRecords2).toMatchObject([
        [ { Name: 'Boris', Age: 13, Egginess: 'High' } ],
        [ { Name: 'Nelly', Age: 14, Egginess: 'High' } ],
        [ { Name: 'Sid', Age: 10, Egginess: 'Medium' } ]
    ]);

});
