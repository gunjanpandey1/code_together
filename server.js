const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { exec } = require('child_process');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});


const PORT = process.env.PORT || 3000;
const TEMP_DIR = path.join(__dirname, 'server', 'temp');
const TIMEOUT = 5000; 
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('.'));
fs.ensureDirSync(TEMP_DIR);
const problemDifficulties = {
    1: 'easy', 2: 'easy', 3: 'easy', 4: 'easy',
    5: 'medium', 6: 'medium', 7: 'medium',
    8: 'hard', 9: 'hard', 10: 'hard'
};

function getDifficultyPoints(difficulty) {
    switch (difficulty) {
        case 'easy': return 10;
        case 'medium': return 25;
        case 'hard': return 50;
        default: return 0;
    }
}

const socketRooms = new Map();
const serverRooms = new Map();
const serverUsers = new Map();
const roomLeaderboards = new Map(); 
const userSocketMap = new Map(); 
const socketUserMap = new Map(); 

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    socket.on('authenticate', (username) => {
        userSocketMap.set(username, socket.id);
        socketUserMap.set(socket.id, username);
        console.log(`User ${username} authenticated with socket ${socket.id}`);
    });
    socket.on('join-room', (data) => {
        const { roomCode, username } = data;
        socket.join(roomCode);
        
        if (!socketRooms.has(roomCode)) {
            socketRooms.set(roomCode, new Set());
        }
        socketRooms.get(roomCode).add(socket.id);
        
        console.log(`User ${username} (${socket.id}) joined room ${roomCode}`);
        const room = serverRooms.get(roomCode);
    
        if (room) {
            io.to(roomCode).emit('room-updated', room);
            console.log(`Broadcasting updated room state to everyone in room ${roomCode}. Participants: ${room.participants.length}`);
        }
        io.emit('rooms-list-updated');
    });
    
    socket.on('leave-room', (data) => {
        const { roomCode, username } = data;
        socket.leave(roomCode);
        
        if (socketRooms.has(roomCode)) {
            socketRooms.get(roomCode).delete(socket.id);
            if (socketRooms.get(roomCode).size === 0) {
                socketRooms.delete(roomCode);
            }
        }
        
        console.log(`User ${username} (${socket.id}) left room ${roomCode}`);
        const room = serverRooms.get(roomCode);
        if (room && username) {
            const userIndex = room.participants.indexOf(username);
            if (userIndex > -1) {
                room.participants.splice(userIndex, 1);
                room.chatMessages.push({
                    id: Date.now(),
                    sender: 'System',
                    message: `${username} left the room`,
                    timestamp: new Date().toISOString(),
                    type: 'system'
                });
                
                console.log(`Updated room ${roomCode} - removed ${username}, now has ${room.participants.length} participants`);
            }
            if (room.participants.length === 0) {
                serverRooms.delete(roomCode);
                roomLeaderboards.delete(roomCode); 
                console.log(`Room ${roomCode} deleted - no participants remaining`);
                io.emit('room-leaderboard-reset', {
                    roomCode: roomCode,
                    message: 'Room closed - leaderboard reset'
                });
            }
        }
        socket.to(roomCode).emit('user-left', {
            username: username,
            socketId: socket.id
        });
        if (room && room.participants.length > 0) {
            io.to(roomCode).emit('room-updated', room);
        }
        io.emit('rooms-list-updated');
    });
    
    socket.on('code-change', (data) => {
        socket.to(data.roomCode).emit('code-update', {
            code: data.code,
            userId: socket.id
        });
    });
    
    socket.on('chat-message', (data) => {
        socket.to(data.roomCode).emit('new-message', {
            message: data.message,
            sender: data.sender,
            timestamp: new Date().toISOString()
        });
    });
    socket.on('problem-solved', (data) => {
        const { username, problemId, score, problemsSolved } = data;
        console.log(`User ${username} solved problem ${problemId}`);
        io.emit('leaderboard-updated', {
            username: username,
            score: score,
            problemsSolved: problemsSolved
        });
    });
    
    socket.on('disconnect', () => {
        const username = socketUserMap.get(socket.id);
        console.log('User disconnected:', socket.id, username);
        if (username) {
            userSocketMap.delete(username);
            socketUserMap.delete(socket.id);
        }
        for (const [roomCode, users] of socketRooms.entries()) {
            if (users.has(socket.id)) {
                users.delete(socket.id);
                socket.to(roomCode).emit('user-left', {
                    username: username || 'Unknown User',
                    socketId: socket.id
                });
                const room = serverRooms.get(roomCode);
                if (room && username && room.participants.includes(username)) {
                    const userIndex = room.participants.indexOf(username);
                    if (userIndex > -1) {
                        room.participants.splice(userIndex, 1);
                        room.chatMessages.push({
                            id: Date.now(),
                            sender: 'System',
                            message: `${username} disconnected`,
                            timestamp: new Date().toISOString(),
                            type: 'system'
                        });
                        if (room.participants.length === 0) {
                            serverRooms.delete(roomCode);
                            console.log(`Room ${roomCode} deleted after disconnect - no participants remaining`);
                            io.emit('room-leaderboard-reset', {
                                roomCode: roomCode,
                                message: 'Room closed - leaderboard reset'
                            });
                        } else {
                            io.to(roomCode).emit('room-updated', room);
                        }
                    }
                }
                
                if (users.size === 0) {
                    socketRooms.delete(roomCode);
                }
            }
        }
    });
});

// Test cases for problems
const testCases = {
    1: { // Two Sum
        inputs: [
            { nums: [2, 7, 11, 15], target: 9, expected: [0, 1] },
            { nums: [3, 2, 4], target: 6, expected: [1, 2] },
            { nums: [3, 3], target: 6, expected: [0, 1] },
            { nums: [1, 2, 3, 4, 5], target: 9, expected: [3, 4] },
            { nums: [-1, -2, -3, -4, -5], target: -8, expected: [2, 4] }
        ]
    },
    2: { // Reverse String
        inputs: [
            { s: ['h', 'e', 'l', 'l', 'o'], expected: ['o', 'l', 'l', 'e', 'h'] },
            { s: ['H', 'a', 'n', 'n', 'a', 'h'], expected: ['h', 'a', 'n', 'n', 'a', 'H'] },
            { s: ['a'], expected: ['a'] },
            { s: ['a', 'b'], expected: ['b', 'a'] },
            { s: ['1', '2', '3', '4', '5'], expected: ['5', '4', '3', '2', '1'] }
        ]
    },
    3: { // Palindrome Number
        inputs: [
            { x: 121, expected: true },
            { x: -121, expected: false },
            { x: 10, expected: false },
            { x: 0, expected: true },
            { x: 1221, expected: true }
        ]
    },
    4: { // Valid Parentheses
        inputs: [
            { s: "()", expected: true },
            { s: "()[]{}", expected: true },
            { s: "(]", expected: false },
            { s: "([)]", expected: false },
            { s: "{[]}", expected: true }
        ]
    },
    5: { // Maximum Subarray
        inputs: [
            { nums: [-2, 1, -3, 4, -1, 2, 1, -5, 4], expected: 6 },
            { nums: [1], expected: 1 },
            { nums: [5, 4, -1, 7, 8], expected: 23 },
            { nums: [-2, -1], expected: -1 },
            { nums: [-5, -2, -8], expected: -2 }
        ]
    }
};

// Helper functions
function cleanupTempFiles(fileId) {
    const filesToClean = [
        path.join(TEMP_DIR, `${fileId}.cpp`),
        path.join(TEMP_DIR, `${fileId}.exe`),
        path.join(TEMP_DIR, `${fileId}`)
    ];
    
    filesToClean.forEach(file => {
        if (fs.existsSync(file)) {
            fs.removeSync(file);
        }
    });
}

function generateTestCode(problemId, userCode) {
    const problem = testCases[problemId];
    if (!problem) {
        throw new Error('Test cases not found for this problem');
    }
    let cleanUserCode = userCode.trim();

    const mainIndex = cleanUserCode.indexOf('int main(');
    if (mainIndex !== -1) {
        cleanUserCode = cleanUserCode.substring(0, mainIndex).trim();
    }
    const lines = cleanUserCode.split('\n');
    const filteredLines = lines.filter(line => {
        const trimmedLine = line.trim();
        return !trimmedLine.startsWith('#include') && 
               !trimmedLine.startsWith('using namespace') &&
               !trimmedLine.startsWith('using std::') &&
               trimmedLine !== '';
    });
    
    cleanUserCode = filteredLines.join('\n').trim();
    if (cleanUserCode && !cleanUserCode.endsWith('}')) {
        cleanUserCode += '\n}';
    }
    
    let testCode = '';
    testCode += `#include <iostream>
#include <vector>
#include <string>
#include <algorithm>
#include <stack>
#include <unordered_map>
#include <climits>
using namespace std;

${cleanUserCode}

int main() {
    int testsPassed = 0;
    int totalTests = ${problem.inputs.length};
    
`;

    // Generate test cases based on problem ID
    switch (problemId) {
        case 1: // Two Sum
            problem.inputs.forEach((test, index) => {
                testCode += `
    // Test case ${index + 1}
    {
        vector<int> nums = {${test.nums.join(', ')}};
        int target = ${test.target};
        vector<int> expected = {${test.expected.join(', ')}};
        vector<int> result = twoSum(nums, target);
        
        sort(result.begin(), result.end());
        sort(expected.begin(), expected.end());
        
        if (result == expected) {
            cout << "Test ${index + 1}: PASSED" << endl;
            testsPassed++;
        } else {
            cout << "Test ${index + 1}: FAILED" << endl;
            cout << "Expected: [";
            for (int i = 0; i < expected.size(); i++) {
                cout << expected[i];
                if (i < expected.size() - 1) cout << ", ";
            }
            cout << "]" << endl;
            cout << "Got: [";
            for (int i = 0; i < result.size(); i++) {
                cout << result[i];
                if (i < result.size() - 1) cout << ", ";
            }
            cout << "]" << endl;
        }
    }
`;
            });
            break;
            
        case 2: // Reverse String
            problem.inputs.forEach((test, index) => {
                testCode += `
    // Test case ${index + 1}
    {
        vector<char> s = {${test.s.map(c => `'${c}'`).join(', ')}};
        vector<char> expected = {${test.expected.map(c => `'${c}'`).join(', ')}};
        reverseString(s);
        
        if (s == expected) {
            cout << "Test ${index + 1}: PASSED" << endl;
            testsPassed++;
        } else {
            cout << "Test ${index + 1}: FAILED" << endl;
            cout << "Expected: [";
            for (int i = 0; i < expected.size(); i++) {
                cout << "'" << expected[i] << "'";
                if (i < expected.size() - 1) cout << ", ";
            }
            cout << "]" << endl;
            cout << "Got: [";
            for (int i = 0; i < s.size(); i++) {
                cout << "'" << s[i] << "'";
                if (i < s.size() - 1) cout << ", ";
            }
            cout << "]" << endl;
        }
    }
`;
            });
            break;
            
        case 3: // Palindrome Number
            problem.inputs.forEach((test, index) => {
                testCode += `
    // Test case ${index + 1}
    {
        int x = ${test.x};
        bool expected = ${test.expected ? 'true' : 'false'};
        bool result = isPalindrome(x);
        
        if (result == expected) {
            cout << "Test ${index + 1}: PASSED" << endl;
            testsPassed++;
        } else {
            cout << "Test ${index + 1}: FAILED" << endl;
            cout << "Expected: " << (expected ? "true" : "false") << endl;
            cout << "Got: " << (result ? "true" : "false") << endl;
        }
    }
`;
            });
            break;
            
        case 4: // Valid Parentheses
            problem.inputs.forEach((test, index) => {
                testCode += `
    // Test case ${index + 1}
    {
        string s = "${test.s}";
        bool expected = ${test.expected ? 'true' : 'false'};
        bool result = isValid(s);
        
        if (result == expected) {
            cout << "Test ${index + 1}: PASSED" << endl;
            testsPassed++;
        } else {
            cout << "Test ${index + 1}: FAILED" << endl;
            cout << "Expected: " << (expected ? "true" : "false") << endl;
            cout << "Got: " << (result ? "true" : "false") << endl;
        }
    }
`;
            });
            break;
            
        case 5: // Maximum Subarray
            problem.inputs.forEach((test, index) => {
                testCode += `
    // Test case ${index + 1}
    {
        vector<int> nums = {${test.nums.join(', ')}};
        int expected = ${test.expected};
        int result = maxSubArray(nums);
        
        if (result == expected) {
            cout << "Test ${index + 1}: PASSED" << endl;
            testsPassed++;
        } else {
            cout << "Test ${index + 1}: FAILED" << endl;
            cout << "Expected: " << expected << endl;
            cout << "Got: " << result << endl;
        }
    }
`;
            });
            break;
            
        default:
            // Generic test for other problems
            testCode += `
    cout << "Custom test cases not implemented for this problem." << endl;
    cout << "Please test your solution manually." << endl;
    testsPassed = totalTests; // Assume all passed for now
`;
    }
    
    testCode += `
    cout << "\\n=== RESULTS ===" << endl;
    cout << "Tests passed: " << testsPassed << "/" << totalTests << endl;
    if (testsPassed == totalTests) {
        cout << "All tests passed! 🎉" << endl;
    } else {
        cout << "Some tests failed. Please check your solution." << endl;
    }
    
    return 0;
}`;
    
    return testCode;
}

// API Routes

// Compile and run C++ code
app.post('/api/compile', async (req, res) => {
    const { code, input = '', problemId } = req.body;
    const fileId = uuidv4();
    const cppFile = path.join(TEMP_DIR, `${fileId}.cpp`);
    const exeFile = path.join(TEMP_DIR, `${fileId}`);
    
    try {
        let finalCode = code;
        
        // Check if code has main function, if not add a simple one for testing
        if (!code.includes('int main(') && !code.includes('int main (')) {
            finalCode = code + `\n\nint main() {\n    cout << "Function compiled successfully!" << endl;\n    return 0;\n}`;
        }
        
        // Write C++ code to file
        await fs.writeFile(cppFile, finalCode);
        
        // Compile the code
        const compileCommand = `g++ -o "${exeFile}" "${cppFile}" -std=c++17`;
        
        exec(compileCommand, { timeout: TIMEOUT }, (compileError, compileStdout, compileStderr) => {
            if (compileError) {
                cleanupTempFiles(fileId);
                return res.json({
                    success: false,
                    error: 'Compilation Error',
                    output: compileStderr || compileError.message
                });
            }
            
            // Execute the compiled program
            const runCommand = process.platform === 'win32' ? `"${exeFile}.exe"` : `"${exeFile}"`;
            const childProcess = exec(runCommand, { timeout: TIMEOUT }, (runError, runStdout, runStderr) => {
                cleanupTempFiles(fileId);
                
                if (runError) {
                    if (runError.code === 'ETIMEDOUT') {
                        return res.json({
                            success: false,
                            error: 'Time Limit Exceeded',
                            output: 'Your program took too long to execute (> 5 seconds)'
                        });
                    }
                    
                    return res.json({
                        success: false,
                        error: 'Runtime Error',
                        output: runStderr || runError.message
                    });
                }
                
                res.json({
                    success: true,
                    output: runStdout,
                    error: runStderr
                });
            });
            
            // Provide input to the program
            if (input) {
                childProcess.stdin.write(input);
                childProcess.stdin.end();
            }
        });
        
    } catch (error) {
        cleanupTempFiles(fileId);
        res.json({
            success: false,
            error: 'Internal Error',
            output: error.message
        });
    }
});

app.post('/api/submit', async (req, res) => {
    const { code, problemId } = req.body;
    const fileId = uuidv4();
    const cppFile = path.join(TEMP_DIR, `${fileId}.cpp`);
    const exeFile = path.join(TEMP_DIR, `${fileId}`);
    try {
        const testCode = generateTestCode(parseInt(problemId), code);
        await fs.writeFile(cppFile, testCode);
        const compileCommand = `g++ -o "${exeFile}" "${cppFile}" -std=c++17`;
        
        exec(compileCommand, { timeout: TIMEOUT }, (compileError, compileStdout, compileStderr) => {
            if (compileError) {
                cleanupTempFiles(fileId);
                return res.json({
                    success: false,
                    error: 'Compilation Error',
                    output: compileStderr || compileError.message,
                    testResults: { passed: 0, total: 0 }
                });
            }
            const runCommand = process.platform === 'win32' ? `"${exeFile}.exe"` : `"${exeFile}"`;
            exec(runCommand, { timeout: TIMEOUT }, (runError, runStdout, runStderr) => {
                cleanupTempFiles(fileId);
                
                if (runError) {
                    if (runError.code === 'ETIMEDOUT') {
                        return res.json({
                            success: false,
                            error: 'Time Limit Exceeded',
                            output: 'Your program took too long to execute (> 5 seconds)',
                            testResults: { passed: 0, total: 0 }
                        });
                    }
                    
                    return res.json({
                        success: false,
                        error: 'Runtime Error',
                        output: runStderr || runError.message,
                        testResults: { passed: 0, total: 0 }
                    });
                }
                
                const output = runStdout;
                const passedMatch = output.match(/Tests passed: (\d+)\/(\d+)/);
                const testResults = passedMatch ? 
                    { passed: parseInt(passedMatch[1]), total: parseInt(passedMatch[2]) } :
                    { passed: 0, total: 0 };
                
                res.json({
                    success: true,
                    output: output,
                    testResults: testResults,
                    allPassed: testResults.passed === testResults.total
                });
            });
        });
        
    } catch (error) {
        cleanupTempFiles(fileId);
        res.json({
            success: false,
            error: 'Internal Error',
            output: error.message,
            testResults: { passed: 0, total: 0 }
        });
    }
});
app.get('/api/testcases/:problemId', (req, res) => {
    const problemId = parseInt(req.params.problemId);
    const problem = testCases[problemId];
    
    if (!problem) {
        return res.json({
            success: false,
            message: 'Test cases not found for this problem'
        });
    }
    
    res.json({
        success: true,
        testCases: problem.inputs.slice(0, 2), 
        totalTestCases: problem.inputs.length
    });
});
app.post('/api/rooms/create', (req, res) => {
    const { name, description, difficulty, isPrivate, createdBy } = req.body;
    const roomCode = generateRoomCode();
    const availableProblems = Object.keys(problemDifficulties)
        .filter(id => problemDifficulties[id] === difficulty)
        .map(id => parseInt(id));
    
    const selectedProblemId = availableProblems.length > 0
        ? availableProblems[Math.floor(Math.random() * availableProblems.length)]
        : 1;
    
    const room = {
        id: Date.now(),
        name,
        description: description || '',
        code: roomCode,
        difficulty,
        isPrivate: isPrivate || false,
        problemId: selectedProblemId,
        participants: [createdBy],
        createdBy,
        createdAt: new Date().toISOString(),
        chatMessages: []
    };
    
    serverRooms.set(roomCode, room);
    
    res.json({
        success: true,
        room: room,
        roomCode: roomCode
    });
});

app.post('/api/rooms/join', (req, res) => {
    const { roomCode, username } = req.body;
    
    const room = serverRooms.get(roomCode.toUpperCase());
    
    if (!room) {
        return res.json({
            success: false,
            message: 'Room not found'
        });
    }
    if (!room.participants.includes(username)) {
        room.participants.push(username);
        room.chatMessages.push({
            id: Date.now(),
            sender: 'System',
            message: `${username} joined the room`,
            timestamp: new Date().toISOString(),
            type: 'system'
        });
    }
    
    res.json({
        success: true,
        room: room
    });
});

app.get('/api/rooms/:roomCode', (req, res) => {
    const roomCode = req.params.roomCode.toUpperCase();
    const room = serverRooms.get(roomCode);
    
    if (!room) {
        return res.json({
            success: false,
            message: 'Room not found'
        });
    }
    
    res.json({
        success: true,
        room: room
    });
});

app.post('/api/user/update-score', (req, res) => {
    const { username, problemId, roomCode } = req.body;

    if (!username || !problemId) {
        return res.json({
            success: false,
            message: 'Invalid data provided'
        });
    }

    if (!serverUsers.has(username)) {
        serverUsers.set(username, {
            username,
            problemsSolved: 0,
            score: 0,
            solvedProblems: []
        });
    }

    const userData = serverUsers.get(username);

    if (!userData.solvedProblems.includes(problemId)) {
        const difficulty = problemDifficulties[problemId];
        const pointsGained = getDifficultyPoints(difficulty);

        userData.score += pointsGained;
        userData.problemsSolved += 1;
        userData.solvedProblems.push(problemId);
    }

    if (roomCode && serverRooms.has(roomCode)) {
        if (!roomLeaderboards.has(roomCode)) {
            roomLeaderboards.set(roomCode, new Map());
        }
        
        const roomLeaderboard = roomLeaderboards.get(roomCode);
        roomLeaderboard.set(username, {
            score: userData.score,
            problemsSolved: userData.problemsSolved
        });
        
        io.to(roomCode).emit('room-leaderboard-updated', {
            roomCode: roomCode,
            username: username,
            score: userData.score,
            problemsSolved: userData.problemsSolved
        });
    }

    io.emit('leaderboard-updated', {
        username: username,
        score: userData.score,
        problemsSolved: userData.problemsSolved
    });

    console.log(`Broadcasting leaderboard update: ${username} now has ${userData.score} points`);

    res.json({
        success: true,
        message: 'Score updated and broadcasted'
    });
});

app.get('/api/leaderboard', (req, res) => {
    const leaderboard = Array.from(serverUsers.values())
        .map(user => ({
            username: user.username,
            score: user.score,
            problemsSolved: user.problemsSolved
        }))
        .sort((a, b) => b.score - a.score);
    
    res.json({
        success: true,
        leaderboard: leaderboard
    });
});

app.get('/api/leaderboard/:roomCode', (req, res) => {
    const roomCode = req.params.roomCode.toUpperCase();
    if (!serverRooms.has(roomCode)) {
        return res.json({
            success: false,
            message: 'Room not found'
        });
    }
    const roomLeaderboard = roomLeaderboards.get(roomCode) || new Map();
    const leaderboard = Array.from(roomLeaderboard.entries())
        .map(([username, data]) => ({
            username: username,
            score: data.score,
            problemsSolved: data.problemsSolved
        }))
        .sort((a, b) => b.score - a.score);
    
    res.json({
        success: true,
        roomCode: roomCode,
        leaderboard: leaderboard
    });
});

app.get('/api/rooms', (req, res) => {
    const publicRooms = Array.from(serverRooms.values())
        .filter(room => !room.isPrivate && room.participants.length > 0)
        .map(room => ({
            id: room.id,
            name: room.name,
            description: room.description,
            code: room.code,
            difficulty: room.difficulty,
            participantCount: room.participants.length,
            createdBy: room.createdBy
        }));
    
    res.json({
        success: true,
        rooms: publicRooms
    });
});

function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    if (serverRooms.has(result)) {
        return generateRoomCode();
    }
    return result;
}

app.get('/api/check-compiler', (req, res) => {
    exec('g++ --version', (error, stdout, stderr) => {
        if (error) {
            res.json({
                success: false,
                message: 'g++ compiler not found. Please install g++ to use C++ compilation features.',
                installInstructions: {
                    macos: 'Install Xcode Command Line Tools: xcode-select --install',
                    linux: 'Install g++: sudo apt-get install g++ (Ubuntu/Debian) or sudo yum install gcc-c++ (CentOS/RHEL)',
                    windows: 'Install MinGW-w64 or Visual Studio Build Tools'
                }
            });
        } else {
            res.json({
                success: true,
                message: 'g++ compiler is available',
                version: stdout.split('\n')[0]
            });
        }
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📁 Temp directory: ${TEMP_DIR}`);
    
    exec('g++ --version', (error) => {
        if (error) {
            console.log('⚠️  Warning: g++ compiler not found. C++ compilation will not work.');
            console.log('   Install g++ to enable C++ code execution:');
            console.log('   - macOS: xcode-select --install');
            console.log('   - Linux: sudo apt-get install g++');
            console.log('   - Windows: Install MinGW-w64');
        } else {
            console.log('✅ g++ compiler detected and ready');
        }
    });
});

process.on('SIGINT', () => {
    console.log('\n🧹 Cleaning up temporary files...');
    fs.emptyDirSync(TEMP_DIR);
    process.exit(0);
});

process.on('SIGTERM', () => {
    fs.emptyDirSync(TEMP_DIR);
    process.exit(0);
});
