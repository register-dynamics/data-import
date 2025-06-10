const base26 = require('./base26')

const currency = (content) => {
    const num = parseInt(content)
    if (num === undefined) {
        return content
    }

    return "£" + num.toLocaleString()
}

// Converts the provided text to a slug style format that
// can be used as a HTML id (for instance)
const slugify = (content) => {
    return content.toLowerCase().replace(/[^\w\s']|_/g, " ").replace(/\s+/g, "-");
}

const pluralize = (count, singular, plural) => {
    if (count == 1) return singular;
    return plural
}

const encode_header = (idx) => {
    // Add 1 as the idx will be 0-based and we want
    // 1-based for the display.
    return base26.toBase26(idx + 1)
}

module.exports = { currency, slugify, pluralize, encode_header }
