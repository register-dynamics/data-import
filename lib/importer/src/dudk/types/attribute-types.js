// "input values" are what's found in the input data, and will generally be
// simple string/boolean/number/date/etc things. "attribute values" are the
// actual attributes in our output data model and can be some arbitrary type.

// An attribute type is a function from an input value to a result.

const ati = require('./attribute-type-internals');

// Create an optional version of an existing type, that allows empty strings or
// undefined values and maps then to the empty mapping, and converts any validation errors to warnings
exports.optionalType = (baseType, field) => {
  return (inputValue) => {
    if (inputValue && (inputValue.v !== undefined && inputValue.v != "")) {
      const result = baseType(inputValue);
      if (result.valid) {
        return result;
      } else {
        // Convert any errors into warnings, as this is an optional field
        return ati.emptyMapping(result.warnings.concat(result.errors));
      }
    }
    else {
      return ati.emptyMapping();
    }
  };
}

// Create a required version of an existing type, that reports an undefined or empty-string input value as an error
exports.requiredType = (baseType, field) => {
  return (inputValue) => {
    if (inputValue && (inputValue.v !== undefined && inputValue.v != "")) {
      return baseType(inputValue);
    }
    else {
      return ati.failedMapping([], [`'${field.name}' must be supplied`]);
    }
  };
}

// The default string type
exports.basicStringType = (inputCell) => {
  return ati.successfulMapping(String(inputCell.v));
};

// The default numeric type
exports.basicNumberType = (inputCell) => {
  const result = parseFloat(inputCell.v);
  if (isNaN(result)) {
    return ati.failedMapping([], ["This is not a valid number"]);
  } else {
    return ati.successfulMapping(result);
  }
};

// Combined (eg, dates stored in a single field) date type
const dates = require('./date');
exports.makeCombinedDateType = dates.makeCombinedDateType;

// Type creation from user configuration. These type names should also map what
// the type guesser returns.

exports.mapperForField = (field,format) => {
  if (!field) return null

  let m = exports.basicStringType;

  switch (field.type.toLowerCase()) {
  case "number":
    m = exports.basicNumberType
    break;
  case "date":
    switch(format) {
    case "native":
      // Date with no format spec relies on pre-parsed date values
      // being provided by spreadsheet formats
      m = dates.MakeCombinedDateType([]);
      break;
    case "ymd":
      m = dates.MakeCombinedDateType(['year','month','day']);
      break;
    case "ydm":
      m = dates.MakeCombinedDateType(['year','day','month']);
      break;
    case "dmy":
      m = dates.MakeCombinedDateType(['day','month','year']);
      break;
    case "mdy":
      m = dates.MakeCombinedDateType(['month','day','year']);
      break;
    default:
      throw new Error("Unknown date format", format);
    }
    break
  default: // Booleans and text both fall into this case
    m = exports.basicStringType
  }

  if (field.required) {
    return exports.requiredType(m, field)
  } else {
    return exports.optionalType(m, field)
  }
}

// Supported types

exports.supportedTypes = new Map([
  ["text", {displayName: "Text", description: "Any text"}],
  ["number", {displayName: "Number", description: "A (real) number, possibly including negative numbers and decimals"}],
  ["boolean", {displayName: "Y/N", description: "A 'Yes' or 'No'"}],
  ["date", {displayName: "Date", description: "A full date (eg Year, Month and Day number)",
            formats: new Map([
              ["native", {displayName: "Spreadsheet", description: "A date cell in a spreadsheet"}],
              ["ymd", {displayName: "Y/M/D", description: "A date written in Year, Month, Day order"}],
              ["ydm", {displayName: "Y/D/M", description: "A date written in Year, Day, Month order"}],
              ["dmy", {displayName: "D/M/Y", description: "A date written in Day, Month, Year order"}],
              ["mdy", {displayName: "M/D/Y", description: "A date written in Month, Day, Year order"}]
            ])}]
]);
