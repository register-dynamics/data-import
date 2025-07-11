// "input values" are what's found in the input data, and will generally be
// simple string/boolean/number/date/etc things. "attribute values" are the
// actual attributes in our output data model and can be some arbitrary type.

// An attribute type is a function from an input value to a result.

const ati = require('./attribute-type-internals');

// Create an optional version of an existing type, that allows empty strings or
// undefined values and maps then to the empty mapping, and converts any validation errors to warnings
exports.optionalType = (baseType) => {
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
exports.requiredType = (baseType) => {
  return (inputValue) => {
    if (inputValue && (inputValue.v !== undefined && inputValue.v != "")) {
      return baseType(inputValue);
    }
    else {
      return ati.failedMapping([], ["A value must be provided"]);
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

// Type creation from user configuration

exports.mapperForField = (field) => {
  if (!field) return null

  let m = exports.basicStringType;

  switch (field.type.toLowerCase()) {
    case "number":
      m = exports.basicNumberType
      break
    default:
      m = exports.basicStringType
  }

  if (field.required) {
    return exports.requiredType(m)
  }

  return exports.optionalType(m)
}
