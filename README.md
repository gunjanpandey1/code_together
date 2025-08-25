# CodeTogether - Collaborative Coding Platform

A simple and attractive web-based coding platform where users can create rooms, solve problems with friends, and compete on a leaderboard.

---

##  Features

### User Authentication
- Login/Signup functionality
- Persistent user sessions

### Enhanced Room Management
- Create public/private coding rooms with descriptions
- Join rooms using 6-digit codes or browse available rooms
- Real-time participant tracking and management
- Leave/rejoin rooms with automatic cleanup
- Copy room codes to clipboard

### Coding Problems
- 10 coding problems of varying difficulty (Easy, Medium, Hard)
- Problem descriptions with examples
- Code editor with syntax highlighting

### Problem Solving
- Run code to test solutions
- Submit solutions for evaluation
- Real-time feedback and scoring

### Leaderboard
- Track user progress and scores
- Ranking system based on problems solved
- Score calculation based on difficulty

### Additional Features
- **Room Chat**: Real-time messaging within rooms
- **Active Rooms Display**: See and join public rooms instantly
- **Enhanced UI**: Beautiful notifications, loading states, and animations
- **Responsive Design** for all devices
- **Keyboard Shortcuts**:
  - `Ctrl + Enter`: Run code
  - `Ctrl + Shift + Enter`: Submit code
-  **Copy to Clipboard** for room codes
-  **Auto-cleanup** of empty rooms

---

## Getting Started

###  Prerequisites
- **Node.js** (v14 or higher) – [Download](https://nodejs.org/)
- **G++ Compiler** (for C++ code execution):
  - **macOS**: `xcode-select --install`
  - **Linux**: `sudo apt-get install g++`
  - **Windows**: Install MinGW-w64 or Visual Studio Build Tools
- A modern web browser (Chrome, Firefox, Safari, Edge)
---

###  Installation

```bash
# 1. Clone the repository
git clone https://github.com/gunjanpandey1/Code-Together.git
cd Code-Together

# 2. Install dependencies
npm install

# 3. Start the server
npm start

# 4. Open the Platform
Open your browser and go to: http://localhost:3000
The server will automatically check if the g++ compiler is available on your system.
```
### Using the Platform

#### 1. **Authentication**
- **Sign Up**: Create a new account with username, email, and password
- **Login**: Use existing credentials to log in
- Test credentials available:
 - Username: `deva`, Password: `123456`
 - Username: `dev`, Password: `123456`

#### 2. **Creating a Room**
- Click "Create Room" on the home page
- Enter room name, description (optional), and difficulty level
- Choose if the room should be public or private
- Share the generated 6-digit room code with friends
- Use "Copy Code" button for easy sharing

#### 3. **Joining a Room**
- **Method 1**: Click "Join Room" → "By Room Code" → Enter the 6-digit code
- **Method 2**: Click "Join Room" → "Browse Rooms" → Select from available public rooms
- **Method 3**: Click on any active room displayed on the home page
- Start solving problems and chatting with participants!

#### 4. **Solving Problems**
- Browse problems in the "Problems" section
- Click on any problem to start solving
- **C++ Programming**: Write solutions in C++17
- **Template Code**: Auto-loaded templates for each problem
- **Test Cases**: Click "Test Cases" to see sample inputs/outputs
- **Run Code**: Compile and test your C++ solution
- **Custom Input**: Use custom input for testing
- **Submit**: Run against all hidden test cases for evaluation

#### 5. **Room Chat & Collaboration**
- Chat with other participants in real-time while solving problems
- See who joins/leaves the room
- Press Enter to send messages quickly
- System messages show room activity

#### 6. **Leaderboard**
- View your ranking compared to other users
- Track problems solved and total score
- Scoring: Easy (10 pts), Medium (25 pts), Hard (50 pts)

## Problem Categories

### Easy Problems (4 problems)
- Two Sum
- Reverse String
- Palindrome Number
- Valid Parentheses

### Medium Problems (3 problems)
- Maximum Subarray
- Merge Two Sorted Lists
- Binary Search

### Hard Problems (3 problems)
- Longest Common Subsequence
- Word Ladder
- N-Queens

## Technical Details

### Tech Stack
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Node.js with Express.js
- **Real-time**: Socket.IO for live collaboration
- **Compiler**: G++ for C++ code execution
- **Storage**: Browser localStorage + Server-side processing
- **Styling**: Custom CSS with modern design principles
- **Containerization**: Docker
- **Icons**: Font Awesome
- **Fonts**: Google Fonts (Inter)

### Data Storage
All data is stored locally in your browser using localStorage:
- User accounts and authentication
- Coding problems and solutions
- Room information and participants
- Leaderboard data

### Keyboard Shortcuts
- `Ctrl + Enter`: Run code
- `Ctrl + Shift + Enter`: Submit code

## Browser Compatibility

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## Future Enhancements (MongoDB Integration)

For a full production version with MongoDB, consider adding:
- More advanced code execution and testing
- Problem creation by users
- Advanced analytics and progress tracking

