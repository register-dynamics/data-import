

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

const count_string = (count) => {
    if (count == 1) return "once";
    if (count == 2) return "twice";

    return number_to_word(count) + " times";
}

const number_to_word = (number) => {
    let n = parseInt(number);
    if (isNaN(n)) {
        return "zero";
    }

    const singles = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
    const doubles = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
    const tens = ['twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']

    const translate = (n) => {
        if (n < 10) {
            return singles[n] + ' ';
        }

        if (n < 20) {
            return doubles[n - 10] + ' ';
        }

        if (n < 100) {
            let remainder = n % 10;
            return tens[(n - n % 10) / 10 - 2] + ' ' + translate(remainder);
        }

        // FIXME: Either handle larger numbers or we need to find an alternative mechanism
        // for too many errors
        return "many";
    }

    return translate(n).trim();
}


module.exports = { currency, slugify, pluralize, debug, count_string }
