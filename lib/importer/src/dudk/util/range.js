class InclusiveRange {
  constructor(lower, upper) {
    if (typeof lower !== 'number' || typeof upper !== 'number') {
      throw new TypeError('Bounds must be numbers');
    }
    if (upper < lower) {
      throw new RangeError('Upper bound must be >= lower bound');
    }
    this.lower = lower;
    this.upper = upper;
  }

  apply(fn) {
    for (let i = this.lower; i <= this.upper; i++) {
      fn(i);
    }
  }

  contains(value) {
    return value >= this.lower && value <= this.upper;
  }

  size() {
    return this.upper - this.lower + 1;
  }

  // Returns an array of all values in the range, inclusive
  toArray() {
    const arr = [];
    for (let i = this.lower; i <= this.upper; i++) {
      arr.push(i);
    }
    return arr;
  }

  // Iterates through the range, inclusive
  [Symbol.iterator]() {
    let current = this.lower;
    const end = this.upper;
    return {
      next() {
        if (current <= end) {
          return { value: current++, done: false };
        } else {
          return { done: true };
        }
      }
    };
  }
}

class ExclusiveRange {
  constructor(lower, upper) {
    if (typeof lower !== 'number' || typeof upper !== 'number') {
      throw new TypeError('Bounds must be numbers');
    }
    if (upper <= lower) {
      throw new RangeError('Upper bound must be > lower bound');
    }
    this.lower = lower;
    this.upper = upper;
  }

  apply(fn) {
    for (let i = this.lower; i < this.upper; i++) {
      fn(i);
    }
  }

  contains(value) {
    return value >= this.lower && value < this.upper;
  }

  size() {
    return this.upper - this.lower;
  }

  // Returns an array of all values in the range, exclusive
  toArray() {
    const arr = [];
    for (let i = this.lower; i < this.upper; i++) {
      arr.push(i);
    }
    return arr;
  }

  // Iterates through the range, exclusive
  [Symbol.iterator]() {
    let current = this.lower;
    const end = this.upper;
    return {
      next() {
        if (current < end) {
          return { value: current++, done: false };
        } else {
          return { done: true };
        }
      }
    };
  }
}

const Range = InclusiveRange;

module.exports = { InclusiveRange, ExclusiveRange, Range };
