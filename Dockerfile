FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
COPY gui/package.json gui/package-lock.json ./gui/
COPY src/package.json src/package-lock.json ./src/

# Install dependencies
RUN npm ci --production && \
    cd gui && npm ci && \
    cd ../src && npm ci && \
    cd ..

# Build frontend
RUN cd gui && npm run build && cd ..

# Copy source code
COPY src ./src
COPY gui/dist ./gui/dist

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Start backend (which serves frontend)
CMD ["node", "src/index.js"]
