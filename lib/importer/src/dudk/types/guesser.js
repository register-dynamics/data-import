
// A number from 1-31
const DAY_NUMBER = "((0?[1-9])|([0-2][0-9])|(3[01]))";

// A number from 1-12
const MONTH_NUMBER = "((0?[1-9])|(1[012]))";

// A month name
const MONTH_NAME = "[a-zA-Z]{3,9}"; // Length could from "jan" (3) to "september" (9)

const MONTH = "(" + MONTH_NUMBER + "|" + MONTH_NAME + ")";

// A two or four digit number
const YEAR_NUMBER = "([0-9]{2}|[0-9]{4})";

// Likely date separator characters
const DATE_SEP = "[ -_/]";

const TYPE_PATTERNS = [
  {name:"date",
   format:"ymd",
   regexp: new RegExp("^" + YEAR_NUMBER + DATE_SEP + MONTH + DATE_SEP + DAY_NUMBER + "$","i")},
  {name:"date",
   format:"ydm",
   regexp: new RegExp("^" + YEAR_NUMBER + DATE_SEP + DAY_NUMBER + DATE_SEP + MONTH + "$","i")},
  {name:"date",
   format:"dmy",
   regexp: new RegExp("^" + DAY_NUMBER + DATE_SEP + MONTH + DATE_SEP + YEAR_NUMBER + "$","i")},
  {name:"date",
   format:"mdy",
   regexp: new RegExp("^" + MONTH + DATE_SEP + DAY_NUMBER + DATE_SEP + YEAR_NUMBER + "$","i")},
  {name: "number",
   regexp: new RegExp("^(-|\\+)?[0-9]+(.[0-9]+)?(e(-|\\+)[0-9]+)?$","i")},
];

exports.TYPE_PATTERNS = TYPE_PATTERNS;

// Does the format string look like a date?  See "Common Date-Time Formats" at
// https://docs.sheetjs.com/docs/csf/features/dates for the source of these
// patterns.
const formatStringPartRE = new RegExp("[^a-zA-Z]+");
// Note that m and mm can also represent minutes in time formats
const formatStringDateParts = ["yy","yyyy","m","mm","mmm","mmmm","mmmmm","d","dd","ddd","dddd"];
function isDateFormat(fmt) {
  const parts = fmt.split(formatStringPartRE);
  // Is every token in the format string valid for a date format?
  return parts.every((part) => formatStringDateParts.includes(part));
}

// Given a sheet.js field, return two values. First is a list of possible types
// for it, as a map from type names to either:

// 1. false, for a type that doesn't have formats, or:

// 2. an array of possible formats (with names compatible with
// mapperForField).

// The second value returned is a boolean: true iff it's considered a blank
// field.
exports.ListPossibleTypes = (field) => {
  let possibleTypes = new Map();
  const isBlank = field.v == "" || field.v === undefined || field.v === null;

  switch(field.t) {
  case "b":
    // We don't have a boolean type yet, but we need to report SOMETHING
    // when we find a boolean value
    possibleTypes.set("boolean", false);
    return [possibleTypes, isBlank];
    break;
  case "n":
    possibleTypes.set("number", false);
    return [possibleTypes, isBlank];
    break;
  case "e": // Error
  case "z": // Empty cell
    // Either way, we can't narrow the set of possible types, but it's a blank cell
    return [false, true];
  case "d": // Date or time or both
    if(field.z) {
      if(isDateFormat(field.z)) {
        possibleTypes.set("date", ["native"]);
      }
      // FIXME: Add cases for time formats, eg "h:mm", when we support them
      return [possibleTypes, isBlank];
    } else {
      // Field format code in field.z should always be present, but let's fail
      // quietly if not rather than ruining the whole import
      return [possibleTypes, isBlank];
    }
    break;
  case "s":
    // String
    if(isBlank) {
      // Empty string, so we can't narrow the types, but it's a blank cell
      return [false, isBlank];
    }
    else {
      // Check it against each type pattern
      for(let i = 0; i < TYPE_PATTERNS.length; i++) {
        let pattern = TYPE_PATTERNS[i];

        // FIXME: Skip ones not in guesses[col].types as they're already
        // eliminated, save some CPU
        if(field.v.match(pattern.regexp)) {
          if(pattern.format) {
            if(!possibleTypes.has(pattern.name)) {
              possibleTypes.set(pattern.name, []);
            }
            possibleTypes.get(pattern.name).push(pattern.format);
          } else {
            possibleTypes.set(pattern.name, false);
          }
        }
      }

      // Anything found in a string column could be text, so always add that
      // option
      possibleTypes.set("text", false);

      return [possibleTypes, false];
    }
  }

  // Hmmm, we dropped out of the case statement, presumably due to an unknown
  // type of value from sheet.js... Best treat it as a blank cell, but maybe we
  // should log a warning?
  return [false, true];
};
