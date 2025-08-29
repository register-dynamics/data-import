const ati = require('./attribute-type-internals');
const errors = require('../util/errors');


// This defines how we return the dates as attribute values
function makeDate(year, month, day) {
  return { year: year, month: month, day: day };
}

// parse[Year|Month|Day] return [[errors],[warnings],value]; value should be
// undefined if there's errors

// IDEA: Have some flag passable in the format, to set the century for two-digit years
function parseYear(str) {
  let num = Number(str);
  if (!Number.isInteger(num)) {
    return [["Year must be a number"], [], undefined];
  }
  if (num < 100) {
    // Uhoh, a two-digit year. Do you mean a year in the 1st century, 20th, or 21st?
    if (num >= 80) { // Let's make a guess
      return [[], [errors.ValidationError.DateGuessing20thCentury({value: num, type: 'date'})], 1900 + num];
    } else {
      return [[], [errors.ValidationError.DateGuessing21stCentury({value: num, type: 'date'})], 2000 + num];
    }
  } else {
    return [[], [], num];
  }
}

const monthNames = {
  __proto__: null,

  // English, short and long forms
  jan: 1,
  january: 1,
  feb: 2,
  febuary: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12
};

function parseMonth(str) {
  let nameGuess = monthNames[str.toLowerCase()]
  if (nameGuess) {
    return [[], [], nameGuess];
  }

  let num = Number(str);
  if (!Number.isInteger(num)) {
    return [[errors.ValidationError.MonthUnrecognised({value: str, type: "date"})], [], undefined];
  }

  if (num < 1 || num > 12) {
    return [[errors.ValidationError.MonthOutOfRange({value: str, type: "date"})], [], undefined];
  }

  return [[], [], num];
}

function isLeap(year) {
  return (year % 4 == 0 && year % 100 != 0);
}

function daysInMonth(year, month) {
  switch (month) {
    case 1:
      return 31;
    case 2:
      if (isLeap(year)) {
        return 29;
      } else {
        return 28;
      }
    case 3:
      return 31;
    case 4:
      return 30;
    case 5:
      return 31;
    case 6:
      return 30;
    case 7:
      return 31;
    case 8:
      return 31;
    case 9:
      return 30;
    case 10:
      return 31;
    case 11:
      return 30;
    case 12:
      return 31;
  }

  // Fallback, for undefined months. This ensures that if the data contains an
  // invalid month, we just validate the day as being 1-31
  return 31;
}

function parseDay(str, year, month) {
  // Remove any ordinal suffixes - FIXME extend this with other languages and conventions?
  if (str.endsWith('st') || str.endsWith('th') || str.endsWith('nd') || str.endsWith('rd')) {
    str = str.slice(0, str.length - 2);
  }
  let num = Number(str);

  if (Number.isNaN(num)) {

    return [[errors.ValidationError.DayWrongType({value: str, type: "date"})], [], undefined];
  }

  let maxDay = daysInMonth(year, month);
  if (num < 1 || num > maxDay) {
    return [[errors.ValidationError.DayOutOfRange({value: str, type: "date"})], [], undefined];
  }

  return [[], [], num];
}

// This is a type constructor, that returns a type mapping function, given an
// expected date format. The format is an at-least-three-element array, which
// must be a permutation of ['year','month','day',...] where the ... represents
// any number of false values for ignored fields (eg, day of week), representing
// the order those three fields occur in the date strings.

exports.makeCombinedDateType = (format) => {
  // Parse the format

  let yearIndex = -1;
  let monthIndex = -1;
  let dayIndex = -1;

  if (format && format.length > 0) {
    yearIndex = format.indexOf('year');
    monthIndex = format.indexOf('month');
    dayIndex = format.indexOf('day');

    if (yearIndex == -1 || monthIndex == -1 || dayIndex == -1) {
      throw new Error("A date format must include year,month and day");
    }
  }

  // The returned type mapper
  return (inputCell) => {
    let inputValue = inputCell.v;

    // Is the input value a date object, because sheets.js handled conversion for us?
    if (inputValue instanceof Date) {
      let date = makeDate(inputValue.getFullYear(), inputValue.getMonth() + 1, inputValue.getDate());
      return ati.successfulMapping(date, []);
    }

    // Is the input value a string... or something else, that we'll turn into a string and do our best with?
    else {
      if (yearIndex == -1) {
        return ati.failedMapping([], [errors.ValidationError.UnknownDateFormat({value: inputValue, type: "date"})]);
      }

      let parts = String(inputValue).split(/[^a-z0-9]+/i); // Split out any runs of alphanumeric characters

      if (parts.length != format.length) {
        return ati.failedMapping([], [ errors.ValidationError.UnrecognisableDateFormat({value: inputValue, type: "date"})]);
      }

      let [yearErrors, yearWarnings, year] = parseYear(parts[yearIndex]);
      let [monthErrors, monthWarnings, month] = parseMonth(parts[monthIndex]);
      let [dayErrors, dayWarnings, day] = parseDay(parts[dayIndex], year, month);

      let allErrors = yearErrors.concat(monthErrors).concat(dayErrors);
      let allWarnings = yearWarnings.concat(monthWarnings).concat(dayWarnings);

      if (allErrors.length > 0) {
        return ati.failedMapping(allWarnings, allErrors);
      }

      let date = makeDate(year, month, day);
      return ati.successfulMapping(date, allWarnings);
    }
  };
}
