FROM node:18-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Set production environment
ENV NODE_ENV=production

# Expose port
EXPOSE 8080

# Start server
CMD ["node", "server.js"] 