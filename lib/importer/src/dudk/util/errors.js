
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


exports.ErrorMessages = class ErrorMessages {
    /**
     * Given an object, the properties and values are assigned to this
     * class as properties.
     *
     * In the expected use-case (loaded from error_messages.json) these
     * property keys will be the error variant names. The values
     * will be the error messages, with placeholders for dynamic content.
     */
    constructor(props = {}) {
        Object.assign(this, props);
    }

    /**
     * Looks up a stored property based on error.variant.
     * Given an error of {variant: "FieldRequired", type: "string"}
     * and a field of "field1" this function will locate the string
     * assigned to the local `FieldRequired` property and interpolate
     * all of the values from the error and the provided fieldname.
     */
    lookup(error, fieldname) {
        if (!error || !error.variant) return undefined;
        const message = this[error.variant];
        if (typeof message === 'string') {
            // Interpolate ${field}, and ${value}/${type} from error
                return message.replace(/\$\{(\w+)\}/g, (match, p1) => {
                    if (p1 === 'field') return fieldname;
                if (Object.prototype.hasOwnProperty.call(error, p1)) return error[p1];
                return match;
            });
        }
        return message;
    }

    static load = (filename) => {
        return require(filename);
    }
};
