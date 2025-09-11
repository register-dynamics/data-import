class Range {
    constructor(sheet, start, end) {
        // start and end: { row: Number, column: Number }
        if (!sheet || !start || !end) {
            throw new Error('Range requires sheet, start, and end');
        }
        this.sheet = sheet;
        this.start = {
            row: Math.min(start.row, end.row),
            column: Math.min(start.column, end.column)
        };
        this.end = {
            row: Math.max(start.row, end.row),
            column: Math.max(start.column, end.column)
        };
    }

    // Returns true if the range is valid (end >= start for both row and column)
    isValid() {
        return this.end.row >= this.start.row && this.end.column >= this.start.column;
    }

    // Apply a function to each row index in the range
    // inclusive=true: includes end row (default, spreadsheet style)
    // inclusive=false: excludes end row (half-open interval)
    applyRows(fn, inclusive = true) {
        const end = inclusive ? this.end.row : this.end.row - 1;
        for (let r = this.start.row; r <= end; r++) {
            fn(r);
        }
    }


    // Inclusive row indices
    *rows(inclusive = true) {
        const end = inclusive ? this.end.row : this.end.row - 1;
        for (let r = this.start.row; r <= end; r++) {
            yield r;
        }
    }

    // Inclusive column indices
    *columns(inclusive = true) {
        const end = inclusive ? this.end.column : this.end.column - 1;
        for (let c = this.start.column; c <= end; c++) {
            yield c;
        }
    }

    // Iterate over all cells (row, col) in the range
    *cells(inclusive = true) {
        const endRow = inclusive ? this.end.row : this.end.row - 1;
        const endCol = inclusive ? this.end.column : this.end.column - 1;
        for (let r = this.start.row; r <= endRow; r++) {
            for (let c = this.start.column; c <= endCol; c++) {
                yield { row: r, column: c };
            }
        }
    }

    // Number of rows in the range
    numRows(inclusive = true) {
        return (this.end.row - this.start.row) + (inclusive ? 1 : 0);
    }

    // Number of columns in the range
    numCols(inclusive = true) {
        return (this.end.column - this.start.column) + (inclusive ? 1 : 0);
    }

    // Area (number of cells) in the range
    area(inclusive = true) {
        return this.numRows(inclusive) * this.numCols(inclusive);
    }

    // Convert column index to Base26 (A, B, ..., Z, AA, AB, ...)
    static colToBase26(column) {
        // Use the base26 utility, which expects 1-based input
        const base26 = require('./base26');
        return base26.toBase26(column + 1);
    }

    // Convert row index to 1-based (spreadsheet style)
    static rowTo1Based(row) {
        return (row + 1).toString();
    }

    // Get Base26 notation for start cell (e.g., "A1")
    get startBase26() {
        return `${Range.colToBase26(this.start.column)}${Range.rowTo1Based(this.start.row)}`;
    }

    // Get Base26 notation for end cell (e.g., "C10")
    get endBase26() {
        return `${Range.colToBase26(this.end.column)}${Range.rowTo1Based(this.end.row)}`;
    }

    // Get A1-style range string (e.g., "Sheet1!A1:C10")
    toA1String() {
        return `${this.sheet}!${this.startBase26}:${this.endBase26}`;
    }
}

module.exports = Range;
