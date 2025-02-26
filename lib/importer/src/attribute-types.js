// "input values" are what's found in the input data, and will generally be
// simple string/boolean/number/date/etc things. "attribute values" are the
// actual attributes in our output data model and can be some arbitrary type.

// An attribute type is a function from an input value to a result.

class AttributeMappingResult {
  constructor(value, warnings, errors) {
    this.value = value;
    this.warnings = warnings || [];
    this.errors = errors;
  }

  get valid() {
    return !this.errors;
  }

  get empty() {
    return this.value !== undefined;
  }
}

// These helpers define the three kinds of results:

function emptyMapping(warnings) {
  return new AttributeMappingResult(undefined, warnings);
}

function successfulMapping(outputValue, warnings) {
  return new AttributeMappingResult(outputValue, warnings);
}

function failedMapping(warnings, errors) {
  return new AttributeMappingResult(undefined, warnings, errors);
}

// Create an optional version of an existing type, that allows empty strings or
// undefined values and maps then to "undefined", and converts any validation errors to warnings
exports.optionalType = (baseType) => {
  return (inputValue) => {
    if (inputValue !== undefined && inputValue != "") {
      const result = baseType(inputValue);
      if (result.valid) {
        return result;
      } else {
        // Convert any errors into warnings, as this is an optional field
        return emptyMapping(result.warnings.concat(result.errors));
      }
    }
    else {
      return emptyMapping();
    }
  };
}

// Create a required version of an existing type, that reports an undefined or empty-string input value as an error
exports.requiredType = (baseType) => {
  return (inputValue) => {
    if (inputValue !== undefined && inputValue != "") {
      return baseType(inputValue);
    }
    else {
      return failedMapping([], ["A value must be provided"]);
    }
  };
}

// The default string type
exports.basicStringType = (inputValue) => {
  return successfulMapping(String(inputValue));
};

// The default numeric type
exports.basicNumberType = (inputValue) => {
  const result = parseFloat(inputValue);
  if (isNaN(result)) {
    return failedMapping([], ["This is not a valid number"]);
  } else {
    return successfulMapping(result);
  }
};

exports.typeFromName = (name) => {
  if (!name) return null

  switch (name.toLowerCase()) {
    case "number":
      return exports.basicNumberType
    default:
      return exports.basicStringType
  }
}
