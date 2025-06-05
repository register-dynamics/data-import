/**
 * A trimmed down JS port of the TS library at https://github.com/patrik-csak/BB26/
 * with more limited functionality and fewer TS-isms
 */

exports.toBase26 = (i) => {
    let str = '';
    let num = i;

    while (num > 0) {
        const m = num % 26 || 26;

        str = String.fromCodePoint('A'.codePointAt(0) - 1 + m) + str;
        num = Math.floor((num - 1) / 26);
    }

    return str;
}


exports.fromBase26 = (s) => {
    let num = 0;

    for (let i = 0; i < s.length; i++) {
        const ch = s[s.length - i - 1];
        num += 26 ** i * (ch.codePointAt(0) - 'A'.codePointAt(0) + 1);
    }

    return num;
}
