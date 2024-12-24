function decodeHost(encodedHost) {
  let cursor = 0;
  const parts = [];
  while (cursor < encodedHost.length) {
    const hostLength = encodedHost[cursor];
    if (hostLength === 0) {
      break;
    }
    cursor++;
    const host = encodedHost.subarray(cursor, cursor + hostLength);
    cursor += hostLength;
    parts.push(host);
  }
  return { host: parts.join('.'), cursor };
}

module.exports = {
  decodeHost,
};