FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install curl for container health checks
RUN apk add --no-cache curl

# Copy package files first for better layer caching
COPY package.json package-lock.json ./
COPY gui/package.json gui/package-lock.json ./gui/

# Install dependencies
RUN npm ci --omit=dev && \
    cd gui && npm ci && \
    cd ..

# Copy source code
COPY src ./src
COPY gui ./gui

# Build frontend
RUN cd gui && npm run build && cd ..

# Expose port
EXPOSE 3000

ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=15s --timeout=3s --start-period=15s --retries=3 \
    CMD curl -fsS http://localhost:3000/health >/dev/null || exit 1

# Start backend (which serves frontend)
CMD ["node", "src/index.js"]
