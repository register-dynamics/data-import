// "input values" are what's found in the input data, and will generally be
// simple string/boolean/number/date/etc things. "attribute values" are the
// actual attributes in our output data model and can be some arbitrary type.

// Am attribute type is a pair of functions.

// One validates an input value to see if it can be made into a valid attribute
// value. It should return a list of warnings and a list of errors.

// One maps an input value to a value of the attribute type.

// ABS TODOs: Make validation and translation happen together - drop
// AttributeType and just implement it as a function from input value ->
// (outputValue, [warning], [error]).

// This will enable optionalType to handle errors from the base type by turning
// them into warnings *and* returning undefined as the translater value.

// Then add a requiredType that wraps any type and makes it "required", treating
// "" or undefined inputs as errors.

// Base types without being wrapped by requiredType or optionalType may then
// handled undefined or "" as they see fit.

class AttributeType {
  constructor(validator, translator) {
    this.v = validator;
    this.t = translator;
  }

  get validator() { return this.v; }
  get translator() { return this.t; }

  validate(inputValue) { return this.v(inputValue); }
  translate(inputValue) { return this.t(inputValue); }
}

exports.AttributeType = AttributeType;

// Create an optional version of an existing type, that allows empty strings or
// undefined values and maps then to "undefined", and converts any validation errors to warnings
exports.optionalType = (baseType) => {
  return new AttributeType(
    (inputValue) => {
      if(inputValue !== undefined && inputValue != "") {
        const [warnings, errors] = baseType.validate(inputValue);
        // Convert any errors into warnings, as this is an optional field
        return [warnings.concat(errors), []];
      }
      else {
        return [[],[]];
      }
    },
    (inputValue) => {
      if(inputValue !== undefined && inputValue != "") return baseType.translate(inputValue);
      else return undefined;
    }
  );
}

// Create a required version of an existing type, that 
exports.optionalType = (baseType) => {
  return new AttributeType(
    (inputValue) => {
      if(inputValue !== undefined && inputValue != "") {
        const [warnings, errors] = baseType.validate(inputValue);
        // Convert any errors into warnings, as this is an optional field
        return [warnings.concat(errors), []];
      }
      else {
        return [[],[]];
      }
    },
    (inputValue) => {
      if(inputValue !== undefined && inputValue != "") return baseType.translate(inputValue);
      else return undefined;
    }
  );
}

// The default string type. Does not allow empty strings!
exports.basicStringType = new AttributeType(
  (inputValue) => {
    if(inputValue === undefined || inputValue == "") {
      return [[],["A value must be provided"]];
    }
    // Anything else can be converted into a string
    return [[],[]];
  },
  (inputValue) => {
    return String(inputValue);
  }
);

exports.basicNumberType = new AttributeType(
  (inputValue) => {
    if(inputValue === undefined || inputValue == "") {
      return [[],["A value must be provided"]];
    }

    if(parseFloat(inputValue) === NaN) {
      return [[],[inputValue + " is not a valid number"]];
    }

    return [[],[]];
  },
  (inputValue) => {
    return parseFloat(inputValue);
  }
);
