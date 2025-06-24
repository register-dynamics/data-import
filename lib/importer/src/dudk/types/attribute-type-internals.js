
class AttributeMappingResult {
  constructor(value, warnings, errors) {
    this.value = value;
    this.warnings = warnings || [];
    this.errors = errors || [];
  }

  get valid() {
    return this.errors.length == 0;
  }

  get empty() {
    return this.value !== undefined;
  }
}

// These helpers define the three kinds of results:

exports.emptyMapping = (warnings) => {
  return new AttributeMappingResult(undefined, warnings);
}

exports.successfulMapping = (outputValue, warnings) => {
  return new AttributeMappingResult(outputValue, warnings);
}

exports.failedMapping = (warnings, errors) => {
  return new AttributeMappingResult(undefined, warnings, errors);
}
