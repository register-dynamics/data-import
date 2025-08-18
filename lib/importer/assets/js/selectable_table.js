/*
  Accessability TODOs:

  - Implement all of the data grid keyboard commands in https://www.w3.org/WAI/ARIA/apg/patterns/grid/: Page Up, Page Down, Home, End, Ctrl+Home, Ctrl+End, Ctrl+Space, Shift+Space

  */

const get_platform = () =>  {
  // userAgentData is not widely supported yet
  if (typeof navigator.userAgentData !== 'undefined' && navigator.userAgentData != null) {
      return navigator.userAgentData.platform;
  }
  // Currently deprecated
  if (typeof navigator.platform !== 'undefined') {
      return navigator.platform;
  }
  return 'unknown';
}

window.addEventListener("load", function() {
    const isMac = /mac/i.test(get_platform())

    const CellSelectedClassName = "selected";
    const CellSelectedBottomClassName = "bottom";
    const CellSelectedTopClassName = "top";
    const CellSelectedLeftClassName = "left";
    const CellSelectedRightClassName = "right";
    const CellSelectedFocusClassName = "focus";
    const CellSelectedClasses = [
      CellSelectedClassName,
      CellSelectedFocusClassName,
      CellSelectedBottomClassName,
      CellSelectedTopClassName,
      CellSelectedLeftClassName,
      CellSelectedRightClassName
    ];

    const tlRowTarget = document.getElementById("importer:selection:TLRow");
    const tlColTarget = document.getElementById("importer:selection:TLCol");
    const brRowTarget = document.getElementById("importer:selection:BRRow");
    const brColTarget = document.getElementById("importer:selection:BRCol");

    const fromCoordsCache = new Map(); // table -> "row,col" -> CellRef
    const fromNodeCache = new Map(); // td node -> CellRef

    // From waffle.scm
    const InputElementsSelector = "input, button, select, textarea, xmlarea, isindex";

    const SingleClickFocusElementsSelector = [
      "select",
      "button",
      "input[type='checkbox']",
      "input[type='file']"
    ].join(", ");

    // https://stackoverflow.com/a/30753870/3729369
    const FocusableElementsXPaths = [
      "a[@href]",
      "area[@href]",
      "input",
      "select",
      "textarea",
      "button",
      "iframe",
      "*[@tabindex]",
      "*[@contentEditable=true]"
    ].map(x => x + "[not(@tabindex='-1')]")

    const FocusableElementsOutsideTable = FocusableElementsXPaths
      .map(x => "//" + x + "[not(ancestor::table[contains(@class, 'selectable')])]")
      .join("|")  ;

    let EventState = class {

      /*
        A map of event states that you want to go full-screen to view because
        it's wide, but believe me, it's impossible to read when I wrote it as a
        tree:

| EventState            | Event handlers active in this state                                                                           | When we enter                                        | When we leave                                        |
|-----------------------+---------------------------------------------------------------------------------------------------------------+------------------------------------------------------+------------------------------------------------------|
| DocumentSelectMode    | keydown -> function updateFromKeyEvent, function selectModeKeyboardShortcuts                                  | function cellSelectMode                              | function cellEditMode                                |
|                       | keyup -> function updateFromKeyEvent                                                                          | function tableFocusIn                                | function loseFocus                                   |
|                       | click -> function loseFocus -> -DocumentSelectMode, +DocumentUnfocusedMode                                    | function getFocus                                    |                                                      |
|                       | cut -> function cutSelection                                                                                  |                                                      |                                                      |
|                       | copy -> function copySelection                                                                                |                                                      |                                                      |
|                       | paste -> function pasteSelection                                                                              |                                                      |                                                      |
|-----------------------+---------------------------------------------------------------------------------------------------------------+------------------------------------------------------+------------------------------------------------------|
| DocumentEditMode      | keydown -> function editModeKeyboardShortcuts                                                                 | function cellEditMode                                | function cellSelectMode                              |
|-----------------------+---------------------------------------------------------------------------------------------------------------+------------------------------------------------------+------------------------------------------------------|
| DocumentUnfocusedMode | mousedown -> getFocus -> +DocumentSelectMode, -DocumentUnfocusedMode                                          | function loseFocus                                   | function tableFocusIn                                |
|                       |                                                                                                               | initialisation                                       | function getFocus                                    |
|-----------------------+---------------------------------------------------------------------------------------------------------------+------------------------------------------------------+------------------------------------------------------|
| TableSelectMode       | selectstart -> function preventDefault                                                                        | function cellSelectMode                              | function cellEditMode                                |
|                       | mousedown -> function startDrag                                                                               | function tableFocusIn                                |                                                      |
|                       |                                                                                                               | initialisation                                       |                                                      |
|-----------------------+---------------------------------------------------------------------------------------------------------------+------------------------------------------------------+------------------------------------------------------|
| TableEditMode         |                                                                                                               | function cellEditMode                                | function cellSelectMode                              |
|-----------------------+---------------------------------------------------------------------------------------------------------------+------------------------------------------------------+------------------------------------------------------|
| TableUnfocusedMode    | focusIn -> tableFocusIn -> -DocumentUnfocusedMode, -TableUnfocusedMode, +TableSelectMode, +DocumentSelectMode | function loseFocus                                   | function tableFocusIn                                |
|                       |                                                                                                               |                                                      | function getFocus                                    |
|-----------------------+---------------------------------------------------------------------------------------------------------------+------------------------------------------------------+------------------------------------------------------|
| InputSelectMode       | mousedown -> function preventInputFocus, function removeFocus                                                 | function cellSelectMode (input elements inside cell) | function cellEditMode (input elements inside cell)   |
|                       | click -> function preventInputFocus                                                                           | initialisation ("new row"/"new column" logic?!?)     |                                                      |
|                       | focus -> function enterCell                                                                                   | initialisation (all input elements in table)         |                                                      |
|                       | blur -> function leaveCell                                                                                    |                                                      |                                                      |
|-----------------------+---------------------------------------------------------------------------------------------------------------+------------------------------------------------------+------------------------------------------------------|
| InputEditMode         | blur -> function leaveCell                                                                                    | function cellEditMode (input elements inside cell)   | function cellSelectMode (input elements inside cell) |
|-----------------------+---------------------------------------------------------------------------------------------------------------+------------------------------------------------------+------------------------------------------------------|
| InputAliveState       | input -> function autoResize, (function createNewRows/function createNewColumns?), function addRowClasses     | initialisation ("new row"/"new column" logic?!?)     |                                                      |
|                       | change -> function autoResize, (function createNewRows/function createNewColumns?), function addRowClasses    | initialisation (all input elements in table)         |                                                      |
|-----------------------+---------------------------------------------------------------------------------------------------------------+------------------------------------------------------+------------------------------------------------------|

      */

      constructor(name) {
        this.name = name;
        this.events = [];
      }

      enter(element) {
        console.debug(element.nodeName + ": entering " + this.name + " mode");
        for (var event of this.events) {
          console.debug("\tAdd " + event.handler.name + " as handler for " + event.name);
          element.addEventListener(event.name, event.handler);
        }
      }

      leave(element) {
        console.debug(element.nodeName + ": leaving " + this.name + " mode");
        for (var event of this.events) {
          console.debug("\tRemove " + event.handler.name + " as handler for " + event.name);
          element.removeEventListener(event.name, event.handler);
        }
      }

      addEvent(name, handler) {
        this.events.push({name: name, handler: handler});
      }
    }

    let DocumentSelectMode = new EventState("select");
    let DocumentEditMode = new EventState("edit");
    let DocumentUnfocusedMode = new EventState("unfocused");

    let CellRef = class {
      constructor(element) {
        this.node = element.closest("td, th");
        if(!this.node) {
          console.log("CANNOT FIND ENCLOSING TABLE CELL", element);
        }
        this.rowspan = this.node.rowSpan; // Record these for use in TableSelection's constructor
        this.colspan = this.node.colSpan;

        this.table = this.node.closest("table");

        // Find the cell, by walking down the table from the top left

        // We need to scan every row above the cell, in order to find cells that
        // rowspan down to later rows, as any rowspans that encroach on the row
        // of our target cell to the left of it will create virtual cells
        // without a corresponding <td>, and we need to account for them in
        // calculating the column index.

        //  0,0    (1,0) |  2,0
        //               +------
        // (0,1)   (1,1) |  2,1

        // ...if the node selected is 2,1 then it's actually the first <td> on
        // that <tr>, but it's column index 2 nonetheless due to the two cells
        // from 0,0 which has colspan=2 rowspan=2.

        const rowspans = new Map(); // Column index -> row index where current rowspan for that colum ends
        for(let rowIdx=0;rowIdx<this.table.rows.length;rowIdx++) {
          const row = this.table.rows[rowIdx];
          let colLogicalIdx = 0; // Actual column index, accounting for virtual cells
          for(let colIdx=0;colIdx<row.cells.length;colIdx++) {
            // advance colLogicalIdx, taking note of rowspans that are adding extra cells to this row
            while(true) {
              const rowspanUntil = rowspans.get(colLogicalIdx) || -1;
              if(rowspanUntil >= rowIdx) {
                colLogicalIdx++;
              } else {
                break;
              }
            }

            const currentCell = row.cells[colIdx];
            const colspan = currentCell.colSpan || 1;
            const rowspan = currentCell.rowSpan || 1;

            if(currentCell == this.node) {
              // Found it!
              this.col = colLogicalIdx;
              this.row = rowIdx;
              this.endRow = this.row + this.rowspan - 1;
              this.endCol = this.col + this.colspan - 1;
              return;
            }

            // Record rowspan ending rows for every column we touch
            for(let i=0;i<colspan;i++) {
              if(rowspan > 1) {
                rowspans.set(colLogicalIdx+i, rowIdx+rowspan-1);
              } else {
                rowspans.set(colLogicalIdx+i, -1);
              }
            }

            // Advance logical index, although it may be advanced more on the next loop iteration
            colLogicalIdx+=colspan;
          }
        }
      };

      get left()  { return CellRef.fromCoords(this.table, this.row + 0, this.col - 1); }
      get right() { return CellRef.fromCoords(this.table, this.row + 0, this.col + this.colspan); }
      get above() { return CellRef.fromCoords(this.table, this.row - 1, this.col + 0); }
      get below() { return CellRef.fromCoords(this.table, this.row + this.rowspan, this.col + 0); }

      equals(cell) {
        return this.table == cell.table &&
          this.row == cell.row &&
          this.col == cell.col;
      }

      static fromNode(node) {
        if(fromNodeCache.has(node)) {
          const cell = fromNodeCache.get(node);
          return cell;
        } else {
          const ref = new CellRef(node);
          fromNodeCache.set(node, ref);
          return ref;
        }
      }

      static fromCoords(table, row, col) {
        const cacheKey = row + "," + col;
        if (fromCoordsCache.has(table) && fromCoordsCache.get(table).has(cacheKey)) {
          const cell = fromCoordsCache.get(table).get(cacheKey);
          return cell;
        }
        if (!fromCoordsCache.has(table)) {
          fromCoordsCache.set(table, new Map());
        }

        // Ok, so this is tricky in the presence of colspan/rowspan.

        // Consider this case (coords are col,row):

        // 0,0  |  1,0  |   2,0  |  3,0
        // 0,1    (1,1) |   2,1  |  3,1
        //(0,2)   (1,2) |   2,2  |  3,2
        // 0,3  |  1,3  |   2,3  |  3,3

        // Each row corresponds to a single <tr>, but we can't simply count the
        // <tr>s to get to the cell we want, as the cell 0,1 rowspans onto row 2
        // as well as 1. So to find that coord 1,2 which falls into the merged
        // cell starting at 0,1 we need to have looked at the cell 0,1 and seen
        // its rowspans and colspans. Therefore, we need to traverse all the
        // rows of the table up to the desired row, and all the columns of each
        // row up to the desired column number, and stop when we find the
        // row/col we want *or a cell whose coords plus rowspan and colspan
        // cover the row/col we want*.

        // However, if we're looking for 2,2 we still need to have accounted for
        // the 0,1's rowspan and colspan, because 2,2 will be the first <td> we
        // encounter on the third <tr> and we need to offset the column index
        // appropriately.

        if (row < 0 || table.rows.length <= row) {
          console.error("tried to get cell at row " + row + " but rows go from 0 to " + (table.rows.length - 1));
          return null;
        }

        // Where we are in our scan of the table
        let rowIdx = 0;
        let currentRow = table.rows[rowIdx];
        let colIdx = 0; // Index in the cell array of actual <td>s
        let colLogicalIdx = 0; // Index in the cell grid, which may exceed colIdx as cells in higher rows may rowspan down into this row and take up spaces in the cell grid with no actual <td>

        let rowspans = new Map(); //Column index -> row index where current rowspan for that column ends

        // Iterate through cells, trying to find one that overlaps the requested
        // coordinates
        while(true) {
          const currentCell = currentRow.cells[colIdx];
          const colspan = currentCell.colSpan || 1;
          const rowspan = currentCell.rowSpan || 1;
          if(rowIdx <= row && colLogicalIdx <= col &&
             (rowIdx+rowspan-1) >= row && (colLogicalIdx+colspan-1) >= col) {
            // We have found a cell that is, or encompasses, our target coords
            const ref = CellRef.fromNode(currentCell);
            fromCoordsCache.get(table).set(cacheKey, ref);
            return ref;
          }

          // Record rowspan ending rows for every column we touch
          if(rowspan>1) {
            for(let i=0;i<colspan;i++) {
              rowspans.set(colLogicalIdx+i, rowIdx+rowspan-1);
            }
          } else {
            for(let i=0;i<colspan;i++) {
              rowspans.set(colLogicalIdx+i, -1);
            }
          }

          // Move to the next cell
          if(colIdx >= currentRow.cells.length - 1 || colLogicalIdx > col) {
            // Actually, move to next row because we've hit the end of this row,
            // or advanced past the cell of interest so no further cells on this
            // row can be the one we want, or influence our search for it via
            // rowspans affecting later rows
            colIdx = 0;
            colLogicalIdx = 0;
            rowIdx++;
            if(rowIdx >= table.rows.length || rowIdx > row) {
              // Abort, we're not going to find it
              return null;
            }
            currentRow = table.rows[rowIdx];
          } else {
            // Ok, there are more cells in this row
            colIdx++;
            colLogicalIdx+=colspan;
          }

          // Account for rowspan inclusions from higher rows, that take up
          // logical column indexes in this row without an actual <td>
          while(rowspans.get(colLogicalIdx) >= rowIdx) {
            colLogicalIdx++;
          }
        }
      }
    }

    let RowSortOrder    = (a, b) => (a.row == b.row) ? a.col - b.col : a.row - b.row;
    let ColumnSortOrder = (a, b) => (a.col == b.col) ? a.row - b.row : a.col - b.col;

    // If an index lies outside a range, restart it,
    // else move it in the direction specified
    let loopIndex = function(index, min, max, step) {
      var index = index + step;
      if (index < min)      { return max; }
      else if (index > max) { return min; }
      else                  { return index; }
    }

    // Focus Cursors
    // These represent the various ways in which we can move the focus cursor
    // and encode returning a new selection with the correct focus

    // When we have only selected a single cell,
    // the cursor moves to the cells around it
    let SingleCellFocusCursor = class {
      constructor(selection) {
        this.selection = selection;
      }

      nextFocusByRow()    { return new TableSelection(selection.focus.right || selection.focus); }
      nextFocusByColumn() { return new TableSelection(selection.focus.below || selection.focus); }
      prevFocusByRow()    { return new TableSelection(selection.focus.left  || selection.focus);  }
      prevFocusByColumn() { return new TableSelection(selection.focus.above || selection.focus); }
    }

    // When we have made a selection,
    // the cursor moves within the selection
    let SingleSelectionFocusCursor = class {
      constructor(selection) {
        this.selection = selection;
      }

      // Given an array of cells and the current focus,
      // returns the cell that should be the next focus cell
      nextFocusCell(method, step) {
        var cells = method(this.selection);
        var index = cells.findIndex(this.selection.focus.equals, this.selection.focus);
        var index = loopIndex(index, 0, cells.length - 1, step);
        return cells[index];
      }

      withFocus(tableCell)    { return new TableSelection(this.selection.startCell, this.selection.endCell, tableCell); }
      nextFocusByRow()    { return this.withFocus(this.nextFocusCell(s => s.cellsByRow,    +1)); }
      nextFocusByColumn() { return this.withFocus(this.nextFocusCell(s => s.cellsByColumn, +1)); }
      prevFocusByRow()    { return this.withFocus(this.nextFocusCell(s => s.cellsByRow,    -1)); }
      prevFocusByColumn() { return this.withFocus(this.nextFocusCell(s => s.cellsByColumn, -1)); }
    }

    // When we have made multiple selections (using Ctrl),
    // the cursor moves within a selection and then to the next selection
    let MultipleSelectionFocusCursor = class {
      constructor(selection) {
        this.selections = selection.selections;
        this.focusedSelection = selection.focusedSelection;
        this.focusedIndex = this.selections.indexOf(this.focusedSelection);
      }

      nextFocusedIndex(step) {
        return loopIndex(this.focusedIndex, 0, this.selections.length - 1, step);
      }

      withNextFocus(method, step, start, end) {
        var newSelections = Array.from(this.selections);
        var newSelection = null;
        if (this.focusedSelection.focus.equals(end(this.focusedSelection))) {
          newSelection = newSelections[this.nextFocusedIndex(step)];
          var cursor = new SingleSelectionFocusCursor(newSelection);
          newSelection = cursor.withFocus(start(newSelection));
          newSelections[this.nextFocusedIndex(step)] = newSelection;
        } else {
          newSelection = method(this.focusedSelection.focusCursor);
          newSelections[this.focusedIndex] = newSelection;
        }
        return new MultipleRangeSelection(newSelections, newSelection);
      }

      nextFocusByRow()    { return this.withNextFocus(s => s.nextFocusByRow(),    +1, s => s.firstCell, s => s.lastCell); }
      nextFocusByColumn() { return this.withNextFocus(s => s.nextFocusByColumn(), +1, s => s.firstCell, s => s.lastCell); }
      prevFocusByRow()    { return this.withNextFocus(s => s.prevFocusByRow(),    -1, s => s.lastCell, s => s.firstCell); }
      prevFocusByColumn() { return this.withNextFocus(s => s.prevFocusByColumn(), -1, s => s.lastCell, s => s.firstCell); }
    }

  let TableSelection = class {
      // Here we introduce a notion of the actual range selected (from startCell to endCell), and an *effective* range.

      // The effective range is a superset of the actual range, but it's
      // expanded to cover the full extent of any col/row-spanned cells
      // intersection the actual range.

      // Eg, given this table:

      //  0,0    (1,0) |  2,0
      //               +------
      // (0,1)   (1,1) |  2,1

      // If the user selects the merged cell at 0,0 then drags right into 2,0
      // the actual range would be from 0,0 to 2,0 but the effective range -
      // that we need to show highlighted, and return to the system as the
      // selected range - would expand to go from 0,0 to 2,1, including the 2,1
      // cell that the user never dragged over at all, because the rowspan of
      // the 0,0 cell covers the 1 row, and the user selected the 2 column, so
      // 2,1 must be selected too.

      constructor(startCell, endCell, focus) { // startCell, endCell are CellRefs
        this.actualStartCell = startCell;
        this.actualEndCell = (endCell === undefined) ? startCell : endCell;
        this.theTable = startCell.table;

        // Expand range to cover any spanned cells in the range, and store in startCell/endCell

        // We use a naive algorithm: iterate through the actual range, checking
        // every cell to see if it extends outside the range, and growing the
        // range if so. We might be able to make that a bit faster by doing a
        // scan through the raw <table> element directly once, as
        // getRangeOfCells will do the CellRef.fromCoords lookup for every cell,
        // any of which might require a scan through the entire <table>.

        // Start by normalising min/max values
        let minRow = Math.min(this.actualStartCell.row, this.actualEndCell.row);
        let maxRow = Math.max(this.actualStartCell.row, this.actualEndCell.row);
        let minCol = Math.min(this.actualStartCell.col, this.actualEndCell.col);
        let maxCol = Math.max(this.actualStartCell.col, this.actualEndCell.col);

        // Iterate through cells, updating min/max if needed. Note that if the
        // selection range is extended due to a merged cell, we need to also
        // examine the newly-within-the-selection cells to see if they, in turn,
        // further extend the selection.
        let cells = this.getRangeOfCells(minRow, maxRow, minCol, maxCol);
        while (cells.length != 0) {
          const cell = cells.pop();
          if(cell.row < minRow) { // Extend selection upwards
            cells = cells.concat(this.getRangeOfCells(cell.row, minRow-1, minCol, maxCol));
            minRow = cell.row;
          }
          if(cell.col < minCol) { // Extend selection left
            cells = cells.concat(this.getRangeOfCells(minRow, maxRow, cell.col, minCol-1));
            minCol = cell.col;
          }
          if(cell.endRow > maxRow) { // Extend selection down
            cells = cells.concat(this.getRangeOfCells(maxRow+1, cell.endRow, minCol, maxCol));
            maxRow = cell.endRow;
          }
          if(cell.endCol > maxCol) { // Extend selection right
            cells = cells.concat(this.getRangeOfCells(minRow, maxRow, maxCol+1, cell.endCol));
            maxCol = cell.endCol;
          }
        }

        // Save the effective range
        this.rowStart = minRow;
        this.rowEnd = maxRow;
        this.colStart = minCol;
        this.colEnd = maxCol;

        // Set start/end cells to cover effective range. Note that the row/col of either cell, if it falls within a merged cell, may be "pushed" up/left to the top left corner of the merged cell, so we should NOT use the row/col of this.startCell or this.endCell - we should consult the {row/col}{Start/End} fields.
        this.startCell = CellRef.fromCoords(startCell.table, minRow, minCol);
        this.endCell = CellRef.fromCoords(startCell.table, maxRow, maxCol);

        this.focus = (focus === undefined || !this.intersectsCell(focus)) ? startCell : focus;
      }

      get table()    { return this.theTable; }

      getRangeOfCells(rowStart, rowEnd, colStart, colEnd) {
        // We need to NOT count a cell multiple times if it's
        // rowspanned/colspanned We can assume rowspan/colspan cells don't cross
        // the boundary of our rectangle, however, as we'll expand from the
        // actual selection the user made to an effective selection that
        // encompasses all covered cells, by expanding to cater for row/colspans.

        // Thankfully, the presence of memoization in fromNode means we won't
        // return more than one cellref object for the same physical node, even
        // though fromCoords will map multiple rows/cols to the same node if
        // it's spanned, so we can use Set() to deduplicate the result of a
        // naive cartesian scan through the coordinate space.

        var cells = new Set();
        for (var row = rowStart; row <= rowEnd; row++) {
          for (var col = colStart; col <= colEnd; col++) {
            const candidateCell = CellRef.fromCoords(this.table, row, col)
            cells.add(candidateCell);
          }
        }
        return Array.from(cells.values());
      }

      get cells() { return this.getRangeOfCells(this.rowStart, this.rowEnd, this.colStart, this.colEnd); }
      get cellsByRow() { return this.cells.sort(RowSortOrder); }
      get cellsByColumn() { return this.cells.sort(ColumnSortOrder); }
      get topCells() { return this.getRangeOfCells(this.rowStart, this.rowStart, this.colStart, this.colEnd); }
      get bottomCells() { return this.getRangeOfCells(this.rowEnd, this.rowEnd, this.colStart, this.colEnd); }
      get leftCells() { return this.getRangeOfCells(this.rowStart, this.rowEnd, this.colStart, this.colStart); }
      get rightCells() { return this.getRangeOfCells(this.rowStart, this.rowEnd, this.colEnd, this.colEnd); }
      get firstCell() { return this.cells[0]; }
      get lastCell() { return this.cells[this.cells.length - 1]; }

      get rows() {
        var rows = [];
        for (var row = this.rowStart; row <= this.rowEnd; row++) {
          var rowCells = this.getRangeOfCells(row, row, this.colStart, this.colEnd);
          rows.push(new TableSelection(rowCells[0], rowCells[rowCells.length - 1]));
        }
        return rows;
      }

      intersectsCell(tableCell) {
        return this.table == tableCell.table &&
          this.rowStart <= (tableCell.endRow) &&
          this.rowEnd   >= tableCell.row &&
          this.colStart <= (tableCell.endCol) &&
          this.colEnd   >= tableCell.col;
      }

      includingSelection(selection) {
        return new MultipleRangeSelection([this, selection]);
      }

      get focusCursor() {
        return this.firstCell.equals(this.lastCell) ?
          new SingleCellFocusCursor(this) :
          new SingleSelectionFocusCursor(this);
      }

      // Creates a selection from a specific element
      static fromElement(element) {
        if (element.nodeName == "TABLE") {
          var topLeft = element.rows[0].cells[0];
          var lastRow = element.rows[element.rows.length - 1];
          var bottomRight = lastRow.cells[lastRow.cells.length - 1];
          return new TableSelection(CellRef.fromNode(topLeft), CellRef.fromNode(bottomRight));
        } else if (element.nodeName == "TR") {
          const childTDS = element.querySelectorAll("TD")
          var startCell = CellRef.fromNode(childTDS[0]);
          var endCell = CellRef.fromNode(childTDS[childTDS.length - 1]);

          return new TableSelection(startCell, endCell);
        } else if (element.nodeName == "TD" ) {
          var cell = CellRef.fromNode(element);
          return new TableSelection(cell, cell);
        } else if (element.nodeName == "TH") {
          if (element.scope == "row") {
            const tr = element.closest("tr")
            const childTDS = tr.querySelectorAll("TD")

            const thStartCell = CellRef.fromNode(childTDS[0]);
            const thEndCell = CellRef.fromNode(childTDS[childTDS.length - 1]);
            return new TableSelection(thStartCell, thEndCell);
          } else {
            // I think this _should_ be handled in handleEntry or draggingSelection but
            // this is a backup as per the original code.
            var headerTH = CellRef.fromNode(element);
            return new TableSelection(headerTH, headerTH);
          }
        } else if (element instanceof Element) {
          return TableSelection.fromElement(element.closest("tr, td, th"));
        } else {
          return NilSelection;
        }
      }

      // Select the entire column that contains this element
      static fromColumn(element) {
        // User clicked the first row in the table (the table chrome), which may or may
        // not contain header text (e.g, A, B, C etc).
        if (element.nodeName == "TD" || element.nodeName == "TH") {
          var cell = CellRef.fromNode(element);
          var index = Array.from(element.parentElement.children).indexOf(element);
          var table = TableSelection.fromElement(cell.table);

          var startCell = table.topCells[index];
          var endCell = table.bottomCells[index];

          return new TableSelection(startCell, endCell)
        } else if (element instanceof Element) {
          // Clicked a non-TD/TH element, so bubble up until the browser finds a td or th
          return TableSelection.fromColumn(element.closest("td, th"));
        } else {
          console.error("Can't take a column for something that is not (or not within) a <td> or a <th>");
          return NilSelection;
        }
      }
    };

    let MultipleRangeSelection = class {
      constructor(selections, focusedSelection) {
        this.selections = Array.from(selections);
        this.focusedSelection = (focusedSelection === undefined) ? this.selections[0] : focusedSelection;
      }

      get table()    { return this.focusedSelection.table; }
      get focus()    { return this.focusedSelection.focus; }
      get rowStart() { return Math.min(...this.selections.map(s => s.rowStart)); }
      get rowEnd()   { return Math.max(...this.selections.map(s => s.rowEnd)); }
      get colStart() { return Math.min(...this.selections.map(s => s.colStart)); }
      get colEnd()   { return Math.max(...this.selections.map(s => s.colEnd)); }

      get cells() { return this.selections.map(s => s.cells).reduce((acc, cur) => acc.concat(cur), []); }
      get cellsByRow() { return this.selections.map(s => s.cellsByRow).reduce((acc, cur) => acc.concat(cur), []); }
      get cellsByColumn() { return this.selections.map(s => s.cellsByColumn).reduce((acc, cur) => acc.concat(cur), []); }
      get topCells() { return this.selections.map(s => s.topCells).reduce((acc, cur) => acc.concat(cur), []); }
      get bottomCells() { return this.selections.map(s => s.bottomCells).reduce((acc, cur) => acc.concat(cur), []); }
      get leftCells() { return this.selections.map(s => s.leftCells).reduce((acc, cur) => acc.concat(cur), []); }
      get rightCells() { return this.selections.map(s => s.rightCells).reduce((acc, cur) => acc.concat(cur), []); }
      get rows() { return this.selections.map(s => s.rows).reduce((acc, cur) => acc.concat(cur), []); }

      intersectsCell(tableCell) { return this.selections.some(s => s.intersectsCell(tableCell)); }

      includingSelection(selection) {
        return new MultipleRangeSelection(this.selections.concat(selection));
      }

      get focusCursor() {
        return new MultipleSelectionFocusCursor(this);
      }
    };

    const changeValue = function(input, newValue) {
      if (input.selectedIndex !== undefined) {
        for (var option of input.options) {
          if (option.text == newValue) {
            option.selected = true;
            input.dispatchEvent(new Event("change", {"bubbles": true, "cancelable": false, "target": input}));
            break;
          }
        }
      } else {
        input.value = newValue;
        input.dispatchEvent(new Event("change", {"bubbles": true, "cancelable": false, "target": input}));
      }
    }

    const NilSelection = Symbol();

    var tables = document.querySelectorAll("table.selectable");
    for (var table of tables) {
      {
        const selectables = table.querySelectorAll('td');
        selectables[0].setAttribute("tabindex", 0); // First one is tabbable, to get the user into the table
      }

      var selection = NilSelection;

      const changeSelection = function(startCell, endCell) {
        startCell = (startCell === null) ? selection.startCell : startCell;
        endCell = (endCell === null) ? selection.endCell : endCell;
        return applySelection(new TableSelection(startCell, endCell));
      }

      // Updates the internal selection and screen display
      const applySelection = function(newSelection) {
        var oldCells = (selection == NilSelection) ? new Set() : selection.cells;
        for (var cell of oldCells) {
          for (var className of CellSelectedClasses) {
            cell.node.classList.remove(className);
            cell.node.setAttribute("aria-selected", "false");
          }
        }

          // Should just be one, but let's be sure
        var oldSelectables = table.querySelectorAll("[tabindex=\"0\"]")
        for (var cell of oldSelectables) {
          cell.setAttribute("tabindex", -1);
        }

        selection = newSelection;
        if (selection == NilSelection) { return; }
        selection.focus.node.focus();
        selection.focus.node.setAttribute("tabindex", 0);
        selection.focus.node.classList.add(CellSelectedFocusClassName);
        for (var cell of selection.cells) {
          cell.node.classList.add(CellSelectedClassName);
          cell.node.setAttribute("aria-selected", "true");
        }
        for (var cell of selection.bottomCells) { cell.node.classList.add(CellSelectedBottomClassName); }
        for (var cell of selection.topCells) { cell.node.classList.add(CellSelectedTopClassName); }
        for (var cell of selection.leftCells) { cell.node.classList.add(CellSelectedLeftClassName); }
        for (var cell of selection.rightCells) { cell.node.classList.add(CellSelectedRightClassName); }
        selection.focus.node.scrollIntoViewIfNeeded(false);

        const headerRowCellCount = table.querySelectorAll('th[scope="col"]').length
        const headerRowCount = table.querySelectorAll('thead tr').length
        const headerRowOffset = headerRowCellCount > 0 ? headerRowCount  : 1;
        var columnOffset = 0;

        // If there are row numbers, the column numbers will be off as it includes the
        // row TH but the backend assumes we're only sharing TD indices (e.g. data holding cells).
        if (table.querySelectorAll('th[scope="row"]').length > 0) {
          columnOffset = 1;
        }

        // If we have HTML elements defined on the page (with specific names) then they will be used
        // to store the top left row/column and bottom right row/column.
        if (tlRowTarget) { tlRowTarget.value = selection.startCell.row - headerRowOffset; }
        if (tlColTarget) { tlColTarget.value = selection.startCell.col - columnOffset; }
        if (brRowTarget) { brRowTarget.value = selection.endCell.row - headerRowOffset; }
        if (brColTarget) { brColTarget.value = selection.endCell.col - columnOffset; }
      }

      var scanInputElements = function() {
        var inputs = new Set();
        for (var cell of (selection == NilSelection ? [] : selection.cells)) {
          for (var input of cell.node.querySelectorAll(InputElementsSelector)) {
            inputs.add(input);
          }
        }
        return inputs;
      }

      // We make some assumptions that makes implementing undo and redo easy:
      //  1. All state is present in form fields (i.e. inline editors are stateless)
      //     This is a reasonable assumption because anything important has to go
      //     to the server in a form field anyway.
      //  2. All actions only take effect on the table selection.
      //
      // Our approach to undo and redo is then quite simple: keep two stacks
      // of values, and whenever we make a change to the cells record the old
      // and new values onto the undo stack. When we undo, swap them onto the redo stack.
      var undoStack = [];
      var redoStack = [];

      // Take a record of all the input values in the current selection
      // and place them on the supplied stack to maybe be restored later.
      var unapplyableAction = function(stack, callable) {
        var inputs = Array.from(scanInputElements());
        var oldValues = inputs.map((input) => ({name: input.name, value: input.value}));
        var result = callable.call();
        var newValues = inputs.map((input) => ({name: input.name, value: input.value}));
        stack.push({old: oldValues, new: newValues});
        return result;
      }

      // Perform an action that can be undone with Ctrl+Z.
      // This also clears the redo stack because it wouldn't make sense
      // to be redoing old changes on top of new data
      var undoableAction = function(callable) {
        redoStack = [];
        return unapplyableAction(undoStack, callable);
      }

      // Clears the values of all the cells in the current selection
      var clearSelectedCells = function() {
        var inputs = Array.from(scanInputElements());
        inputs.forEach(input => setEmptyValue(input, "")); // TODO: types may require different defaults
      }

      // Take the last set of values from the passed stack
      // and restore the named elements so that they have those values
      var applyLast = function(poppingStack, pushingStack) {
        if (poppingStack.length <= 0) { return; }
        var action = poppingStack.pop();
        for (var oldValue of action.old) {
          changeValue(document.getElementsByName(oldValue.name)[0], oldValue.value);
        }
        pushingStack.push({old: action.new, new: action.old});
      }

      // Undo the last action and place the old state on the redo stack
      var undoLast = function() {
        applyLast(undoStack, redoStack);
      }

      // Redo the last action and place the old state on the undo stack
      var redoLast = function() {
        applyLast(redoStack, undoStack);
      }

      var preventDefault = function(event) {
        event.preventDefault();
      }

      var preventInputFocus = function(event) {
        if (!event.target.matches(SingleClickFocusElementsSelector)) {
          event.preventDefault();
        }
      }

      // Remove focus when we make a table selection.
      var removeFocus = function(focusEvent) {
        var currentFocus = document.querySelector(":focus");
        if (currentFocus !== null) { currentFocus.blur(); }
      }

      // Only give fields focus when they're double clicked
      // If the cell is double clicked, focus the first element
      var enterCell = function(event) {
        var target = event.target;
        var input = (target.nodeName === "TD") ? target.querySelector(InputElementsSelector) : target;
        var cell = CellRef.fromNode(target);
        rememberCurrentValue(cell);
        cellEditMode(cell, input);
      }

      var leaveCell = function(event) {
        var target = event.target;
        cellSelectMode(CellRef.fromNode(target));
      }

      table.addEventListener("dblclick", enterCell);

      // When we enter edit mode for a cell, we remember the
      // current values of the inputs. If a user changes the input
      // we add an entry to the undo stack.
      var startRemembering = function(input) {
        var haveEdited = false;
        var previousValue = {name: input.name, value: input.value};

        var addToUndoStack = function() {
          var newValue = {name: input.name, value: input.value};
          undoStack.push({old: [previousValue], new: [newValue]});
          redoStack = [];
          haveEdited = true;
          previousValue = newValue;
        }

        var watchForEscape = function(keyEvent) {
          if (keyEvent.key == "Escape") {
            // If we pressed Escape and haved edited the cell,
            // then we want to revert to the original value, so undo.
            cellSelectMode(selection.focus);
            if (haveEdited) { undoLast(); }
          }
        }

        var stopRemembering = function() {
          input.removeEventListener("change", addToUndoStack);
          input.removeEventListener("blur", stopRemembering);
          input.removeEventListener("keydown", watchForEscape);
        }

        input.addEventListener("change", addToUndoStack);
        input.addEventListener("blur", stopRemembering);
        input.addEventListener("keydown", watchForEscape);
      }

      var rememberCurrentValue = function(cell) {
        for (var input of cell.node.querySelectorAll(InputElementsSelector)) {
          startRemembering(input);
        }
      }

      var TableSelectMode = new EventState("select");
      var TableUnfocusedMode = new EventState("unfocused");
      var TableEditMode   = new EventState("edit");
      var InputSelectMode  = new EventState("select");
      var InputEditMode    = new EventState("edit");
      var InputAliveState  = new EventState("alive");

      // Stop input elements from taking focus on a single click
      // This would also prevent the drag selection from working
      // because the caret ends up in the input and mouseevents
      // end up with their target as the input, not the cell
      InputSelectMode.addEvent("mousedown", preventInputFocus);
      InputSelectMode.addEvent("click", preventInputFocus);

      // If we click on another cell when one cell is in edit mode,
      // we should remove focus from that cell.
      InputSelectMode.addEvent("mousedown", removeFocus);

      // If an input gains focus somehow, it's cell should be in edit mode.
      InputSelectMode.addEvent("focus", enterCell);
      InputSelectMode.addEvent("blur", leaveCell);
      InputEditMode.addEvent("blur", leaveCell);

      var cellEditMode = function(cell, input) {
        DocumentSelectMode.leave(document);
        TableSelectMode.leave(table)
        for (var inp of cell.node.querySelectorAll(InputElementsSelector)) {
          InputSelectMode.leave(inp);
        }
        changeSelection(cell);
        if (input) {
            input.focus();
        }

        for (var inp of cell.node.querySelectorAll(InputElementsSelector)) {
          InputEditMode.enter(inp);
        }
        TableEditMode.enter(table);
        DocumentEditMode.enter(document);
      }

      var cellSelectMode = function(cell) {
        var inputs = Array.from(cell.node.querySelectorAll(InputElementsSelector));
        DocumentEditMode.leave(document);
        TableEditMode.leave(table)
        for (var input of cell.node.querySelectorAll(InputElementsSelector)) {
          InputEditMode.leave(input);
          input.blur();
          InputSelectMode.enter(input);
        }
        TableSelectMode.enter(table);
        DocumentSelectMode.enter(document);
      }

      // Log which keys are *currently* pressed for use with mouse events
      var depressedKeys = new Set();
      var updateKey = function(flag, name) {
        if (flag) { depressedKeys.add(name); }
        else      { depressedKeys.delete(name); }
      }

      var updateFromKeyEvent = function(keyEvent) {
        updateKey(keyEvent.type == "keydown", keyEvent.key);
        updateKey(keyEvent.shiftKey, "Shift");
        updateKey(keyEvent.ctrlKey, "Control");
        updateKey(keyEvent.altKey, "Alt");
        updateKey(keyEvent.metaKey, "Meta");
      }

      DocumentSelectMode.addEvent("keydown", updateFromKeyEvent);
      DocumentSelectMode.addEvent("keyup", updateFromKeyEvent);

      var startDrag = function(startEvent) {
        // Triggered when the user has finished dragging a selection
        const stopDrag = function(stopEvent) {
          table.removeEventListener("mouseup", stopDrag);
          table.removeEventListener("mouseover", handleEntry);
        }

        // Store the selection before we started dragging, and the one we are dragging
        // If we are starting on a top row cell, start by selecting the whole column
        var initialSelection  = selection;
        var draggingSelection = (startEvent.target.closest("tr,th,td").matches("thead tr:first-child th"))
          ? TableSelection.fromColumn(startEvent.target)
          : TableSelection.fromElement(startEvent.target);

        // If we have control-dragged, add the new selection to the existing selection
        // Otherwise, replace the existing selection with the new one
        const mergeSelection = function(newSelection) {
          const selectionKey = isMac ? "Meta" : "Control"

          if (depressedKeys.has(selectionKey)) {
            return initialSelection.includingSelection(newSelection);
          } else {
            return newSelection;
          }
        }

        // Triggered when the user enters a new cell
        // To take into account that the user might be selecting rows,
        // we make a range from the new cell and use the end cell of that range
        const handleEntry = function(entryEvent) {
          var eventRange = (entryEvent.target.closest("tr,th,td").matches("thead tr:first-child th"))
            ? TableSelection.fromColumn(entryEvent.target)
              : TableSelection.fromElement(entryEvent.target);
          // Keep the ACTUAL start cell from the previous dragging selection, not the EFFECTIVE start cell
          draggingSelection = new TableSelection(draggingSelection.actualStartCell, eventRange.actualEndCell);
          applySelection(mergeSelection(draggingSelection));
        }

        // Don't capture the drag if we're clicking on a <select> box or friends
        if (!startEvent.target.matches(SingleClickFocusElementsSelector)) {
          applySelection(mergeSelection(draggingSelection));
          table.addEventListener("mouseup", stopDrag);
          table.addEventListener("mouseover", handleEntry);
          startEvent.preventDefault();
        }
      }

      var selectAll = function() {
        applySelection(TableSelection.fromElement(table));
      }

      // List of key codes that we think shouldn't trigger cell editing
      const ControlKeyCodes = Object.keys(KeyGroups)
        .filter(g => g != "Whitespace" && g != "IMEAndComposition")
        .map(k => KeyGroups[k])
        .reduce((acc, cur) => acc.concat(cur), [])
        .filter(k => k != "Backspace")
        .concat("Tab");

      var valueKeyPressed = function(keyEvent) {
        return (!ControlKeyCodes.includes(keyEvent.key) && !keyEvent.ctrlKey && !keyEvent.metaKey);
      }

      var selectModeKeyboardShortcuts = function(keyEvent) {
        if (keyEvent.ctrlKey && keyEvent.key.toLowerCase() == "z") { undoLast(); }
        else if (keyEvent.ctrlKey && keyEvent.key.toLowerCase() == "y") { redoLast(); }
        else if (keyEvent.ctrlKey && keyEvent.key.toLowerCase() == "j") { undoableAction(joinSelection); keyEvent.preventDefault(); }
        else if (keyEvent.key == "Delete" || keyEvent.key == "Clear") { undoableAction(clearSelectedCells); }
        else if (keyEvent.ctrlKey && keyEvent.key.toLowerCase() == "a") { selectAll(); keyEvent.preventDefault(); }
        else if (!keyEvent.shiftKey && keyEvent.key == "ArrowLeft")  { changeSelection(selection.focus.left); keyEvent.preventDefault(); }
        else if (!keyEvent.shiftKey && keyEvent.key == "ArrowRight") { changeSelection(selection.focus.right); keyEvent.preventDefault(); }
        else if (!keyEvent.shiftKey && keyEvent.key == "ArrowDown")  { changeSelection(selection.focus.below); keyEvent.preventDefault(); }
        else if (!keyEvent.shiftKey && keyEvent.key == "ArrowUp")    { changeSelection(selection.focus.above); keyEvent.preventDefault(); }
        else if (keyEvent.shiftKey && keyEvent.key == "ArrowLeft")  { changeSelection(selection.focus, selection.actualEndCell.left); keyEvent.preventDefault(); }
        else if (keyEvent.shiftKey && keyEvent.key == "ArrowRight") { changeSelection(selection.focus, selection.actualEndCell.right); keyEvent.preventDefault(); }
        else if (keyEvent.shiftKey && keyEvent.key == "ArrowDown")  { changeSelection(selection.focus, selection.actualEndCell.below); keyEvent.preventDefault(); }
        else if (keyEvent.shiftKey && keyEvent.key == "ArrowUp")    { changeSelection(selection.focus, selection.actualEndCell.above); keyEvent.preventDefault(); }
        else if (!keyEvent.shiftKey && keyEvent.key == "Enter") { applySelection(selection.focusCursor.nextFocusByColumn()); keyEvent.preventDefault(); }
        else if (keyEvent.shiftKey && keyEvent.key == "Enter") { applySelection(selection.focusCursor.prevFocusByColumn()); keyEvent.preventDefault(); }
        else if (valueKeyPressed(keyEvent)) {
          var input = selection.focus.node.querySelector(InputElementsSelector);
          var event = new KeyboardEvent(keyEvent.type, keyEvent);
          event.stopPropagation();
          changeSelection(selection.focus);
          if (input !== null) {
            rememberCurrentValue(selection.focus);
            input.value = "";
            cellEditMode(selection.focus, input);
            input.dispatchEvent(event);
          }
        }
      };

      var editModeKeyboardShortcuts = function(keyEvent) {
        if (keyEvent.key == "Enter") {
          cellSelectMode(selection.focus);
          applySelection(selection.focusCursor.nextFocusByColumn());
        }
        if (keyEvent.key == "Escape") {
          cellSelectMode(selection.focus);
        }
        if (keyEvent.target.matches(SingleClickFocusElementsSelector) && !valueKeyPressed(keyEvent)) {
          // We are operating on an element which doesn't have persistent focus
          // I.e. there is no cursor to move around the input area and the element doesn't "look" focused
          // So we handle any non-value key press as if the cell was in select mode
          // This means arrow keys etc. will move the cell focus as expected
          cellSelectMode(selection.focus);
          keyEvent.preventDefault();
          keyEvent.stopPropagation();
          selectModeKeyboardShortcuts(keyEvent);

          // Due to a bug in Firefox (https://stackoverflow.com/a/46974366/3729369)
          // arrow key events are not prevented properly so we instead
          // make the <select> disabled temporarily and restore it a frame later
          if (keyEvent.target.tagName == "SELECT") {
            keyEvent.target.disabled = true;
            setTimeout(function() { keyEvent.target.disabled = false; });
          }
        }
      }

      DocumentSelectMode.addEvent("keydown", selectModeKeyboardShortcuts);
      DocumentEditMode.addEvent("keydown", editModeKeyboardShortcuts);

      var loseFocus = function(event) {
         if (event.target.closest("table") !== table) {
           DocumentSelectMode.leave(document);

           // If we not set the table's data-persist-selection attribute to "true" then we will apply
           // the Nil selection when the table loses focus.
           if ( !table.dataset.persistSelection ||  table.dataset.persistSelection.toLowerCase() != "true") {
             applySelection(NilSelection);
           }

           DocumentUnfocusedMode.enter(document);
           TableUnfocusedMode.enter(table);
         }
      }
      DocumentSelectMode.addEvent("click", loseFocus);
      var elementsOutsideTable = document.evaluate(FocusableElementsOutsideTable, document, null, XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null);
      for (var e = 0; e < elementsOutsideTable.snapshotLength; e++) {
        elementsOutsideTable.snapshotItem(e).addEventListener("focus", loseFocus);
      }

      var tableFocusIn = function(event) {
        var tableSelectables = table.querySelectorAll("[tabindex=\"0\"]")
        if(tableSelectables[0]) {
          // If we don't have a focus, set it to the externally-focussed cell
          if(selection == NilSelection) {
            selection = TableSelection.fromElement(tableSelectables[0]);
            applySelection(selection);
          }
        }
        DocumentUnfocusedMode.leave(document);
        TableUnfocusedMode.leave(table);
        TableSelectMode.enter(table);
        DocumentSelectMode.enter(document);
      }
      TableUnfocusedMode.addEvent("focusin", tableFocusIn);

      var getFocus = function(event) {
        DocumentUnfocusedMode.leave(document);
        TableUnfocusedMode.leave(table);
        DocumentSelectMode.enter(document);
      }
      DocumentUnfocusedMode.addEvent("mousedown", getFocus);

      // Auto-resizing of cells
      var calcWidth = function(input) {
        return input.scrollWidth + "px";
      }

      var autoResize = function(event) {
        event.target.style.minWidth = "auto";
        event.target.style.minWidth = calcWidth(event.target);
      }

      InputAliveState.addEvent("input",  autoResize);
      InputAliveState.addEvent("change", autoResize);

      var getCellContents = function(cell) {
        var input = cell.node.querySelector(InputElementsSelector);
        return (input !== undefined && input !== null) ? input.value : cell.node.textContent;
      }

      var cutSelection = function(cutEvent) {
        if (selection == NilSelection) { return; }

        var tabSeperated = selection.rows.map(row => row.cells.map(getCellContents).join("\t")).join("\n");
        undoableAction(clearSelectedCells);
        cutEvent.clipboardData.setData("text/plain", tabSeperated);
        cutEvent.preventDefault();
      }

      var copySelection = function(copyEvent) {
        if (selection == NilSelection) { return; }

        var tabSeperated = selection.rows.map(row => row.cells.map(getCellContents).join("\t")).join("\n");
        copyEvent.clipboardData.setData("text/plain", tabSeperated);
        copyEvent.preventDefault();
      };

      var pasteSelection = function(pasteEvent) {
        if (selection == NilSelection) { return; }
        if (!pasteEvent.clipboardData.types.includes("text/plain")) { return; }

        var data = pasteEvent.clipboardData.getData("text/plain").split("\n").map(s => s.split("\t"));
        var maxColumns = data.map(a => a.length).reduce((a, b) => Math.max(a,b), 0);

        // Expand selection to match size of paste
        // Always expand away from the focus point
        var endCell = CellRef.fromCoords(table,
          selection.focus.row + (selection.rowStart == selection.focus.row ? data.length - 1 : -(data.length - 1)),
          selection.focus.col + (selection.colStart == selection.focus.col ? maxColumns - 1 : -(maxColumns - 1)));
        changeSelection(selection.focus, endCell);

        var cells = selection.cells;
        var oldValues = [], newValues = [];
        for (var row = 0; row < data.length; row++) {
          for (var col = 0; col < data[row].length; col++) {
            var cell = CellRef.fromCoords(table, selection.rowStart + row, selection.colStart + col);
            if (cell === null) { continue; }
            var input = cell.node.querySelector(InputElementsSelector);
            if (input === null || input.readOnly || input.disabled) { continue; }
            oldValues.push({name: input.name, value: input.value});
            changeValue(input, data[row][col]);
            newValues.push({name: input.name, value: input.value});
          }
        }
        undoStack.push({old: oldValues, new: newValues});
      }

      var joinSelection = function() {
        var joinedData = selection.cells.map(getCellContents).join("");
        clearSelectedCells();
        changeValue(selection.focus.node.querySelector(InputElementsSelector), joinedData);
      }

      DocumentSelectMode.addEvent("cut", cutSelection);
      DocumentSelectMode.addEvent("copy", copySelection);
      DocumentSelectMode.addEvent("paste", pasteSelection);
      TableSelectMode.addEvent("selectstart", preventDefault);

      const DataRegion     = "data/";
      const SchemaRegion   = "schema/";
      const NewItemRegion  = "new-items/";
      const NewFieldRegion = "new-fields/";

      const NewItemSelector  = [DataRegion, NewItemRegion].join("");

      const NewRowInputSelector = "*[name*='" + NewItemSelector + "']";
      const NumberOfNewRows = 4;
      var initialNewInputs = table.querySelectorAll(NewRowInputSelector);
      if (initialNewInputs.length > 0) {
        var templateRow = initialNewInputs[0].closest('tr');
        var createNewRows = function(event) {
          var newRows = new Set(Array.from(table.querySelectorAll(NewRowInputSelector)).map(x => x.closest('tr')));
          var blankNewRows = new Set();
          for (var row of newRows) {
            var inputs = Array.from(row.querySelectorAll(NewRowInputSelector));
            if (inputs.every(hasDefaultValue)) {
              blankNewRows.add(row);
            }
          }

          for (var r = NumberOfNewRows - blankNewRows.size; r > 0; r--) {
            var newRowNumber = newRows.size;
            var newRow = templateRow.cloneNode(true);
            var namedElements = newRow.querySelectorAll('*[name]');
            const indexReplace = new RegExp(NewItemSelector + "\\d+");
            for (var i = 0; i < namedElements.length; i++) {
              namedElements[i].name = namedElements[i].name.replace(indexReplace, NewItemSelector + newRowNumber);
              setDefaultValue(namedElements[i]);
              InputAliveState.enter(namedElements[i]);
              InputSelectMode.enter(namedElements[i]);
            }
            addRowClasses({target: newRow});
            table.querySelector("tbody").appendChild(newRow);
          }
          table.dispatchEvent(new Event("resize", {bubbles: true, cancelable: false}));
        }
        InputAliveState.addEvent("input", createNewRows);
        InputAliveState.addEvent("change", createNewRows);
      }

      var groupByColumn = function(cellElement, nodeList) {
        var columns = new Map();
        for (var node of nodeList) {
          var cell = node.closest(cellElement);
          var colIndex = Array.from(cell.parentElement.cells).indexOf(cell);
          if (!columns.has(colIndex)) { columns.set(colIndex, []); }
          columns.get(colIndex).push(cell);
        }
        return Array.from(columns.values());
      }

      // Returns the default value of an input element
      // This process differs for different types of elements
      var hasDefaultValue = function(element) {
        if (element.defaultValue !== undefined) {
          return element.value == element.defaultValue;
        } else if (element.options !== undefined && element.selectedOptions !== undefined) {
          var optionsWithSelectedAttr = Array.from(element.options).filter(e => e.attributes["selected"] !== undefined);
          if (optionsWithSelectedAttr.length == 0) {
            // The select doesn't have any selected attributes, so the first item is default
            return element.selectedIndex == 0;
          } else {
            // The select has selected elements, so the default is these
            return optionsWithSelectedAttr.every(e => Array.from(element.selectedOptions).contains(e));
          }
        } else {
          console.warning("Don't know how to test for default value for " + element);
          return true;
        }
      }

      var setDefaultValue = function(element) {
        CellSelectedClasses.forEach(c => element.closest("th,td").classList.remove(c));
        if (element.defaultValue !== undefined) {
          element.value = element.defaultValue;
        } else if (element.selectedIndex !== undefined) {
          element.selectedIndex = 0;
        } else {
          console.warning("Don't know how to set default value on " + element);
        }
      }

      var setEmptyValue = function(element) {
        if (element.selectedIndex !== undefined) {
          element.selectedIndex = 0;
        } else {
          changeValue(element, "");
        }
      }

      const NewColumnInputSelector = "*[name*='" + NewFieldRegion + "']";
      const NumberOfNewColumns = 2;
      var columnGroup = table.querySelector("colgroup");
      var initialNewInputs = table.querySelectorAll(NewColumnInputSelector);
      if (initialNewInputs.length > 0) {
        var createNewColumns = function(event) {
          var columns = groupByColumn("th, td", table.querySelectorAll(NewColumnInputSelector));
          var templateElements = columns[0].map(cell => ({node: cell, parent: cell.parentElement}));
          var newColumns = groupByColumn("th, td", table.querySelectorAll(NewColumnInputSelector));
          var blankNewColumns = new Set();
          for (var column of newColumns.values()) {
            var allAreBlank = column.every(cell => {
              var inputs = Array.from(cell.querySelectorAll(NewColumnInputSelector));
              return inputs.every(hasDefaultValue);
            });
            if (allAreBlank) {
              blankNewColumns.add(column);
            }
          }

          for (var r = NumberOfNewColumns - blankNewColumns.size; r > 0; r--) {
            var newColumnNumber = newColumns.length;
            columnGroup.appendChild(document.createElement("col"));
            table.dispatchEvent(new Event("resize", {bubbles: true, cancelable: false}));
            for (var templateColumn of templateElements) {
              var newColumn = templateColumn.node.cloneNode(true);
              var namedElements = newColumn.querySelectorAll('*[name]');
              const indexReplace = new RegExp(NewFieldRegion + "\\d+");
              for (var i = 0; i < namedElements.length; i++) {
                namedElements[i].name = namedElements[i].name.replace(indexReplace, NewFieldRegion + newColumnNumber);
                setDefaultValue(namedElements[i]);
                InputAliveState.enter(namedElements[i]);
                InputSelectMode.enter(namedElements[i]);
              }
              templateColumn.parent.appendChild(newColumn);
            }
          }
        };
        InputAliveState.addEvent("input", createNewColumns);
        InputAliveState.addEvent("change", createNewColumns);
      }

      var addRowClasses = function(event) {
        var row = event.target.closest('tr');
        var siblingInputs = row.querySelectorAll("input");
        var rowEdited = false;
        var rowDeleted = (siblingInputs.length > 0);
        var rowAdded = false;
        for (var j = 0; j < siblingInputs.length; j++) {
          var isNewRow = siblingInputs[j].name.indexOf(NewItemSelector) > 0;
          var inputIsEmpty = siblingInputs[j].value === "";
          rowEdited = rowEdited || (siblingInputs[j].value !== siblingInputs[j].defaultValue);
          rowDeleted = rowDeleted && !isNewRow && inputIsEmpty; // TODO: types
          rowAdded = rowAdded || (isNewRow && !inputIsEmpty);
        }
        row.classList.toggle("edited", rowEdited); //FIXME: IE 11
        row.classList.toggle("added", rowAdded);
        row.classList.toggle("deleted", rowDeleted);
      }
      InputAliveState.addEvent("input", addRowClasses);
      InputAliveState.addEvent("change", addRowClasses);

      TableSelectMode.addEvent("mousedown", startDrag);

      DocumentUnfocusedMode.enter(document);
      TableSelectMode.enter(table)
      for (var input of table.querySelectorAll(InputElementsSelector)) {
        InputAliveState.enter(input);
        InputSelectMode.enter(input);
      }
    }
  });
  console.log("Loaded")
