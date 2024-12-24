const { decodeHost } = require('./decoder');

test('decode an encoded host', () => {
  // act
  const { host: actual, cursor } = decodeHost( Buffer.from([6, 103, 111, 111, 103, 108, 101, 2, 99, 111, 2, 110, 122, 0]));

  // assert
  const expected = 'google.co.nz';
  expect(actual).toStrictEqual(expected);
  expect(cursor).toBe(13);
});