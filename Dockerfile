# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy ALL files first (rely on .dockerignore for node_modules/dist)
COPY . .

# Install dependencies
RUN if [ -f yarn.lock ]; then yarn install; \
    else npm install; fi

# Build the application
RUN npm run build

# Production stage
FROM node:22-alpine

WORKDIR /app

# Copy package files and install only production deps
COPY package.json yarn.lock* package-lock.json* ./
RUN if [ -f yarn.lock ]; then yarn install --production; \
    else npm install --only=production; fi

# Copy build output from builder stage
COPY --from=builder /app/dist ./dist

# Expose the port the app runs on
EXPOSE 3001

# Start the application
CMD ["node", "dist/main"]
