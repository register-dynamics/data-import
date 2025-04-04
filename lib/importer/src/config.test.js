var assert = require('assert');
const cfg = require('./config');
const fs = require('node:fs');
const mock_files = require('mock-fs');


function fieldHelper(name, typ = "text", required = true) {
    return {
        name: name, type: typ, required: required
    }
}

describe("Configuration tests", () => {

    test('initial empty config', () => {
        mock_files({
            './empty/app/config.json': '{}'
        })

        withCurrent(
            "./empty",
            new cfg.PluginConfig(),
            (c) => {
                c.setFields([fieldHelper("A")])
                c.persistConfig()
            },
            (original, updated, c) => {
                expect(original.fields).toBeUndefined()
                expect(updated.fields[0].name).toStrictEqual("A")
                expect(c.fields[0].name).toStrictEqual("A")

                // We expect a non-null value by default, but can't construct something
                // to compare against as the tmp directory given may be different on
                // each call
                expect(original.uploadPath).not.toBeNull()
                expect(updated.uploadPath).not.toBeNull()
                expect(c.uploadPath).not.toBeNull()
            }
        );

        mock_files.restore();
    });

    test('existing fields', () => {
        mock_files({
            './fields/app/config.json': '{"fields": [{"name":"A"}, {"name": "B"}, {"name": "C"}]}',
        })

        withCurrent(
            "./fields",
            new cfg.PluginConfig(),
            (c) => {
                c.setFields([fieldHelper("A"), fieldHelper("B")])
                c.persistConfig()
            },
            (original, updated, c) => {
                expect(original.fields.map((x) => x.name)).toStrictEqual(["A", "B", "C"])
                expect(updated.fields.map((x) => x.name)).toStrictEqual(["A", "B"])
                expect(c.fields.map((x) => x.name)).toStrictEqual(["A", "B"])
            }
        );

        mock_files.restore();
    });

    test('migration from only field name to inc type and required', () => {
        mock_files({
            './fields/app/config.json': '{"fields": [{"name":"A"}, {"name": "B"}, {"name": "C"}]}',
        })

        withCurrent(
            "./fields",
            new cfg.PluginConfig(),
            (c) => {
                c.setFields([fieldHelper("A"), fieldHelper("B")])
                c.persistConfig()
            },
            (original, updated, c) => {
                expect(original.fields.map((x) => x.name)).toStrictEqual(["A", "B", "C"])
                expect(updated.fields.map((x) => x.name)).toStrictEqual(["A", "B"])
                expect(c.fields.map((x) => x.name)).toStrictEqual(["A", "B"])
                expect(c.fields.map((x) => x.type)).toStrictEqual(["text", "text"])
                expect(c.fields.map((x) => x.required)).toStrictEqual([true, true])
            }
        );

        mock_files.restore();
    });

    test('supports new field structure', () => {
        mock_files({
            './fields/app/config.json': '{"fields": [{"name":"A", "type": "number"}, {"name": "B"}, {"name": "C"}]}',
        })

        withCurrent(
            "./fields",
            new cfg.PluginConfig(),
            (c) => {
                c.setFields([fieldHelper("A"), fieldHelper("B", "number")])
                c.persistConfig()
            },
            (original, updated, c) => {
                expect(original.fields.map((x) => x.name)).toStrictEqual(["A", "B", "C"])
                expect(updated.fields.map((x) => x.name)).toStrictEqual(["A", "B"])
                expect(c.fields.map((x) => x.name)).toStrictEqual(["A", "B"])
                expect(c.fields.map((x) => x.type)).toStrictEqual(["text", "number"])
                expect(c.fields.map((x) => x.required)).toStrictEqual([true, true])
            }
        );

        mock_files.restore();
    });

    test('existing path', () => {
        mock_files({
            './path/app/config.json': '{"uploadPath": "/tmp"}',
        })

        withCurrent(
            "./path",
            new cfg.PluginConfig(),
            (c) => {
                c.setUploadPath("/opt")
                c.persistConfig()
            },
            (original, updated, c) => {
                expect(original.uploadPath).toBe("/tmp")
                expect(updated.uploadPath).toBe("/opt")
                expect(c.uploadPath).toBe("/opt")
            }
        );

        mock_files.restore();
    });

})


// withCurrent is a helper function which is used to load a plugin config
// apply some changes, and then assert the expectations of the state.
//
//      rootFolder is the folder where the `app/config.json` can
//      be found in this test.
//
//      pluginConfig is a newly constructed PluginConfig
//
//      cbFunction is a callback function that will be given the
//      plugin configuration so that changes can be made via its API.
//
//      assertionsFunc is a function that is provided with:
//          * the original json object (before cbFunction was called)
//          * the new json object post-cbFunction
//          * the pluginConfig that was modified by cbFunction
function withCurrent(rootFolder, pluginConfig, cbFunction, assertionsFunc) {
    assert(typeof (cbFunction) === 'function')
    assert(typeof (assertionsFunc) === 'function')
    process.env.KIT_PROJECT_DIR = rootFolder
    const original = JSON.parse(fs.readFileSync(pluginConfig.configPath, 'utf8'));
    cbFunction(pluginConfig)
    const updated = JSON.parse(fs.readFileSync(pluginConfig.configPath, 'utf8'));
    assertionsFunc(original, updated, pluginConfig)
}
