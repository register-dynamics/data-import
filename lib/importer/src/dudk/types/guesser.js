
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

// Given a sheet.js field, return two values. First is a list of possible types
// for it, as a map from type names to either:

// 1. false, for a type that doesn't have formats, or:

// 2. an array of possible formats (with names compatible with
// mapperForField).

// The second value returned is a boolean: true iff it's considered a blank
// field.
exports.ListPossibleTypes = (field) => {
  let possibleTypes = new Map();

  switch(field.t) {
  case "b":
    // We don't have a boolean type yet, but we need to report SOMETHING
    // when we find a boolean value
    possibleTypes.set("boolean", false);
    if(field.v == "" || field.v === undefined || field.v === null) {
      return [possibleTypes, true];
    } else {
      return [possibleTypes, false];
    }
    break;
  case "n":
    possibleTypes.set("number", false);
    if(field.v == "" || field.v === undefined || field.v === null) {
      return [possibleTypes, true];
    } else {
      return [possibleTypes, false];
    }
    break;
  case "d":
    // This is a pre-parsed date (of type "date") but it might be
    // intermingled with any other date format in text, so we return all
    // possibilities
    possibleTypes.set("date", ["native","dmy","ymd","ydm","mdy"]);
    if(field.v == "" || field.v === undefined || field.v === null) {
      return [possibleTypes, true];
    } else {
      return [possibleTypes, false];
    }
    break;
  case "e": // Error
  case "z": // Empty cell
    // Either way, we can't narrow the set of possible types, but it's a blank cell
    return [false, true];
  case "s":
    // String
    if(field.v == "" || field.v === undefined || field.v === null) {
      // Empty string, so we can't narrow the types, but it's a blank cell
      return [false, true];
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
