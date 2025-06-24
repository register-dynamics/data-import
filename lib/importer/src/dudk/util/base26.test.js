const b26 = require('./base26');

describe("Base26 tests", () => {

    test('to base 26', () => {
        [
            [1, "A"],
            [27, "AA"],
            [30, "AD"],
            [55, "BC"],
            [2112, "CCF"]

        ].forEach(([i, s]) => {
            expect(b26.toBase26(i)).toStrictEqual(s)
        });
    });

    test('from base 26', () => {
        [
            ["A", 1],
            ["AA", 27],
            ["AD", 30],
            ["BC", 55],
            ["CCF", 2112],
            ["ABRACADABRA", 155793962459877],

        ].forEach(([s, i]) => {
            expect(b26.fromBase26(s)).toStrictEqual(i)
        });
    });
});
