function decodeHost(buffer, offset) {
  let cursor = 0;
  const parts = [];

  const encodedHost = buffer.subarray(offset);
  while (cursor < encodedHost.length) {
    const marker = encodedHost[cursor];
    if (marker === 0) {
      break;
    }
    cursor++;

    if (marker === 0xC0) {
      console.log('pointer!!!');
    } else {
      const host = encodedHost.subarray(cursor, cursor + marker);
      cursor += marker;
      parts.push(host);
    }
  }
  return { host: parts.join('.'), cursor };
}

module.exports = {
  decodeHost,
};