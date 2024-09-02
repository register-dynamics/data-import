window.addEventListener("load", function() {
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
        this.col = this.node.cellIndex;
        this.row = this.node.parentElement.rowIndex;
        this.table = this.node.closest("table");
      };

      get left()  { return CellRef.fromCoords(this.table, this.row + 0, this.col - 1); }
      get right() { return CellRef.fromCoords(this.table, this.row + 0, this.col + 1); }
      get above() { return CellRef.fromCoords(this.table, this.row - 1, this.col + 0); }
      get below() { return CellRef.fromCoords(this.table, this.row + 1, this.col + 0); }

      equals(cell) {
        return this.table == cell.table &&
          this.row == cell.row &&
          this.col == cell.col;
      }

      static fromCoords(table, row, col) {
        if (row < 0 || table.rows.length <= row) {
          console.error("tried to get cell at row " + row + " but rows go from 0 to " + (table.rows.length - 1));
          return null;
        } else if (col < 0 || table.rows[row].cells.length <= col) {
          console.error("tried to get cell at col " + col + " but cols go from 0 to " + (table.rows[row].cells.length - 1));
          return null;
        } else {
          return new CellRef(table.rows[row].cells[col]);
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
      constructor(startCell, endCell, focus) {
        this.startCell = startCell;
        this.endCell = (endCell === undefined) ? startCell : endCell;
        this.focus = (focus === undefined || !this.intersectsCell(focus)) ? startCell : focus;
      }

      get table()    { return this.endCell.table; }
      get rowStart() { return Math.min(this.startCell.row, this.endCell.row); }
      get rowEnd()   { return Math.max(this.startCell.row, this.endCell.row); }
      get colStart() { return Math.min(this.startCell.col, this.endCell.col); }
      get colEnd()   { return Math.max(this.startCell.col, this.endCell.col); }

      getRangeOfCells(rowStart, rowEnd, colStart, colEnd) {
        var cells = new Array();
        for (var row = rowStart; row <= rowEnd; row++) {
          for (var col = colStart; col <= colEnd; col++) {
            cells.push(CellRef.fromCoords(this.table, row, col));
          }
        }
        return cells;
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
          this.rowStart <= tableCell.row &&
          this.rowEnd   >= tableCell.row &&
          this.colStart <= tableCell.col &&
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

      static fromElement(element) {
        if (element.nodeName == "TABLE") {
          var topLeft = element.rows[0].cells[0];
          var lastRow = element.rows[element.rows.length - 1];
          var bottomRight = lastRow.cells[lastRow.cells.length - 1];
          return new TableSelection(new CellRef(topLeft), new CellRef(bottomRight));
        } else if (element.nodeName == "TR") {
          var startCell = new CellRef(element.cells[0]);
          var endCell = new CellRef(element.cells[element.cells.length - 1]);
          return new TableSelection(startCell, endCell);
        } else if (element.nodeName == "TD" || element.nodeName == "TH") {
          var cell = new CellRef(element);
          return new TableSelection(cell, cell);
        } else if (element instanceof Element) {
          return TableSelection.fromElement(element.closest("tr, td, th"));
        } else {
          return NilSelection;
        }
      }

      // Select the entire column that contains this element.
      static fromColumn(element) {
        if (element.nodeName == "TD" || element.nodeName == "TH") {
          var cell = new CellRef(element);
          var index = Array.from(element.parentElement.children).indexOf(element);
          var table = TableSelection.fromElement(cell.table);
          var startCell = table.topCells[index];
          var endCell = table.bottomCells[index];
          return new TableSelection(startCell, endCell)
        } else if (element instanceof Element) {
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
          }
        }

        selection = newSelection;
        if (selection == NilSelection) { return; }
        selection.focus.node.classList.add(CellSelectedFocusClassName);
        for (var cell of selection.cells) { cell.node.classList.add(CellSelectedClassName); }
        for (var cell of selection.bottomCells) { cell.node.classList.add(CellSelectedBottomClassName); }
        for (var cell of selection.topCells) { cell.node.classList.add(CellSelectedTopClassName); }
        for (var cell of selection.leftCells) { cell.node.classList.add(CellSelectedLeftClassName); }
        for (var cell of selection.rightCells) { cell.node.classList.add(CellSelectedRightClassName); }
        selection.focus.node.scrollIntoViewIfNeeded(false);
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
        var cell = new CellRef(target);
        rememberCurrentValue(cell);
        cellEditMode(cell, input);
      }

      var leaveCell = function(event) {
        var target = event.target;
        cellSelectMode(new CellRef(target));
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
          if (depressedKeys.has("Control")) {
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
          draggingSelection = new TableSelection(draggingSelection.startCell, eventRange.endCell);
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
        changeSelection(TableSelection.fromElement(table));
      }

      // List of key codes that we think shouldn't trigger cell editing
      const ControlKeyCodes = Object.keys(KeyGroups)
        .filter(g => g != "Whitespace" && g != "IMEAndComposition")
        .map(k => KeyGroups[k])
        .reduce((acc, cur) => acc.concat(cur), [])
        .filter(k => k != "Backspace");

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
        else if (keyEvent.shiftKey && keyEvent.key == "ArrowLeft")  { changeSelection(selection.focus, selection.endCell.left); keyEvent.preventDefault(); }
        else if (keyEvent.shiftKey && keyEvent.key == "ArrowRight") { changeSelection(selection.focus, selection.endCell.right); keyEvent.preventDefault(); }
        else if (keyEvent.shiftKey && keyEvent.key == "ArrowDown")  { changeSelection(selection.focus, selection.endCell.below); keyEvent.preventDefault(); }
        else if (keyEvent.shiftKey && keyEvent.key == "ArrowUp")    { changeSelection(selection.focus, selection.endCell.above); keyEvent.preventDefault(); }
        else if (!keyEvent.shiftKey && keyEvent.key == "Enter") { applySelection(selection.focusCursor.nextFocusByColumn()); keyEvent.preventDefault(); }
        else if (!keyEvent.shiftKey && keyEvent.key == "Tab")   { applySelection(selection.focusCursor.nextFocusByRow()); keyEvent.preventDefault(); }
        else if (keyEvent.shiftKey && keyEvent.key == "Enter") { applySelection(selection.focusCursor.prevFocusByColumn()); keyEvent.preventDefault(); }
        else if (keyEvent.shiftKey && keyEvent.key == "Tab")   { applySelection(selection.focusCursor.prevFocusByRow()); keyEvent.preventDefault(); }
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
        if (keyEvent.key == "Tab") {
          cellSelectMode(selection.focus);
          applySelection(selection.focusCursor.nextFocusByRow());
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
         }
      }
      DocumentSelectMode.addEvent("click", loseFocus);
      var elementsOutsideTable = document.evaluate(FocusableElementsOutsideTable, document, null, XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null);
      for (var e = 0; e < elementsOutsideTable.snapshotLength; e++) {
        elementsOutsideTable.snapshotItem(e).addEventListener("focus", loseFocus);
      }

      var getFocus = function(event) {
        DocumentUnfocusedMode.leave(document);
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