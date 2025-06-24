const attributeTypes = require('./attribute-types');

test('required basic string', () => {
  // Also tests the workings of the requiredType system
  const t = attributeTypes.requiredType(attributeTypes.basicStringType);

  let r = t({v:undefined});
  expect(r.valid).toBeFalsy();
  expect(r.warnings).toMatchObject([]);
  expect(r.errors).toMatchObject(["A value must be provided"]);

  r = t({v:""});
  expect(r.valid).toBeFalsy();
  expect(r.warnings).toMatchObject([]);
  expect(r.errors).toMatchObject(["A value must be provided"]);

  r = t({v:"foo"});
  expect(r.valid).toBeTruthy();
  expect(r.value).toEqual("foo");
  expect(r.warnings).toMatchObject([]);

  r = t({v:123});
  expect(r.valid).toBeTruthy();
  expect(r.value).toEqual("123");
  expect(r.warnings).toMatchObject([]);
});

test('optional basic string', () => {
  // Also tests the workings of the optionalType system
  const t = attributeTypes.optionalType(attributeTypes.basicStringType);

  let r = t({v:undefined});
  expect(r.valid).toBeTruthy();
  expect(r.warnings).toMatchObject([]);
  expect(r.value).toEqual(undefined);

  r = t({v:""});
  expect(r.valid).toBeTruthy();
  expect(r.warnings).toMatchObject([]);
  expect(r.value).toEqual(undefined);

  r = t({v:"foo"});
  expect(r.valid).toBeTruthy();
  expect(r.value).toEqual("foo");
  expect(r.warnings).toMatchObject([]);

  r = t({v:123});
  expect(r.valid).toBeTruthy();
  expect(r.value).toEqual("123");
  expect(r.warnings).toMatchObject([]);
});

test('required basic number', () => {
  const t = attributeTypes.requiredType(attributeTypes.basicNumberType);

  let r = t({v:"foo"});
  expect(r.valid).toBeFalsy();
  expect(r.warnings).toMatchObject([]);
  expect(r.errors).toMatchObject(["This is not a valid number"]);

  r = t({v:123});
  expect(r.valid).toBeTruthy();
  expect(r.value).toEqual(123);
  expect(r.warnings).toMatchObject([]);
});

test('optional basic number', () => {
  // Also tests that optionalType converts errors into warnings
  const t = attributeTypes.optionalType(attributeTypes.basicNumberType);

  let r = t({v:"foo"});
  expect(r.valid).toBeTruthy();
  expect(r.value).toBeUndefined();
  expect(r.warnings).toMatchObject(["This is not a valid number"]);

  r = t({v:123});
  expect(r.valid).toBeTruthy();
  expect(r.value).toEqual(123);
  expect(r.warnings).toMatchObject([]);
});
