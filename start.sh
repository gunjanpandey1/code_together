#!/bin/bash
echo "🚀 Starting CodeTogether Platform..."
echo ""
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install it from https://nodejs.org/"
    exit 1
fi
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi
if command -v g++ &> /dev/null; then
    echo "✅ G++ compiler detected - C++ code execution will work"
else
    echo "⚠️  G++ compiler not found - only JavaScript will work"
    echo "   To install g++:"
    echo "   - macOS: xcode-select --install"
    echo "   - Linux: sudo apt-get install g++"
    echo "   - Windows: Install MinGW-w64"
fi


echo ""
echo "🌐 Starting server on http://localhost:3000"
echo "   Press Ctrl+C to stop the server"
echo ""
npm start
