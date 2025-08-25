// Global variables
let currentUser = null;
let currentRoom = null;
let currentProblem = null;
let problems = [];
let users = [];
let rooms = [];
let leaderboard = [];
let roomLeaderboard = []; 
let isShowingRoomLeaderboard = false;
let socket = null;
let compilerAvailable = false;

document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    initializeSocket();
    
    loadData();
    
    if (problems.length === 0) {
        generateSampleProblems();
    }
    
    checkCompilerStatus();
    
    checkAuthStatus();
}

function initializeSocket() {
    if (typeof io !== 'undefined') {
        socket = io();
        
        socket.on('connect', () => {
            console.log('Connected to server');
            if (currentUser) {
                socket.emit('authenticate', currentUser.username);
            }
        });
        
        socket.on('user-joined', (data) => {
            console.log('User joined room:', data);
            showNotification(`${data.username} joined the room`, 'info');

            if (currentRoom) {
            }
        });
        
        socket.on('user-left', (data) => {
            console.log('User left room:', data);
            showNotification(`${data.username} left the room`, 'info');
            
            if (currentRoom) {
            }
        });
        
        socket.on('room-updated', (updatedRoom) => {
            console.log('Room updated:', updatedRoom);
            
            if (currentRoom && currentRoom.code === updatedRoom.code) {
                currentRoom = updatedRoom;
                updateCurrentRoomDisplay();
                updateParticipants();
                loadChatMessages();
            }
            loadActiveRooms();
        });
        socket.on('leaderboard-updated', (data) => {
            console.log('Leaderboard updated:', data);
            const existingIndex = leaderboard.findIndex(entry => entry.username === data.username);
            const previousScore = existingIndex !== -1 ? leaderboard[existingIndex].score : 0;
            if (existingIndex !== -1) {
                leaderboard[existingIndex] = {
                    username: data.username,
                    score: data.score,
                    problemsSolved: data.problemsSolved
                };
            } else {
                leaderboard.push({
                    username: data.username,
                    score: data.score,
                    problemsSolved: data.problemsSolved
                });
            }
            leaderboard.sort((a, b) => b.score - a.score);

            if (document.getElementById('leaderboardSection').style.display !== 'none') {
                loadLeaderboard();
            }
            saveData();
            if (currentUser && data.username !== currentUser.username) {
                const pointsGained = data.score - previousScore;
                showNotification(`🎉 ${data.username} solved a problem! +${pointsGained} points`, 'success');
            }
        });
        
        socket.on('code-update', (data) => {
            console.log('Code updated by:', data.userId);
        });
        
        socket.on('rooms-list-updated', () => {
            console.log('Rooms list updated - refreshing display');
            loadActiveRooms();
        });
        
        socket.on('room-leaderboard-updated', (data) => {
            console.log('Room leaderboard updated:', data);
            const existingIndex = roomLeaderboard.findIndex(entry => entry.username === data.username);
            const previousScore = existingIndex !== -1 ? roomLeaderboard[existingIndex].score : 0;
            
            if (existingIndex !== -1) {
                roomLeaderboard[existingIndex] = {
                    username: data.username,
                    score: data.score,
                    problemsSolved: data.problemsSolved
                };
            } else {
                roomLeaderboard.push({
                    username: data.username,
                    score: data.score,
                    problemsSolved: data.problemsSolved
                });
            }
            roomLeaderboard.sort((a, b) => b.score - a.score);
            if (document.getElementById('leaderboardSection').style.display !== 'none' && currentRoom) {
                loadRoomLeaderboard(currentRoom.code);
            }
            if (currentUser && data.username !== currentUser.username) {
                const pointsGained = data.score - previousScore;
                showNotification(`🎉 ${data.username} solved a problem in the room! +${pointsGained} points`, 'success');
            }
        });
        
        socket.on('room-leaderboard-reset', (data) => {
            console.log('Room leaderboard reset:', data);
            roomLeaderboard = [];
            if (document.getElementById('leaderboardSection').style.display !== 'none' && currentRoom) {
                loadRoomLeaderboard(currentRoom.code);
            }
            showNotification('🔄 ' + data.message, 'info');
        });
        
        socket.on('new-message', (data) => {
            if (currentRoom) {
                const existingMessage = currentRoom.chatMessages.find(msg => 
                    msg.sender === data.sender && 
                    msg.message === data.message && 
                    Math.abs(new Date(msg.timestamp) - new Date(data.timestamp)) < 1000
                );
                
                if (!existingMessage) {
                    currentRoom.chatMessages.push({
                        id: Date.now(),
                        sender: data.sender,
                        message: data.message,
                        timestamp: data.timestamp,
                        type: 'user'
                    });
                    saveData();
                    loadChatMessages();
                }
            }
        });
    }
}

function checkCompilerStatus() {
    fetch('/api/check-compiler')
        .then(response => response.json())
        .then(data => {
            compilerAvailable = data.success;
            updateCompilerStatus(data);
        })
        .catch(error => {
            console.log('Could not check compiler status:', error);
            compilerAvailable = false;
            updateCompilerStatus({ success: false, message: 'Server not available. Running in offline mode.' });
        });
}

function updateCompilerStatus(status) {
    if (!status.success) {
        showNotification('⚠️ C++ compiler not available. Please install g++ to run and test code.', 'error');
        document.getElementById('runBtn').disabled = true;
        document.getElementById('submitBtn').disabled = true;
    } else {
        showNotification('✅ C++ compiler ready!', 'success');
    }
}

function loadData() {
    problems = JSON.parse(localStorage.getItem('codingProblems') || '[]');
    users = JSON.parse(localStorage.getItem('codingUsers') || '[]');
    rooms = JSON.parse(localStorage.getItem('codingRooms') || '[]');
    leaderboard = JSON.parse(localStorage.getItem('codingLeaderboard') || '[]');
    currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
}

function saveData() {
    localStorage.setItem('codingProblems', JSON.stringify(problems));
    localStorage.setItem('codingUsers', JSON.stringify(users));
    localStorage.setItem('codingRooms', JSON.stringify(rooms));
    localStorage.setItem('codingLeaderboard', JSON.stringify(leaderboard));
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
}

function generateSampleProblems() {
    problems = [
        {
            id: 1,
            title: "Two Sum",
            difficulty: "easy",
            description: "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.",
            examples: "Input: nums = [2,7,11,15], target = 9\nOutput: [0,1]\nExplanation: Because nums[0] + nums[1] == 9, we return [0, 1].",
            solution: "function twoSum(nums, target) {\n    const map = new Map();\n    for (let i = 0; i < nums.length; i++) {\n        const complement = target - nums[i];\n        if (map.has(complement)) {\n            return [map.get(complement), i];\n        }\n        map.set(nums[i], i);\n    }\n    return [];\n}"
        },
        {
            id: 2,
            title: "Reverse String",
            difficulty: "easy",
            description: "Write a function that reverses a string. The input string is given as an array of characters s.",
            examples: "Input: s = ['h','e','l','l','o']\nOutput: ['o','l','l','e','h']",
            solution: "function reverseString(s) {\n    let left = 0;\n    let right = s.length - 1;\n    while (left < right) {\n        [s[left], s[right]] = [s[right], s[left]];\n        left++;\n        right--;\n    }\n    return s;\n}"
        },
        {
            id: 3,
            title: "Palindrome Number",
            difficulty: "easy",
            description: "Given an integer x, return true if x is palindrome integer.",
            examples: "Input: x = 121\nOutput: true\nExplanation: 121 reads as 121 from left to right and from right to left.",
            solution: "function isPalindrome(x) {\n    if (x < 0) return false;\n    const str = x.toString();\n    return str === str.split('').reverse().join('');\n}"
        },
        {
            id: 4,
            title: "Valid Parentheses",
            difficulty: "easy",
            description: "Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.",
            examples: "Input: s = '()'\nOutput: true\nInput: s = '([)]'\nOutput: false",
            solution: "function isValid(s) {\n    const stack = [];\n    const map = { ')': '(', '}': '{', ']': '[' };\n    for (let char of s) {\n        if (char in map) {\n            if (stack.pop() !== map[char]) return false;\n        } else {\n            stack.push(char);\n        }\n    }\n    return stack.length === 0;\n}"
        },
        {
            id: 5,
            title: "Maximum Subarray",
            difficulty: "medium",
            description: "Given an integer array nums, find the contiguous subarray which has the largest sum and return its sum.",
            examples: "Input: nums = [-2,1,-3,4,-1,2,1,-5,4]\nOutput: 6\nExplanation: [4,-1,2,1] has the largest sum = 6.",
            solution: "function maxSubArray(nums) {\n    let maxSum = nums[0];\n    let currentSum = nums[0];\n    for (let i = 1; i < nums.length; i++) {\n        currentSum = Math.max(nums[i], currentSum + nums[i]);\n        maxSum = Math.max(maxSum, currentSum);\n    }\n    return maxSum;\n}"
        },
        {
            id: 6,
            title: "Merge Two Sorted Lists",
            difficulty: "medium",
            description: "Merge two sorted linked lists and return it as a sorted list.",
            examples: "Input: list1 = [1,2,4], list2 = [1,3,4]\nOutput: [1,1,2,3,4,4]",
            solution: "function mergeTwoLists(list1, list2) {\n    const dummy = new ListNode(0);\n    let current = dummy;\n    while (list1 && list2) {\n        if (list1.val <= list2.val) {\n            current.next = list1;\n            list1 = list1.next;\n        } else {\n            current.next = list2;\n            list2 = list2.next;\n        }\n        current = current.next;\n    }\n    current.next = list1 || list2;\n    return dummy.next;\n}"
        },
        {
            id: 7,
            title: "Binary Search",
            difficulty: "medium",
            description: "Given an array of integers nums which is sorted in ascending order, and an integer target, write a function to search target in nums.",
            examples: "Input: nums = [-1,0,3,5,9,12], target = 9\nOutput: 4\nExplanation: 9 exists in nums and its index is 4",
            solution: "function search(nums, target) {\n    let left = 0;\n    let right = nums.length - 1;\n    while (left <= right) {\n        const mid = Math.floor((left + right) / 2);\n        if (nums[mid] === target) return mid;\n        if (nums[mid] < target) left = mid + 1;\n        else right = mid - 1;\n    }\n    return -1;\n}"
        },
        {
            id: 8,
            title: "Longest Common Subsequence",
            difficulty: "hard",
            description: "Given two strings text1 and text2, return the length of their longest common subsequence.",
            examples: "Input: text1 = 'abcde', text2 = 'ace'\nOutput: 3\nExplanation: The longest common subsequence is 'ace' and its length is 3.",
            solution: "function longestCommonSubsequence(text1, text2) {\n    const m = text1.length;\n    const n = text2.length;\n    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));\n    for (let i = 1; i <= m; i++) {\n        for (let j = 1; j <= n; j++) {\n            if (text1[i - 1] === text2[j - 1]) {\n                dp[i][j] = dp[i - 1][j - 1] + 1;\n            } else {\n                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);\n            }\n        }\n    }\n    return dp[m][n];\n}"
        },
        {
            id: 9,
            title: "Word Ladder",
            difficulty: "hard",
            description: "A transformation sequence from word beginWord to word endWord using a dictionary wordList is a sequence of words beginWord -> s1 -> s2 -> ... -> sk such that every adjacent pair of words differs by exactly one letter.",
            examples: "Input: beginWord = 'hit', endWord = 'cog', wordList = ['hot','dot','dog','lot','log','cog']\nOutput: 5\nExplanation: One shortest transformation sequence is 'hit' -> 'hot' -> 'dot' -> 'dog' -> 'cog', which is 5 words long.",
            solution: "function ladderLength(beginWord, endWord, wordList) {\n    if (!wordList.includes(endWord)) return 0;\n    const wordSet = new Set(wordList);\n    const queue = [beginWord];\n    let level = 1;\n    while (queue.length > 0) {\n        const size = queue.length;\n        for (let i = 0; i < size; i++) {\n            const word = queue.shift();\n            if (word === endWord) return level;\n            for (let j = 0; j < word.length; j++) {\n                for (let k = 0; k < 26; k++) {\n                    const newWord = word.slice(0, j) + String.fromCharCode(97 + k) + word.slice(j + 1);\n                    if (wordSet.has(newWord)) {\n                        queue.push(newWord);\n                        wordSet.delete(newWord);\n                    }\n                }\n            }\n        }\n        level++;\n    }\n    return 0;\n}"
        },
        {
            id: 10,
            title: "N-Queens",
            difficulty: "hard",
            description: "The n-queens puzzle is the problem of placing n queens on an n×n chessboard such that no two queens attack each other.",
            examples: "Input: n = 4\nOutput: [[\".Q..\",\"...Q\",\"Q...\",\"..Q.\"],[\".Q..\",\"...Q\",\"Q...\",\"..Q.\"]]\nExplanation: There exist two distinct solutions to the 4-queens puzzle.",
            solution: "function solveNQueens(n) {\n    const result = [];\n    const board = Array(n).fill(null).map(() => Array(n).fill('.'));\n    \n    function isValid(row, col) {\n        for (let i = 0; i < row; i++) {\n            if (board[i][col] === 'Q') return false;\n        }\n        for (let i = row - 1, j = col - 1; i >= 0 && j >= 0; i--, j--) {\n            if (board[i][j] === 'Q') return false;\n        }\n        for (let i = row - 1, j = col + 1; i >= 0 && j < n; i--, j++) {\n            if (board[i][j] === 'Q') return false;\n        }\n        return true;\n    }\n    \n    function backtrack(row) {\n        if (row === n) {\n            result.push(board.map(row => row.join('')));\n            return;\n        }\n        for (let col = 0; col < n; col++) {\n            if (isValid(row, col)) {\n                board[row][col] = 'Q';\n                backtrack(row + 1);\n                board[row][col] = '.';\n            }\n        }\n    }\n    \n    backtrack(0);\n    return result;\n}"
        }
    ];
    saveData();
}

function generateSampleUsers() {
    users = [
        { id: 1, username: 'dev', email: 'dev@gmail.com', password: '123456', problemsSolved: 6, score: 180 },
        { id: 2, username: 'deva', email: 'deva@gmail.com', password: '123456', problemsSolved: 10, score: 320 }
    ];
    
    leaderboard = users.map(user => ({
        username: user.username,
        problemsSolved: user.problemsSolved,
        score: user.score
    })).sort((a, b) => b.score - a.score);
    
    saveData();
}
function showAuth(type) {
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const loginTab = document.querySelector('.auth-tab:first-child');
    const signupTab = document.querySelector('.auth-tab:last-child');
    
    if (type === 'login') {
        loginForm.style.display = 'block';
        signupForm.style.display = 'none';
        loginTab.classList.add('active');
        signupTab.classList.remove('active');
    } else {
        loginForm.style.display = 'none';
        signupForm.style.display = 'block';
        loginTab.classList.remove('active');
        signupTab.classList.add('active');
    }
}

function handleLogin(event) {
    event.preventDefault();
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    
    const user = users.find(u => u.username === username && u.password === password);
    
    if (user) {
        currentUser = user;
        saveData();
        showMainContent();
        showMessage('Login successful!', 'success');
    } else {
        showMessage('Invalid username or password!', 'error');
    }
}

function handleSignup(event) {
    event.preventDefault();
    const username = document.getElementById('signupUsername').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    
    if (users.find(u => u.username === username)) {
        showMessage('Username already exists!', 'error');
        return;
    }
    
    const newUser = {
        id: Date.now(),
        username,
        email,
        password,
        problemsSolved: 0,
        score: 0
    };
    
    users.push(newUser);
    leaderboard.push({
        username: newUser.username,
        problemsSolved: 0,
        score: 0
    });
    
    currentUser = newUser;
    saveData();
    showMainContent();
    showMessage('Account created successfully!', 'success');
}

function logout() {
    // If the user is in a room, tell the server they are leaving before logging out.
    // This ensures the room participant count is updated and the room is closed if empty.
    if (currentRoom && currentUser && socket) {
        socket.emit('leave-room', {
            roomCode: currentRoom.code,
            username: currentUser.username
        });
        console.log(`Emitting 'leave-room' for ${currentUser.username} from room ${currentRoom.code} during logout.`);
    }

    currentUser = null;
    currentRoom = null;
    localStorage.removeItem('currentUser');
    document.getElementById('authSection').style.display = 'flex';
    document.getElementById('mainContent').style.display = 'none';
    document.getElementById('logoutBtn').style.display = 'none';
    showMessage('Logged out successfully!', 'info');
}


function checkAuthStatus() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    document.getElementById('authSection').style.display = 'flex';
    document.getElementById('mainContent').style.display = 'none';
    document.getElementById('logoutBtn').style.display = 'none';
}

function showMainContent() {
    document.getElementById('authSection').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';
    document.getElementById('logoutBtn').style.display = 'block';
    if (socket && currentUser) {
        socket.emit('authenticate', currentUser.username);
    }
    
    loadProblems();
    loadLeaderboard();
    loadActiveRooms();
    updateCurrentRoomDisplay();
    updateLeaderboardToggle();
}
function showSection(sectionName) {
    document.querySelectorAll('.section').forEach(section => {
        section.style.display = 'none';
    });
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    document.getElementById(sectionName + 'Section').style.display = 'block';
    event.target.classList.add('active');
    if (sectionName === 'problems') {
        loadProblems();
    } else if (sectionName === 'leaderboard') {
        updateLeaderboardToggle();
        loadLeaderboard();
    }
}
function loadActiveRooms() {
    const roomsGrid = document.getElementById('roomsGrid');
    fetch('/api/rooms')
        .then(response => response.json())
        .then(data => {
            roomsGrid.innerHTML = '';
            
            if (!data.success || data.rooms.length === 0) {
                roomsGrid.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-users"></i>
                        <h4>No Active Rooms</h4>
                        <p>Be the first to create a room!</p>
                    </div>
                `;
                return;
            }
            
            data.rooms.forEach(room => {
                const roomCard = document.createElement('div');
                roomCard.className = 'room-card';
                roomCard.onclick = () => joinRoomByCodeDirect(room.code);
                
                roomCard.innerHTML = `
                    <h4>${room.name}</h4>
                    <p>${room.description || 'No description provided'}</p>
                    <div class="room-card-meta">
                        <span class="room-code-display">${room.code}</span>
                        <span class="participants-count">${room.participantCount} participant${room.participantCount !== 1 ? 's' : ''}</span>
                    </div>
                    <span class="difficulty-badge difficulty-${room.difficulty}">${room.difficulty}</span>
                `;
                
                roomsGrid.appendChild(roomCard);
            });
        })
        .catch(error => {
            console.error('Error loading rooms:', error);
            roomsGrid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h4>Error Loading Rooms</h4>
                    <p>Could not connect to server</p>
                </div>
            `;
        });
}

function joinRoomByCodeDirect(roomCode) {
    if (!currentUser) {
        showNotification('Please login first', 'error');
        return;
    }
    fetch('/api/rooms/join', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            roomCode: roomCode,
            username: currentUser.username
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            currentRoom = data.room;
            showNotification(`Joined room: ${data.room.name}`, 'success');
            if (socket) {
                socket.emit('join-room', {
                    roomCode: data.room.code,
                    username: currentUser.username
                });
            }
            
            loadActiveRooms();
            updateCurrentRoomDisplay();
            updateLeaderboardToggle();
        } else {
            showNotification('Could not join room: ' + data.message, 'error');
        }
    })
    .catch(error => {
        showNotification('Network error: ' + error.message, 'error');
    });
}

function showCreateRoom() {
    document.getElementById('createRoomModal').style.display = 'block';
}

function showJoinRoom() {
    loadAvailableRooms();
    document.getElementById('joinRoomModal').style.display = 'block';
}

function showJoinTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    if (tabName === 'code') {
        document.getElementById('joinByCode').style.display = 'block';
        document.getElementById('browseRooms').style.display = 'none';
    } else {
        document.getElementById('joinByCode').style.display = 'none';
        document.getElementById('browseRooms').style.display = 'block';
        loadAvailableRooms();
    }
}

function loadAvailableRooms() {
    const availableRoomsContainer = document.getElementById('availableRooms');
    
    fetch('/api/rooms')
        .then(response => response.json())
        .then(data => {
            availableRoomsContainer.innerHTML = '';
            
            if (!data.success || data.rooms.length === 0) {
                availableRoomsContainer.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-search"></i>
                        <h4>No Rooms Available</h4>
                        <p>Create a room to get started!</p>
                    </div>
                `;
                return;
            }
            
            data.rooms.forEach(room => {
                const roomItem = document.createElement('div');
                roomItem.className = 'available-room-item';
                
                roomItem.innerHTML = `
                    <div class="room-item-info">
                        <h5>${room.name}</h5>
                        <p>${room.description || 'No description'} • ${room.difficulty} • ${room.participantCount} participants</p>
                    </div>
                    <button class="btn btn-small" onclick="joinRoomByCodeDirect('${room.code}')">
                        Join
                    </button>
                `;
                
                availableRoomsContainer.appendChild(roomItem);
            });
        });
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function createRoom(event) {
    event.preventDefault();
    const roomName = document.getElementById('roomName').value;
    const roomDescription = document.getElementById('roomDescription').value;
    const difficulty = document.getElementById('roomDifficulty').value;
    const isPrivate = document.getElementById('roomPrivate').checked;
    
    if (!currentUser) {
        showNotification('Please login first', 'error');
        return;
    }
    
    fetch('/api/rooms/create', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: roomName,
            description: roomDescription,
            difficulty: difficulty,
            isPrivate: isPrivate,
            createdBy: currentUser.username
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            currentRoom = data.room;
            closeModal('createRoomModal');
            showNotification(`Room created successfully! Code: ${data.roomCode}`, 'success');
            if (socket) {
                socket.emit('join-room', {
                    roomCode: data.room.code,
                    username: currentUser.username
                });
            }
            document.getElementById('roomName').value = '';
            document.getElementById('roomDescription').value = '';
            document.getElementById('roomDifficulty').value = '';
            document.getElementById('roomPrivate').checked = false;
            loadActiveRooms();
            updateCurrentRoomDisplay();
        } else {
            showNotification('Failed to create room: ' + data.message, 'error');
        }
    })
    .catch(error => {
        showNotification('Network error: ' + error.message, 'error');
    });
}

function joinRoomByCode(event) {
    event.preventDefault();
    const roomCode = document.getElementById('roomCode').value.toUpperCase();
    
    if (!currentUser) {
        showNotification('Please login first', 'error');
        return;
    }
    
    fetch('/api/rooms/join', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            roomCode: roomCode,
            username: currentUser.username
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            currentRoom = data.room;
            closeModal('joinRoomModal');
            showNotification(`Joined room: ${data.room.name}`, 'success');
            document.getElementById('roomCode').value = '';
            loadActiveRooms();
            updateCurrentRoomDisplay();
        } else {
            showNotification('Room not found! Please check the code and try again.', 'error');
        }
    })
    .catch(error => {
        showNotification('Network error: ' + error.message, 'error');
    });
}

function updateCurrentRoomDisplay() {
    const currentRoomInfo = document.getElementById('currentRoomInfo');
    
    if (currentRoom) {
        currentRoomInfo.style.display = 'block';
        document.getElementById('currentRoomName').textContent = currentRoom.name;
        document.getElementById('currentRoomDesc').textContent = currentRoom.description || 'No description provided';
        document.getElementById('displayRoomCode').textContent = currentRoom.code;
        document.getElementById('displayRoomDifficulty').textContent = currentRoom.difficulty;
        document.getElementById('displayRoomDifficulty').className = `room-difficulty difficulty-${currentRoom.difficulty}`;
        document.getElementById('participantCount').textContent = currentRoom.participants.length;
    } else {
        currentRoomInfo.style.display = 'none';
    }
}

function startSolving() {
    showSection('problems');

    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    const problemsNavLink = document.querySelector('a[onclick="showSection(\'problems\')"]');
    if (problemsNavLink) {
        problemsNavLink.classList.add('active');
    }
    
    showNotification('Choose a problem to solve!', 'info');
}

function leaveRoom() {
    if (!currentRoom) return;
    
    const roomCode = currentRoom.code;
    if (socket) {
        socket.emit('leave-room', {
            roomCode: roomCode,
            username: currentUser.username
        });
    }
    
    currentRoom = null;
    showNotification('Left the room', 'info');
    loadActiveRooms();
    updateCurrentRoomDisplay();
    updateLeaderboardToggle();
    showSection('home');
}

function copyRoomCode(event) {
    if (!currentRoom) return;
    
    navigator.clipboard.writeText(currentRoom.code).then(() => {
        const button = event.target;
        const originalText = button.textContent;
        const originalClass = button.className;
        
        button.textContent = 'Copied!';
        button.className += ' copy-success';
        
        setTimeout(() => {
            button.textContent = originalText;
            button.className = originalClass;
        }, 2000);
        
        showNotification('Room code copied to clipboard!', 'success');
    }).catch(() => {
        showNotification('Failed to copy room code', 'error');
    });
}

function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}
function loadProblems() {
    const problemsGrid = document.getElementById('problemsGrid');
    problemsGrid.innerHTML = '';
    
    problems.forEach(problem => {
        const problemCard = document.createElement('div');
        problemCard.className = 'problem-card';
        problemCard.onclick = () => solveProblem(problem.id);
        
        problemCard.innerHTML = `
            <h3>${problem.title}</h3>
            <p>${problem.description.substring(0, 100)}...</p>
            <span class="difficulty-badge difficulty-${problem.difficulty}">
                ${problem.difficulty}
            </span>
        `;
        
        problemsGrid.appendChild(problemCard);
    });
}

function solveProblem(problemId) {
    const problem = problems.find(p => p.id === problemId);
    if (!problem) return;
    
    currentProblem = problem;
    document.querySelectorAll('.section').forEach(section => {
        section.style.display = 'none';
    });
    document.getElementById('solvingSection').style.display = 'block';
    document.getElementById('problemTitle').textContent = problem.title;
    document.getElementById('problemDifficulty').textContent = problem.difficulty;
    document.getElementById('problemDifficulty').className = `difficulty-badge difficulty-${problem.difficulty}`;
    document.getElementById('problemDescription').textContent = problem.description;
    document.getElementById('problemExamples').innerHTML = `<strong>Examples:</strong><br><pre>${problem.examples}</pre>`;
    if (currentRoom) {
        document.getElementById('currentRoom').textContent = currentRoom.name;
        document.getElementById('roomChat').style.display = 'block';
        updateParticipants();
        loadChatMessages();
    } else {
        document.getElementById('currentRoom').textContent = 'Practice Mode';
        document.getElementById('participantsList').innerHTML = '<span class="participant-item">You</span>';
        document.getElementById('roomChat').style.display = 'none';
    }
    document.getElementById('codeEditor').value = getCppTemplate(problem.id);
    document.getElementById('output').innerHTML = '';
}

function updateParticipants() {
    if (!currentRoom) return;
    
    const participantsList = document.getElementById('participantsList');
    if (!participantsList) return;
    
    participantsList.innerHTML = '';
    
    currentRoom.participants.forEach(participant => {
        const participantItem = document.createElement('span');
        participantItem.className = 'participant-item';
        participantItem.textContent = participant;
        participantsList.appendChild(participantItem);
    });
    
    const participantCount = document.getElementById('participantCount');
    if (participantCount) {
        participantCount.textContent = currentRoom.participants.length;
    }
}

function getCppTemplate(problemId) {
    const templates = {
        1: `#include <iostream>\n#include <vector>\n#include <unordered_map>\nusing namespace std;\n\nvector<int> twoSum(vector<int>& nums, int target) {\n    // Write your solution here\n    return {};\n}`,
        2: `#include <iostream>\n#include <vector>\nusing namespace std;\n\nvoid reverseString(vector<char>& s) {\n    // Write your solution here\n}`,
        3: `#include <iostream>\nusing namespace std;\n\nbool isPalindrome(int x) {\n    // Write your solution here\n    return false;\n}`,
        4: `#include <iostream>\n#include <string>\n#include <stack>\nusing namespace std;\n\nbool isValid(string s) {\n    // Write your solution here\n    return false;\n}`,
        5: `#include <iostream>\n#include <vector>\n#include <algorithm>\nusing namespace std;\n\nint maxSubArray(vector<int>& nums) {\n    // Write your solution here\n    return 0;\n}`
    };
    
    return templates[problemId] || `#include <iostream>\nusing namespace std;\n\n// Write your solution here\n`;
}

function runCode() {
    const code = document.getElementById('codeEditor').value;
    const output = document.getElementById('output');
    
    if (!code.trim()) {
        output.innerHTML = 'Please write some C++ code first!';
        return;
    }
    
    runCppCode(code);
}

function runCppCode(code, customInput = '') {
    const output = document.getElementById('output');
    
    if (!compilerAvailable) {
        output.innerHTML = '❌ C++ compiler not available.\nPlease install g++ to run C++ code.';
        return;
    }
    
    output.innerHTML = '<div class="loading-spinner"></div> Compiling and running C++ code...';
    
    fetch('/api/compile', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            code: code,
            input: customInput,
            problemId: currentProblem ? currentProblem.id : null
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            output.innerHTML = `✅ Compilation successful!\n\n<pre>${data.output}</pre>`;
            if (data.error) {
                output.innerHTML += `\n\n⚠️ Warnings:\n<pre>${data.error}</pre>`;
            }
        } else {
            output.innerHTML = `❌ ${data.error}\n\n<pre>${data.output}</pre>`;
        }
    })
    .catch(error => {
        output.innerHTML = `❌ Network Error: ${error.message}`;
    });
}

function runWithCustomInput() {
    const customInput = document.getElementById('customInput').value;
    const code = document.getElementById('codeEditor').value;
    
    if (!code.trim()) {
        showNotification('Please write some C++ code first!', 'error');
        return;
    }
    
    runCppCode(code, customInput);
}

function submitCode() {
    const code = document.getElementById('codeEditor').value;
    const output = document.getElementById('output');
    const testResults = document.getElementById('testResults');
    
    if (!code.trim()) {
        output.innerHTML = 'Please write some C++ code first!';
        return;
    }
    
    if (!currentProblem) {
        output.innerHTML = 'No problem selected!';
        return;
    }
    
    submitCppCode(code);
}

function submitCppCode(code) {
    const output = document.getElementById('output');
    const testResults = document.getElementById('testResults');
    
    if (!compilerAvailable) {
        output.innerHTML = '❌ C++ compiler not available for submission testing.';
        return;
    }
    
    output.innerHTML = '<div class="loading-spinner"></div> Compiling and running test cases...';
    testResults.style.display = 'none';
    
    fetch('/api/submit', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            code: code,
            problemId: currentProblem.id
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            const { testResults: results, allPassed } = data;
            
            output.innerHTML = `${allPassed ? '🎉' : '❌'} Test Results: ${results.passed}/${results.total} passed\n\n<pre>${data.output}</pre>`;
        
            showTestResults(results, allPassed);
            
            if (allPassed) {
                updateUserStats();
                showNotification('🎉 All test cases passed! Problem solved!', 'success');
            } else {
                showNotification('Some test cases failed. Keep trying!', 'error');
            }
        } else {
            output.innerHTML = `❌ ${data.error}\n\n<pre>${data.output}</pre>`;
        }
    })
    .catch(error => {
        output.innerHTML = `❌ Network Error: ${error.message}`;
    });
}


function showTestResults(results, allPassed) {
    const testResults = document.getElementById('testResults');
    const testResultsContent = document.getElementById('testResultsContent');
    
    testResultsContent.innerHTML = '';
    
    for (let i = 1; i <= results.total; i++) {
        const resultDiv = document.createElement('div');
        resultDiv.className = `test-case-result ${i <= results.passed ? 'passed' : 'failed'}`;
        
        resultDiv.innerHTML = `
            <span>Test Case ${i}</span>
            <span class="result-icon">${i <= results.passed ? '✅' : '❌'}</span>
        `;
        
        testResultsContent.appendChild(resultDiv);
    }
    
    testResults.style.display = 'block';
}

function updateUserStats() {
    if (currentUser && currentProblem) {
        fetch('/api/user/update-score', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: currentUser.username,
                problemId: currentProblem.id, 
                roomCode: currentRoom ? currentRoom.code : null
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                console.log('Score update request sent successfully');
            } else {
                console.error('Failed to send score update:', data.message);
            }
        })
        .catch(error => {
            console.error('Error updating score:', error);
        });
    }
}

function getDifficultyPoints(difficulty) {
    switch (difficulty) {
        case 'easy': return 10;
        case 'medium': return 25;
        case 'hard': return 50;
        default: return 10;
    }
}

function loadLeaderboard() {
    
    if (currentRoom && isShowingRoomLeaderboard) {
        loadRoomLeaderboard(currentRoom.code);
    } else {
        loadGlobalLeaderboard();
    }
}

function loadGlobalLeaderboard() {
    fetch('/api/leaderboard')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                leaderboard = data.leaderboard;
                saveData();
            }
            renderLeaderboard(leaderboard, 'Global Leaderboard');
        })
        .catch(error => {
            console.log('Could not fetch server leaderboard, using local data');
            renderLeaderboard(leaderboard, 'Global Leaderboard');
        });
}

function loadRoomLeaderboard(roomCode) {

    fetch(`/api/leaderboard/${roomCode}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
  
                roomLeaderboard = data.leaderboard;
                renderLeaderboard(roomLeaderboard, `Room ${roomCode} Leaderboard`);
            } else {
                console.log('Room leaderboard not found, showing empty');
                renderLeaderboard([], `Room ${roomCode} Leaderboard`);
            }
        })
        .catch(error => {
            console.log('Could not fetch room leaderboard, using local data');
            renderLeaderboard(roomLeaderboard, `Room ${roomCode} Leaderboard`);
        });
}

function renderLeaderboard(leaderboardData, title = 'Leaderboard') {
    const leaderboardBody = document.getElementById('leaderboardBody');
    const leaderboardTitle = document.querySelector('#leaderboardSection h2');
    
    if (!leaderboardBody) return;
    if (leaderboardTitle) {
        leaderboardTitle.textContent = title;
    }
    
    leaderboardBody.innerHTML = '';
    const dataToShow = leaderboardData || leaderboard;
    
    if (dataToShow.length === 0) {
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = `
            <td colspan="4" style="text-align: center; padding: 40px; color: #666;">
                <i class="fas fa-trophy" style="font-size: 2rem; margin-bottom: 10px; opacity: 0.5;"></i><br>
                No participants yet. Be the first to solve a problem!
            </td>
        `;
        leaderboardBody.appendChild(emptyRow);
        return;
    }
    
    dataToShow.forEach((user, index) => {
        const row = document.createElement('tr');
        const rank = index + 1;
        
        if (rank <= 3) {
            row.classList.add(`rank-${rank}`);
        }
        if (currentUser && user.username === currentUser.username) {
            row.classList.add('current-user');
        }
        
        row.innerHTML = `
            <td>${rank}</td>
            <td>${user.username}</td>
            <td>${user.problemsSolved}</td>
            <td>${user.score}</td>
        `;
        
        leaderboardBody.appendChild(row);
    });
}

function toggleLeaderboardView() {
    const toggleBtn = document.getElementById('toggleLeaderboardBtn');
    
    if (currentRoom) {
        isShowingRoomLeaderboard = !isShowingRoomLeaderboard;
        if (isShowingRoomLeaderboard) {
            loadRoomLeaderboard(currentRoom.code);
            toggleBtn.innerHTML = '<i class="fas fa-globe"></i> Switch to Global';
        } else {
            loadGlobalLeaderboard();
            toggleBtn.innerHTML = '<i class="fas fa-users"></i> Switch to Room';
        }
    }
}


function updateLeaderboardToggle() {
    const toggleBtn = document.getElementById('toggleLeaderboardBtn');
    const toggleContainer = document.getElementById('leaderboardToggle');
    
    if (currentRoom) {
        toggleContainer.style.display = 'flex';
        toggleBtn.disabled = false;
        
        if (isShowingRoomLeaderboard) {
            toggleBtn.innerHTML = '<i class="fas fa-globe"></i> Switch to Global';
        } else {
            toggleBtn.innerHTML = '<i class="fas fa-users"></i> Switch to Room';
        }
    } else {
        toggleContainer.style.display = 'none';
        isShowingRoomLeaderboard = false;
    }
}

function loadChatMessages() {
    if (!currentRoom) return;
    
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.innerHTML = '';
    
    currentRoom.chatMessages.forEach(message => {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${message.sender === currentUser.username ? 'own' : 'other'}`;
        
        if (message.type === 'system') {
            messageDiv.className = 'chat-message system';
            messageDiv.innerHTML = `
                <div class="message-content">
                    <em>${message.message}</em>
                    <span class="message-time">${formatTime(message.timestamp)}</span>
                </div>
            `;
        } else {
            messageDiv.innerHTML = `
                <div class="message-sender">${message.sender}</div>
                <div class="message-content">
                    ${message.message}
                    <span class="message-time">${formatTime(message.timestamp)}</span>
                </div>
            `;
        }
        
        chatMessages.appendChild(messageDiv);
    });
    

    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();
    
    if (!message || !currentRoom) return;
    
    const chatMessage = {
        id: Date.now(),
        sender: currentUser.username,
        message: message,
        timestamp: new Date().toISOString(),
        type: 'user'
    };

    if (socket) {
        socket.emit('chat-message', {
            roomCode: currentRoom.code,
            message: message,
            sender: currentUser.username
        });
    }

    currentRoom.chatMessages.push(chatMessage);
    saveData();
    messageInput.value = '';
    loadChatMessages();
}

function handleChatKeypress(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function showMessage(message, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.remove();
    }, 5000);
}

function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 5000);
}
window.onclick = function(event) {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
}

document.addEventListener('keydown', function(event) {
    if (event.ctrlKey && event.key === 'Enter') {
        runCode();
    }
    
    if (event.ctrlKey && event.shiftKey && event.key === 'Enter') {
        submitCode();
    }
});

function showTestCases() {
    if (!currentProblem) {
        showNotification('No problem selected!', 'error');
        return;
    }
    
    fetch(`/api/testcases/${currentProblem.id}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                displayTestCases(data.testCases, data.totalTestCases);
                document.getElementById('testCasesModal').style.display = 'block';
            } else {
                showNotification('Test cases not available for this problem.', 'info');
            }
        })
        .catch(error => {
            showNotification('Could not load test cases.', 'error');
        });
}

function displayTestCases(testCases, total) {
    const content = document.getElementById('testCasesContent');
    content.innerHTML = '';
    
    testCases.forEach((testCase, index) => {
        const testDiv = document.createElement('div');
        testDiv.className = 'test-case-item';
        
        let inputDisplay = '';
        let outputDisplay = '';
        if (testCase.nums !== undefined) {
            inputDisplay = `nums = [${testCase.nums.join(', ')}], target = ${testCase.target}`;
            outputDisplay = `[${testCase.expected.join(', ')}]`;
        } else if (testCase.s !== undefined) {
            inputDisplay = `s = [${testCase.s.map(c => `'${c}'`).join(', ')}]`;
            outputDisplay = `[${testCase.expected.map(c => `'${c}'`).join(', ')}]`;
        } else if (testCase.x !== undefined) {
            inputDisplay = `x = ${testCase.x}`;
            outputDisplay = testCase.expected;
        } else {
            inputDisplay = JSON.stringify(testCase).replace(/"expected"[^,}]+[,}]/, '').slice(1, -1);
            outputDisplay = testCase.expected;
        }
        
        testDiv.innerHTML = `
            <h6>Test Case ${index + 1}</h6>
            <div class="test-case-details test-case-input">
                <strong>Input:</strong> ${inputDisplay}
            </div>
            <div class="test-case-details test-case-output">
                <strong>Expected Output:</strong> ${outputDisplay}
            </div>
        `;
        
        content.appendChild(testDiv);
    });
    
    if (total > testCases.length) {
        const moreDiv = document.createElement('div');
        moreDiv.className = 'test-case-item';
        moreDiv.innerHTML = `
            <h6>Additional Test Cases</h6>
            <p>There are ${total - testCases.length} more hidden test cases that will be used during submission.</p>
        `;
        content.appendChild(moreDiv);
    }
}

function toggleCustomInput() {
    const panel = document.getElementById('customInputPanel');
    if (panel.style.display === 'none') {
        panel.style.display = 'block';
        document.getElementById('customInput').focus();
    } else {
        panel.style.display = 'none';
    }
}

function clearOutput() {
    document.getElementById('output').innerHTML = '';
    document.getElementById('testResults').style.display = 'none';
}
