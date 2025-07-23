

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

const debug = (obj) => {
    console.log(obj)
    return obj
}

module.exports = { currency, slugify, pluralize, debug }
