const dgram = require('dgram');
const { encodeHost, encodeIpAddress } = require('./encoder');
const { decodeHost } = require('./decoder');

function constructAnswer(question) {
  const bufferArray = [];

  const answerName = encodeHost(question.questionName);
  bufferArray.push(answerName);

  const answerType = Buffer.alloc(2);
  answerType.writeUInt16BE(1, 0);
  bufferArray.push(answerType);

  const answerClass = Buffer.alloc(2);
  answerClass.writeUInt16BE(1, 0);
  bufferArray.push(answerClass);

  const answerTtl = Buffer.alloc(4);
  answerTtl.writeUInt32BE(60, 0);
  bufferArray.push(answerTtl);

  const answerLength = Buffer.alloc(2);
  answerLength.writeUInt16BE(4, 0);
  bufferArray.push(answerLength);

  const answerData = Buffer.alloc(4);
  answerData.writeUInt32BE(encodeIpAddress('8.8.8.8'), 0);
  bufferArray.push(answerData);

  return Buffer.concat(bufferArray);
}

function constructQuestion(question) {
  const bufferArray = [];

  const questionName = encodeHost(question.questionName);
  bufferArray.push(questionName);

  const questionType = Buffer.alloc(2);
  questionType.writeUInt16BE(1, 0);
  bufferArray.push(questionType);

  const questionClass = Buffer.alloc(2);
  questionClass.writeUInt16BE(1, 0);
  bufferArray.push(questionClass);

  return Buffer.concat(bufferArray);
}

function constructHeader(header) {
  const buffer = Buffer.alloc(12);

  // Packet Identifier
  buffer.writeUInt16BE(header.packetIdentifier, 0);

  // Flags
  let flags = 0;
  flags |= (1 << 15); // Query/Response Indicator (1 bit)
  flags |= (header.operationCode << 11); // Operation Code (4 bits)
  flags |= (0 << 10); // Authoritative Answer (1 bit)
  flags |= (0 << 9);  // Truncation (1 bit)
  flags |= (header.recursionDesired << 8);  // Recursion Desired (1 bit)
  flags |= (0 << 7);  // Recursion Available (1 bit)
  flags |= (0 << 4);  // Reserved (3 bits)
  flags |= (header.operationCode === 0 ? 0 : 4 << 0);  // Response Code (4 bits)
  buffer.writeUInt16BE(flags, 2);

  // Question Count
  buffer.writeUInt16BE(1, 4);

  // Answer Record Count
  buffer.writeUInt16BE(1, 6);

  // Authority Record Count
  buffer.writeUInt16BE(0, 8);

  // Additional Record Count
  buffer.writeUInt16BE(0, 10);

  return buffer;
}

function parseHeader(buffer, offset) {
  const packetIdentifier = buffer.readUInt16BE(offset);

  // Extract flags from the third byte
  const thirdByte = buffer.readUInt8(offset + 2);
  const queryOrResponseIndicator = (thirdByte >> 7) & 0x01;
  const operationCode = (thirdByte >> 3) & 0x0F;
  const authoritativeAnswer = (thirdByte >> 2) & 0x01;
  const truncation = (thirdByte >> 1) & 0x01;
  const recursionDesired = thirdByte & 0x01;

  // Extract flags from the fourth byte
  const fourthByte = buffer.readUInt8(offset + 3);
  const recursionAvailable = (fourthByte >> 7) & 0x01;
  const reserved = (fourthByte >> 4) & 0x07;
  const responseCode = fourthByte & 0x0F;

  // Read counts
  const questionCount = buffer.readUInt16BE(offset + 4);
  const answerRecordCount = buffer.readUInt16BE(offset + 6);
  const authorityRecordCount = buffer.readUInt16BE(offset + 8);
  const additionalRecordCount = buffer.readUInt16BE(offset + 10);

  const parsedHeader = {
    packetIdentifier,
    queryOrResponseIndicator,
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
  };

  console.log('Incoming message header', parsedHeader);

  return parsedHeader;
}

function parseQuestion(buffer, offset) {
  const questionBuffer = buffer.subarray(offset);
  const { host: questionName, cursor: questionNameLength } = decodeHost(questionBuffer);
  const questionType = questionBuffer.readUInt16BE(questionNameLength);
  const questionClass = questionBuffer.readUInt16BE(questionNameLength + 2);

  const question = { questionName, questionType, questionClass };
  console.log('Incoming question', question);

  return question;
}

const udpSocket = dgram.createSocket('udp4');
udpSocket.bind(2053, '127.0.0.1');

udpSocket.on('message', (incomingMessage, rinfo) => {
  try {
    const header = parseHeader(incomingMessage, 0);
    const question = parseQuestion(incomingMessage, 12);

    const response = Buffer.concat([constructHeader(header), constructQuestion(question), constructAnswer(question)]);

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
