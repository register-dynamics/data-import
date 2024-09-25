const attributeTypes = require('./attribute-types');

function testType(t, invalidInputs, fixtures) {
  for([input,warnings,errors] of invalidInputs) {
    expect(t.validate(input)).toMatchObject([warnings, errors]);
  }

  for ([input, output] of fixtures) {
    expect(t.validate(input)).toMatchObject([[],[]]);
    expect(t.translate(input)).toEqual(output);
  }
};

test('basic string', () => {
  const invalidInputs = [
    [undefined, [], ["A value must be provided"]],
    ["", [], ["A value must be provided"]]
  ];

  const fixtures = [
    ["foo", "foo"],
    [123, "123"],
  ];

  testType(attributeTypes.basicStringType, invalidInputs, fixtures);
});

test('optional basic string', () => {
  const invalidInputs = [];

  const fixtures = [
    ["foo", "foo"],
    [123, "123"],
    ["", undefined],
    [undefined, undefined]
  ];

  testType(attributeTypes.optionalType(attributeTypes.basicStringType), invalidInputs, fixtures);
});

test('basic number', () => {
  const invalidInputs = [
    [undefined, [], ["A value must be provided"]],
    ["", [], ["A value must be provided"]],
    ["foo", [], ["foo is not a valid number"]]
  ];

  const fixtures = [
    [123, 123],
    ["123", "123"],
  ];

  testType(attributeTypes.basicNumberType, invalidInputs, fixtures);
});
