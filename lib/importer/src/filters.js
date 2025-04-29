

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

module.exports = { currency, slugify }
