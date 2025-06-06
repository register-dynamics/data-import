/*
* Functions based on code originally found in https://github.com/patrik-csak/BB26/ - copyright
* included for fairness.
*
* MIT License
*
* Copyright (c) Patrik Csak <p@trikcsak.com> (https://patrikcsak.com)
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
*
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
