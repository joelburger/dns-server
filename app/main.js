const dgram = require('dgram');
const cowsay = require('cowsay');
const { encodeHost, encodeIpAddress } = require('./encoder');
const { decodeHost } = require('./decoder');

function constructAnswers(questions) {
  const bufferArray = [];

  for (const question of questions) {
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

    const answerData = encodeIpAddress('8.8.8.8');
    bufferArray.push(answerData);
  }

  return Buffer.concat(bufferArray);
}

function constructQuestions(questions) {
  const bufferArray = [];

  for (const question of questions) {
    const questionName = encodeHost(question.questionName);
    bufferArray.push(questionName);

    const questionType = Buffer.alloc(2);
    questionType.writeUInt16BE(1, 0);
    bufferArray.push(questionType);

    const questionClass = Buffer.alloc(2);
    questionClass.writeUInt16BE(1, 0);
    bufferArray.push(questionClass);
  }

  return Buffer.concat(bufferArray);
}

function constructHeader(header) {
  const buffer = Buffer.alloc(12);

  // Packet Identifier
  buffer.writeUInt16BE(header.packetIdentifier, 0);

  // Flags
  let flags = 0;
  flags |= 1 << 15; // Query/Response Indicator (1 bit)
  flags |= header.operationCode << 11; // Operation Code (4 bits)
  flags |= 0 << 10; // Authoritative Answer (1 bit)
  flags |= 0 << 9; // Truncation (1 bit)
  flags |= header.recursionDesired << 8; // Recursion Desired (1 bit)
  flags |= 0 << 7; // Recursion Available (1 bit)
  flags |= 0 << 4; // Reserved (3 bits)
  flags |= header.operationCode === 0 ? 0 : 4 << 0; // Response Code (4 bits)
  buffer.writeUInt16BE(flags, 2);

  // Question Count
  buffer.writeUInt16BE(header.questionCount, 4);

  // Answer Record Count
  buffer.writeUInt16BE(header.questionCount, 6);

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
  const operationCode = (thirdByte >> 3) & 0x0f;
  const authoritativeAnswer = (thirdByte >> 2) & 0x01;
  const truncation = (thirdByte >> 1) & 0x01;
  const recursionDesired = thirdByte & 0x01;

  // Extract flags from the fourth byte
  const fourthByte = buffer.readUInt8(offset + 3);
  const recursionAvailable = (fourthByte >> 7) & 0x01;
  const reserved = (fourthByte >> 4) & 0x07;
  const responseCode = fourthByte & 0x0f;

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

function resolvePointer(buffer, pointer) {
  let cursor = pointer;
  const questionNameParts = [];
  let byte = buffer[cursor];

  cursor += 1;
  while (byte !== 0x0) {

    questionNameParts.push(buffer.subarray(cursor, cursor + byte).toString());
    cursor += byte; // move cursor for question name
    byte = buffer[cursor];
    cursor += 1; // move cursor for byte
  }
  return questionNameParts;
}

function parseQuestions(buffer, offset, questionCount) {
  const questions = [];
  let cursor = offset;
  let questionType, questionClass;
  for (let i = 0; i < questionCount; i++) {
    let byte = buffer[cursor];
    cursor += 1; // move cursor for byte
    if (byte === 0xc0) {
      cursor += 1; // move cursor for byte
      byte = buffer[cursor];
      const questionNameParts = resolvePointer(buffer, byte);
      const questionType = buffer.readUInt16BE(cursor);
      cursor += 2; // move cursor for question type
      const questionClass = buffer.readUInt16BE(cursor);
      cursor += 2; // move cursor for question class
      const questionName = questionNameParts.join('.');
      const question = { questionName, questionType, questionClass };
      console.log('Incoming question 2', question);
      questions.push(question);
    } else {
      let questionNameParts = [];

      while (byte !== 0x0 && byte !== 192) {
        questionNameParts.push(buffer.subarray(cursor, cursor + byte).toString());
        cursor += byte; // move cursor for question name
        byte = buffer[cursor];

        console.log(`foo ${byte}`);
        cursor += 1; // move cursor for byte
      }

      if (byte === 192) {
        byte = buffer[cursor];
        questionNameParts = questionNameParts.concat(resolvePointer(buffer, byte));
        console.log('questionNameParts', questionNameParts);
      } else {
        questionType = buffer.readUInt16BE(cursor);
        cursor += 2; // move cursor for question type
        questionClass = buffer.readUInt16BE(cursor);
        cursor += 2; // move cursor for question class
      }

      const questionName = questionNameParts.join('.');
      const question = { questionName, questionType, questionClass };
      console.log('Incoming question', question);
      questions.push(question);
    }
  }
  return questions;
}

const udpSocket = dgram.createSocket('udp4');
udpSocket.bind(2053, '127.0.0.1');

udpSocket.on('message', (incomingMessage, rinfo) => {
  try {
    const header = parseHeader(incomingMessage, 0);
    const questions = parseQuestions(incomingMessage, 12, header.questionCount);

    const response = Buffer.concat([
      constructHeader(header),
      constructQuestions(questions),
      constructAnswers(questions),
    ]);

    // console.log(cowsay.say({ text: JSON.stringify({ response }) }));

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
