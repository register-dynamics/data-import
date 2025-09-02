const { InclusiveRange, ExclusiveRange, Range } = require('./range');

describe('InclusiveRange', () => {
  test('apply calls fn for each value in range', () => {
    const r = new InclusiveRange(3, 6);
    const results = [];
    r.apply((v) => results.push(v * 2));
    expect(results).toEqual([6, 8, 10, 12]);
  });
  test('constructs with valid bounds', () => {
    const r = new InclusiveRange(1, 5);
    expect(r.lower).toBe(1);
    expect(r.upper).toBe(5);
  });

  test('throws with invalid bounds', () => {
    expect(() => new InclusiveRange(5, 1)).toThrow(RangeError);
    expect(() => new InclusiveRange('a', 5)).toThrow(TypeError);
    expect(() => new InclusiveRange(1, 'b')).toThrow(TypeError);
  });

  test('toArray returns all values inclusive', () => {
    expect(new InclusiveRange(1, 3).toArray()).toEqual([1, 2, 3]);
    expect(new InclusiveRange(-2, 0).toArray()).toEqual([-2, -1, 0]);
  });

  test('iterator yields all values inclusive', () => {
    const r = new InclusiveRange(2, 4);
    expect([...r]).toEqual([2, 3, 4]);
  });

  test('contains works', () => {
    const r = new InclusiveRange(10, 15);
    expect(r.contains(10)).toBe(true);
    expect(r.contains(15)).toBe(true);
    expect(r.contains(12)).toBe(true);
    expect(r.contains(9)).toBe(false);
    expect(r.contains(16)).toBe(false);
  });

  test('size returns correct count', () => {
    expect(new InclusiveRange(1, 1).size()).toBe(1);
    expect(new InclusiveRange(1, 5).size()).toBe(5);
    expect(new InclusiveRange(-2, 2).size()).toBe(5);
  });
});

describe('ExclusiveRange', () => {
  test('apply calls fn for each value in range', () => {
    const r = new ExclusiveRange(3, 6);
    const results = [];
    r.apply((v) => results.push(v * 3));
    expect(results).toEqual([9, 12, 15]);
  });
  test('constructs with valid bounds', () => {
    const r = new ExclusiveRange(1, 5);
    expect(r.lower).toBe(1);
    expect(r.upper).toBe(5);
  });

  test('throws with invalid bounds', () => {
    expect(() => new ExclusiveRange(5, 1)).toThrow(RangeError);
    expect(() => new ExclusiveRange(1, 1)).toThrow(RangeError);
    expect(() => new ExclusiveRange('a', 5)).toThrow(TypeError);
    expect(() => new ExclusiveRange(1, 'b')).toThrow(TypeError);
  });

  test('toArray returns all values exclusive', () => {
    expect(new ExclusiveRange(1, 4).toArray()).toEqual([1, 2, 3]);
    expect(new ExclusiveRange(-2, 1).toArray()).toEqual([-2, -1, 0]);
  });

  test('iterator yields all values exclusive', () => {
    const r = new ExclusiveRange(2, 5);
    expect([...r]).toEqual([2, 3, 4]);
  });

  test('contains works', () => {
    const r = new ExclusiveRange(10, 15);
    expect(r.contains(10)).toBe(true);
    expect(r.contains(14)).toBe(true);
    expect(r.contains(15)).toBe(false);
    expect(r.contains(9)).toBe(false);
    expect(r.contains(16)).toBe(false);
  });

  test('size returns correct count', () => {
    expect(new ExclusiveRange(1, 2).size()).toBe(1);
    expect(new ExclusiveRange(1, 5).size()).toBe(4);
    expect(new ExclusiveRange(-2, 2).size()).toBe(4);
  });
});

describe('Range alias', () => {
  test('Range is an alias for InclusiveRange', () => {
    const r1 = new Range(1, 3);
    const r2 = new InclusiveRange(1, 3);
    expect(r1.toArray()).toEqual(r2.toArray());
    expect([...r1]).toEqual([...r2]);
    expect(r1.contains(2)).toBe(true);
    expect(r1.size()).toBe(3);
  });
});
