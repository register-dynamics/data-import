const backend = require('./backend');

test('happy path', () => {
    const sid = backend.CreateSession();
    backend.SessionSetFile(sid, '../../fixtures/test.xlsx');

    const inputStructure = backend.SessionGetInputStructure(sid);
    expect(inputStructure).toMatchObject({
        sheets: {
            'Cool Data': {
                rows: 7,
                columns: 7,
            },
        },
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
    expect(jobSummary).toMatchObject([3,0,0]);

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
