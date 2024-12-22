const dgram = require('dgram');
const { encodeHost } = require('./encoder');

// function createResponse() {
//   const buffer = Buffer.alloc(12);
//   buffer.writeUInt32BE(1 + 1 + message.length, 0); // length prefix
//   buffer.writeUInt8(20, 4); // message ID for all extensions
//   buffer.writeUInt8(0, 5); // extension message id
//   buffer.write(message, 6, 'binary');
// }

function readBit(buffer, byteIndex, bitIndex) {
  // 1. Get the byte at the specified index
  const byte = buffer[byteIndex];

  // 2. Shift the bits to the right so the target bit is the least significant bit
  const shiftedByte = byte >> bitIndex;

  // 3. Use bitwise AND with 1 to isolate the least significant bit
  return shiftedByte & 1;
}

function readBits(buffer, byteIndex, bitIndex, numberOfBits) {
  let bits = 0;
  for (let i = 0; i < numberOfBits; i++) {
    const bit = readBit(buffer, byteIndex, bitIndex + i);
    bits = (bits << 1) | bit;
  }
  return bits;
}

function constructQuestion() {
  let buffer = Buffer.alloc(0);

  const questionName = encodeHost('codecrafters.io');
  buffer = Buffer.concat([buffer, questionName]);

  const questionType = Buffer.alloc(2)
  questionType.writeUInt16BE(1, 0)
  buffer = Buffer.concat([buffer, questionType])

  const questionClass = Buffer.alloc(2)
  questionClass.writeUInt16BE(1, 0)
  return Buffer.concat([buffer, questionType])
}

function constructHeader() {
  const buffer = Buffer.alloc(12);
  buffer.writeUInt16BE(1234, 0);
  buffer.writeUInt16BE(0b1000000000000000, 2);
  buffer.writeUInt16BE(0, 4);
  buffer.writeUInt16BE(0, 6);
  buffer.writeUInt16BE(0, 8);
  buffer.writeUInt16BE(0, 10);

  return buffer;
}

function parseHeader(buffer) {
  const packetIdentifier = buffer.readUInt16BE(0);
  const queryResponseIndicator = readBit(buffer, 2, 0);
  const operationCode = readBits(buffer, 2, 1, 4);
  const authoritativeAnswer = readBit(buffer, 2, 5);
  const truncation = readBit(buffer, 2, 6);
  const recursionDesired = readBit(buffer, 2, 7);
  const recursionAvailable = readBit(buffer, 3, 0);
  const reserved = readBits(buffer, 3, 1, 3);
  const responseCode = readBits(buffer, 3, 4, 4);
  const questionCount = buffer.readUInt16BE(4);
  const answerRecordCount = buffer.readUInt16BE(6);
  const authorityRecordCount = buffer.readUInt16BE(8);
  const additionalRecordCount = buffer.readUInt16BE(10);

  console.log('Incoming message', {
    packetIdentifier,
    queryResponseIndicator,
    operationCode,
    authoritativeAnswer,
    truncation,
    recursionDesired,
    recursionAvailable,
    reserved,
    responseCode,
    questionCount,
    answerRecordCount,
    authorityRecordCount,
    additionalRecordCount,
  });
}

const udpSocket = dgram.createSocket('udp4');
udpSocket.bind(2053, '127.0.0.1');

udpSocket.on('message', (incomingMessage, rinfo) => {
  try {
    parseHeader(incomingMessage);


    const response = Buffer.concat([constructHeader(), constructQuestion()]);

    udpSocket.send(response, rinfo.port, rinfo.address);
  } catch (e) {
    console.log(`Error receiving data: ${e}`);
  }
});

udpSocket.on('error', (err) => {
  console.log(`Error: ${err}`);
});

udpSocket.on('listening', () => {
  const address = udpSocket.address();
  console.log(`Server listening ${address.address}:${address.port}`);
});
