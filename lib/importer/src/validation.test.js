/**
 * Validation tests
 */

const session = require('./session');
const backend = require('./backend');
const attributeTypes = require('./attribute-types');
const mock_files = require('mock-fs');


describe("Validation tests", () => {

    test('Validation happy path', () => {
        const sess = createTestSession([{ name: 'field', type: 'text', required: false }], "validation-test.csv")
        expect(sess).not.toBe(null);

        const config = {
            fields: [
                fieldHelper("Title", "text", false),
                fieldHelper("First name", "text", false),
                fieldHelper("Surname", "text", false),
                fieldHelper("Employee number", "text", false),
                fieldHelper("Employment start date", "text", false),
                fieldHelper("Salary", "text", false),
                fieldHelper("Contribution percentage", "text", false),
                fieldHelper("Payment date", "text", false),
            ]
        }

        withCleanup(() => {
            // Mock the config file and tell this test that it is the current directory
            mock_files({
                './empty/app/config.json': JSON.stringify(config)
            })
            process.env.KIT_PROJECT_DIR = './empty/app/config.json'

            const dataRange = {
                sheet: "Sheet1",
                start: { row: 0, column: 0 },
                end: { row: 2, column: 10 }
            };

            const mapping = createTestMapping(
                {
                    0: "Title",
                    1: "First name",
                    2: "Surname",
                    3: "Employee number",
                    4: "Employment start date",
                    5: "Salary",
                    6: "Contribution percentage",
                    7: "Payment date"

                }, config.fields
            )

            const jid = backend.SessionPerformMappingJob(sess.id, dataRange, mapping);

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


        }, () => {
            mock_files.restore();
        });
    });
});



function withCleanup(fn, cleanup) {
    try {
        fn();
    } finally {
        cleanup();
    }
}

const createTestSession = (fields, fixture) => {
    const response = session.CreateSession(
        { fields: fields, uploadPath: "../../fixtures" },
        {
            file: {
                mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                filename: fixture
            }
        }
    );

    backend.SessionSetFile(response.session.id, "../../fixtures/" + fixture);
    return response.session;
}

const createTestMapping = (mapping, fields) => {
    // Convert session.mapping (a map from column index -> attribute name) into a mapping for the backend
    let rewrittenMapping = new Map();
    const attrTypes = {}

    for (const [columnIndex, attributeName] of Object.entries(mapping)) {
        if (attributeName !== null && attributeName !== undefined && attributeName != '') {
            rewrittenMapping[attributeName] = parseInt(columnIndex);
        }

        const f = fields.find((x) => x.name == attributeName)
        if (f) {
            attrTypes[f.name] = attributeTypes.mapperForField(f)
        }
    }

    return {
        attributeMappings: rewrittenMapping,
        attributeTypes: attrTypes
    };
}

const fieldHelper = (name, typ = "text", required = true) => {
    return {
        name: name, type: typ, required: required
    }
}
