# Use Node.js 18 with build tools
FROM node:18-bullseye


# Install C++ compiler and build essentials
RUN apt-get update && apt-get install -y \
    build-essential \
    g++ \
    gcc \
    make \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create temp directory for code execution
RUN mkdir -p server/temp

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
