const dgram = require('dgram');
const {encodeHost, encodeIpAddress} = require('./encoder');

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

function constructAnswer() {
    const bufferArray = [];

    const answerName = encodeHost('codecrafters.io');
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

function constructQuestion() {
    const bufferArray = [];

    const questionName = encodeHost('codecrafters.io');
    bufferArray.push(questionName);

    const questionType = Buffer.alloc(2);
    questionType.writeUInt16BE(1, 0);
    bufferArray.push(questionType);

    const questionClass = Buffer.alloc(2);
    questionClass.writeUInt16BE(1, 0);
    bufferArray.push(questionClass);

    return Buffer.concat(bufferArray);
}

function constructHeader() {
    const buffer = Buffer.alloc(12);

    // Packet Identifier
    buffer.writeUInt16BE(1234, 0);

    // Flags
    let flags = 0;
    flags |= (1 << 15); // Query/Response Indicator (1 bit)
    flags |= (0 << 11); // Operation Code (4 bits)
    flags |= (0 << 10); // Authoritative Answer (1 bit)
    flags |= (0 << 9);  // Truncation (1 bit)
    flags |= (1 << 8);  // Recursion Desired (1 bit)
    flags |= (0 << 7);  // Recursion Available (1 bit)
    flags |= (0 << 4);  // Reserved (3 bits)
    flags |= (0 << 0);  // Response Code (4 bits)
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

        const response = Buffer.concat([constructHeader(), constructQuestion(), constructAnswer()]);

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
