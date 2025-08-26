/*
This file contains an implementation of a load bearing enum that can be used
to define a set of named constants. Each constant is an instance of the Enum class,
which may contain data which can be unpacked in use.
*/

class Enum {
  constructor(variant, data = {}) {
    this.variant = variant;
    Object.assign(this, data);
    Object.freeze(this);
  }

  toString() {
    return this.variant;
  }

  match(handlers) {
    if (handlers[this.variant]) {
      return handlers[this.variant](this);
    } else if (handlers._) {
      return handlers._(this);
    }
    throw new Error(`No match handler for variant: ${this.variant}`);
  }

  static define(variants) {
    const enumObj = {};
    for (const [variant, fields] of Object.entries(variants)) {
      enumObj[variant] = (data = {}) => new Enum(variant, data);
      enumObj[variant].fields = fields || [];
    }
    return enumObj;
  }
}


module.exports = Enum;

// // Pattern matching
// const result = red.match({
//   RED: ({ hex }) => `Red is ${hex}`,
//   GREEN: ({ hex }) => `Green is ${hex}`,
//   BLUE: ({ hex }) => `Blue is ${hex}`,
//   _: () => 'Unknown color',
// });
// console.log(result); // Red is #FF0000
