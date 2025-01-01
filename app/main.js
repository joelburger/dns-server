const dgram = require('dgram');
const cowsay = require('cowsay');
const {encodeHost, encodeIpAddress} = require('./encoder');
const process = require('process');

const state = {
    questions: [],
    answers: [],
};

function constructAnswers(answers) {
    const bufferArray = [];

    for (const answer of answers) {
        bufferArray.push(encodeHost(answer.questionName));

        const answerType = Buffer.alloc(2);
        answerType.writeUInt16BE(answer.answerType, 0);
        bufferArray.push(answerType);

        const answerClass = Buffer.alloc(2);
        answerClass.writeUInt16BE(answer.answerClass, 0);
        bufferArray.push(answerClass);

        const answerTtl = Buffer.alloc(4);
        answerTtl.writeUInt32BE(answer.answerTtl, 0);
        bufferArray.push(answerTtl);

        const answerLength = Buffer.alloc(2);
        answerLength.writeUInt16BE(4, 0);
        bufferArray.push(answerLength);

        bufferArray.push(answer.answerData);
    }

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

    return bufferArray;
}

function constructQuestions(questions) {
    const bufferArray = [];

    for (const question of questions) {
        const questionBuffer = constructQuestion(question);
        bufferArray.push(...questionBuffer);
    }

    return Buffer.concat(bufferArray);
}

function constructRequestHeader(packetIdentifier) {
    const buffer = Buffer.alloc(12);

    // Packet Identifier
    buffer.writeUInt16BE(packetIdentifier, 0);

    // Flags
    let flags = 0;
    flags |= 0 << 15; // Query/Response Indicator (1 bit)
    flags |= 0 << 11; // Operation Code (4 bits)
    flags |= 0 << 10; // Authoritative Answer (1 bit)
    flags |= 0 << 9; // Truncation (1 bit)
    flags |= 0 << 8; // Recursion Desired (1 bit)
    flags |= 0 << 7; // Recursion Available (1 bit)
    flags |= 0 << 4; // Reserved (3 bits)
    flags |= 0; // Response Code (4 bits)
    buffer.writeUInt16BE(flags, 2);

    // Question Count
    buffer.writeUInt16BE(1, 4);

    // Answer Record Count
    buffer.writeUInt16BE(0, 6);

    // Authority Record Count
    buffer.writeUInt16BE(0, 8);

    // Additional Record Count
    buffer.writeUInt16BE(0, 10);

    return buffer;
}

function constructResponseHeader(header) {
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

    return {
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

        let questionNameParts = [];

        while (byte !== 0x0 && byte !== 0xc0) {
            questionNameParts.push(buffer.subarray(cursor, cursor + byte).toString());
            cursor += byte; // move cursor for question name
            byte = buffer[cursor];
            cursor += 1; // move cursor for byte
        }

        if (byte === 0xc0) {
            byte = buffer[cursor];
            questionNameParts = questionNameParts.concat(resolvePointer(buffer, byte));
        } else {
            questionType = buffer.readUInt16BE(cursor);
            cursor += 2; // move cursor for question type
            questionClass = buffer.readUInt16BE(cursor);
            cursor += 2; // move cursor for question class
        }

        const questionName = questionNameParts.join('.');
        const question = {questionName, questionType, questionClass};
        questions.push(question);
    }
    return {questions, offset: cursor};
}

function queryForwardingDnsServer(querySocket, questions, forwardingDnsAddress, forwardingDnsPort) {
    for (const question of questions) {
        const packetIdentifier = Math.floor(Math.random() * 65536);

        console.log(
            `[${packetIdentifier}] - Querying ${forwardingDnsAddress}:${forwardingDnsPort}: ${question.questionName}`,
        );

        const requestHeader = constructRequestHeader(packetIdentifier);
        const requestQuestion = Buffer.concat(constructQuestion(question));
        const request = Buffer.concat([requestHeader, requestQuestion]);
        querySocket.send(request, forwardingDnsPort, forwardingDnsAddress);
    }
}

function parseAnswer(response, offset) {
    const buffer = response.subarray(offset);

    let cursor = 0;
    let byte = buffer[cursor];

    cursor += 1; // move cursor for byte

    const questionNameParts = [];
    while (byte !== 0x0) {
        const questionName = buffer.subarray(cursor, cursor + byte);
        questionNameParts.push(questionName);
        cursor += byte;
        byte = buffer[cursor];
        cursor += 1; // move cursor for byte
    }

    const questionName = questionNameParts.join('.');
    const answerType = buffer.readUInt16BE(cursor);
    cursor += 2; // move cursor for answer type
    const answerClass = buffer.readUInt16BE(cursor);
    cursor += 2;
    const answerTtl = buffer.readUInt32BE(cursor);
    cursor += 4;
    const answerLength = buffer.readUInt16BE(cursor);
    cursor += 2;
    const answerData = buffer.subarray(cursor, cursor + answerLength);

    return {
        questionName,
        answerType,
        answerClass,
        answerTtl,
        answerLength,
        answerData,
    };
}

function startServer(udpSocket, querySocket, address, port, forwardingDnsAddress, forwardingDnsPort) {
    udpSocket.bind(port, address);

    querySocket.on('message', (incomingMessage, rinfo) => {
        const header = parseHeader(incomingMessage, 0);
        const {questions, offset} = parseQuestions(incomingMessage, 12, header.questionCount);
        const answer = parseAnswer(incomingMessage, offset);
        console.log('Query socket', {header, questions, answer});
        state.answers.push(answer);
    });

    querySocket.on('error', (err) => {
        console.log(`Query socket error: ${err}`);
    });

    udpSocket.on('message', (incomingMessage, rinfo) => {
        const header = parseHeader(incomingMessage, 0);
        console.log('Main socket', header);
        const {questions, offset} = parseQuestions(incomingMessage, 12, header.questionCount);
        queryForwardingDnsServer(querySocket, questions, forwardingDnsAddress, forwardingDnsPort);

        const intervalId = setInterval(() => {
            if (state.answers.length > 0) {
                console.log('Replying back to client');

                clearInterval(intervalId);

                const response = Buffer.concat([
                    constructResponseHeader(header),
                    constructQuestions(questions),
                    constructAnswers(state.answers),
                ]);

                udpSocket.send(response, rinfo.port, rinfo.address);

                state.answers = [];
            }
        }, 100);
    });

    udpSocket.on('error', (err) => {
        console.log(`Error: ${err}`);
    });

    udpSocket.on('listening', () => {
        const address = udpSocket.address();
        console.log(cowsay.say({text: `Server listening on ${address.address}:${address.port}`}));
    });
}

const parameters = process.argv.slice(2);

const udpSocket = dgram.createSocket('udp4');
const querySocket = dgram.createSocket('udp4');

const [, forwardingAddressAndPort] = parameters;
const [forwardingAddress, forwardingPortAsString] = forwardingAddressAndPort.split(':');

startServer(udpSocket, querySocket, '127.0.0.1', 2053, forwardingAddress, Number(forwardingPortAsString));
