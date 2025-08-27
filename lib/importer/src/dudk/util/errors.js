
const Enum = require('./enum');

exports.ValidationError = Enum.define({
    EmptyRow: [{}],
    FieldRequired: ['value', 'type' ],
    IncorrectType: ['value', 'type' ],
    UnknownDateFormat: ['value', 'type' ],
    UnrecognisableDateFormat: ['value', 'type' ],
    MonthUnrecognised: ['value', 'type' ], // "Months must either be numbers or recognised names, but we found " + str
    MonthOutOfRange: ['value', 'type' ], // "Month numbers must be in the range 1-12, but we found " + str]
    DayOutOfRange: ['value', 'type' ], // "Day numbers must be in the range 1-31, but we found " + str]
    DayWrongType: ['value', 'type' ], // "Day must be a number, but we found " + str,
    DateGuessing20thCentury: ['value', 'type' ], // "Guessing a two-digit year " + str + " is in the 20th century"
    DateGuessing21stCentury: ['value', 'type' ], // "Guessing a two-digit year " + str + " is in the 21st century"
});
