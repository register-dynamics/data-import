const Range = require('./range');

describe('Range', () => {
  test('applyRows applies function to each row (inclusive)', () => {
    const r = new Range('Sheet1', { row: 2, column: 0 }, { row: 4, column: 1 });
    const rows = [];
    r.applyRows((rowIdx) => rows.push(rowIdx));
    expect(rows).toEqual([2, 3, 4]);
  });

  test('applyRows applies function to each row (exclusive)', () => {
    const r = new Range('Sheet1', { row: 2, column: 0 }, { row: 4, column: 1 });
    const rows = [];
    r.applyRows((rowIdx) => rows.push(rowIdx), false);
    expect(rows).toEqual([2, 3]);
  });

  const sheet = 'Sheet1';
  const start = { row: 1, column: 2 }; // C2
  const end = { row: 3, column: 4 };   // E4

  test('constructs and normalizes start/end', () => {
    const r = new Range(sheet, end, start); // reversed
    expect(r.sheet).toBe(sheet);
    expect(r.start).toEqual({ row: 1, column: 2 });
    expect(r.end).toEqual({ row: 3, column: 4 });
  });

  test('rows() yields correct indices (inclusive/exclusive)', () => {
    const r = new Range(sheet, start, end);
    expect([...r.rows()]).toEqual([1, 2, 3]);
    expect([...r.rows(false)]).toEqual([1, 2]);
  });

  test('columns() yields correct indices (inclusive/exclusive)', () => {
    const r = new Range(sheet, start, end);
    expect([...r.columns()]).toEqual([2, 3, 4]);
    expect([...r.columns(false)]).toEqual([2, 3]);
  });

  test('cells() yields all cell coordinates (inclusive/exclusive)', () => {
    const r = new Range(sheet, start, end);
    const allCells = [...r.cells()];
    expect(allCells.length).toBe(9); // 3 rows x 3 cols
    expect(allCells[0]).toEqual({ row: 1, column: 2 });
    expect(allCells[8]).toEqual({ row: 3, column: 4 });
    const exclCells = [...r.cells(false)];
    expect(exclCells.length).toBe(4); // 2 rows x 2 cols
    expect(exclCells[0]).toEqual({ row: 1, column: 2 });
    expect(exclCells[3]).toEqual({ row: 2, column: 3 });
  });

  test('numRows, numCols, area (inclusive/exclusive)', () => {
    const r = new Range(sheet, start, end);
    expect(r.numRows()).toBe(3);
    expect(r.numRows(false)).toBe(2);
    expect(r.numCols()).toBe(3);
    expect(r.numCols(false)).toBe(2);
    expect(r.area()).toBe(9);
    expect(r.area(false)).toBe(4);
  });

  test('colToBase26 converts indices to spreadsheet letters', () => {
    expect(Range.colToBase26(0)).toBe('A');
    expect(Range.colToBase26(25)).toBe('Z');
    expect(Range.colToBase26(26)).toBe('AA');
    expect(Range.colToBase26(27)).toBe('AB');
    expect(Range.colToBase26(51)).toBe('AZ');
    expect(Range.colToBase26(52)).toBe('BA');
  });

  test('rowTo1Based converts indices to 1-based strings', () => {
    expect(Range.rowTo1Based(0)).toBe('1');
    expect(Range.rowTo1Based(9)).toBe('10');
  });

  test('startBase26 and endBase26 getters', () => {
    const r = new Range(sheet, start, end);
    expect(r.startBase26).toBe('C2');
    expect(r.endBase26).toBe('E4');
  });

  test('toA1String returns correct A1 notation', () => {
    const r = new Range(sheet, start, end);
    expect(r.toA1String()).toBe('Sheet1!C2:E4');
  });

  test('throws if missing arguments', () => {
    expect(() => new Range()).toThrow();
    expect(() => new Range(sheet)).toThrow();
    expect(() => new Range(sheet, start)).toThrow();
  });
});
