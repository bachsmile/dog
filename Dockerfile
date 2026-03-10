# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package management files
COPY package.json yarn.lock* package-lock.json* ./

# Install dependencies
RUN if [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
    else npm ci; fi

# Copy application source
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:22-alpine

WORKDIR /app

# Copy package management files for production install
COPY package.json yarn.lock* package-lock.json* ./

# Install only production dependencies
RUN if [ -f yarn.lock ]; then yarn install --production --frozen-lockfile; \
    else npm ci --only=production; fi

# Copy build output from builder stage
COPY --from=builder /app/dist ./dist

# Expose the port the app runs on
EXPOSE 3001

# Start the application
CMD ["node", "dist/main"]
