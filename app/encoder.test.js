const {encodeHost} = require("./encoder");

test('encode a host', () => {
    // act
    const actual = encodeHost('google.co.nz');

    // assert
    const expected = Buffer.from([6, 103, 111, 111, 103, 108, 101, 2, 99, 111, 2, 110, 122, 0]);
    expect(actual).toStrictEqual(expected);
});