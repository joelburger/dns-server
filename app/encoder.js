function encodeString(value) {
  const lengthBuffer = Buffer.alloc(1);
  lengthBuffer.writeUInt8(value.length);
  const valueBuffer = Buffer.from(value, 'ascii');
  return Buffer.concat([lengthBuffer, valueBuffer]);
}

function encodeNumber(value) {
  return Buffer.from(value);
}

function encodeHost(host) {
  if (!host) {
    return Buffer.from([0x00]);
  }

  const parts = host.split('.');
  const encodedParts = parts.map(encodeString);

  return Buffer.concat([...encodedParts, Buffer.from([0x00])]);
}

function encodeIpAddress(ipAddress) {
  const parts = ipAddress.split('.');
  const encodedParts = parts.map(encodeNumber);

  return Buffer.concat([...encodedParts]);
}

module.exports = {
  encodeHost,
  encodeIpAddress,
};