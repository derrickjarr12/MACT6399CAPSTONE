# PNF-AIMS Production Deployment Guide

## Overview
PNF-AIMS (Performance-driven Notation Framework - AI for Musical Synthesis) is a full-stack audio generation platform with a React frontend and Node.js backend. This guide covers production deployment, configuration, and monitoring.

---

## Table of Contents
1. [System Requirements](#system-requirements)
2. [Environment Setup](#environment-setup)
3. [Frontend Deployment](#frontend-deployment)
4. [Backend Deployment](#backend-deployment)
5. [Docker Deployment](#docker-deployment)
6. [Preflight Verification](#preflight-verification)
7. [Error Handling & Monitoring](#error-handling--monitoring)
8. [Security Considerations](#security-considerations)
9. [Troubleshooting](#troubleshooting)

---

## System Requirements

### Frontend
- **Node.js**: v18+ or v20+
- **npm**: v9+
- **Browser**: Chrome 90+, Safari 14+, Firefox 88+, Edge 90+
- **Storage**: 10MB minimum (localStorage for sessions)

### Backend
- **Node.js**: v18+
- **npm**: v9+
- **RAM**: 1GB minimum
- **Disk**: 2GB minimum for logs and cache

### API Requirements
- **ElevenLabs API Key**: Required for voice generation
- **Optional Providers**: Suno, Mureka, Udio (for music generation)

---

## Environment Setup

### 1. Install Dependencies

```bash
# Install frontend dependencies
cd gui
npm install

# Install backend dependencies (if running locally)
cd ../src
npm install
```

### 2. Configure Environment Variables

```bash
# Copy .env.example to .env.production
cp .env.example .env.production

# Edit with your actual values
nano .env.production
```

**Required Variables**:
```
VITE_API_BASE_URL=https://your-production-backend.com
VITE_ELEVENLABS_API_KEY=sk-xxxxx
```

### 3. Validate Configuration

```bash
# Run startup validation (from gui directory)
npm run validate:env
```

---

## Frontend Deployment

### Build for Production

```bash
cd gui
npm run build
```

This creates an optimized `dist/` folder ready for deployment.

### Deploy to Static Host (AWS S3, Netlify, Vercel)

#### Option A: AWS S3 + CloudFront

```bash
# Build
npm run build

# Sync to S3
aws s3 sync dist/ s3://your-bucket-name/ --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
```

#### Option B: Netlify

```bash
npm install -g netlify-cli

# Build and deploy
netlify deploy --prod --dir=dist
```

#### Option C: Vercel

```bash
npm install -g vercel

# Deploy
vercel --prod
```

### Configure CORS (for API calls)

If backend is on different domain, add CORS headers:

```
Access-Control-Allow-Origin: https://your-frontend-domain.com
Access-Control-Allow-Methods: POST, GET, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

---

## Backend Deployment

### Start Backend Server

```bash
cd src
npm start
```

**Default**: Runs on `http://localhost:3000`

### Enable Production Logging

```bash
# Log to file
NODE_ENV=production npm start > api.log 2>&1 &
```

### PM2 Process Management (Recommended)

```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start src/index.js --name "pnf-aims-api"

# Auto-restart on reboot
pm2 startup
pm2 save

# View logs
pm2 logs pnf-aims-api
```

### Scale with Multiple Processes

```bash
# Cluster mode for multi-core systems
pm2 start src/index.js -i max --name "pnf-aims-api"
```

---

## Docker Deployment

### Build Docker Image

Create `Dockerfile` in project root:

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Backend dependencies
COPY src/package*.json ./src/
RUN cd src && npm ci --production

# Frontend build
COPY gui/package*.json ./gui/
RUN cd gui && npm ci && npm run build

EXPOSE 3000

CMD ["node", "src/index.js"]
```

### Build and Run

```bash
# Build image
docker build -t pnf-aims:latest .

# Run container
docker run -p 3000:3000 \
  -e VITE_ELEVENLABS_API_KEY=sk-xxxxx \
  -e VITE_API_BASE_URL=https://your-backend.com \
  pnf-aims:latest
```

### Docker Compose (Frontend + Backend)

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      VITE_ELEVENLABS_API_KEY: ${VITE_ELEVENLABS_API_KEY}
    restart: unless-stopped

  frontend:
    build:
      context: ./gui
      dockerfile: Dockerfile
    ports:
      - "5173:5173"
    environment:
      VITE_API_BASE_URL: http://backend:3000
    depends_on:
      - backend
```

**Run**:
```bash
docker-compose up -d
```

---

## Preflight Verification

Run these checks before and after deployment:

```bash
# Local quality gate
npm run preflight

# Local startup + health readiness gate
npm run preflight:startup

# Live deployment smoke check
npm run preflight:live -- https://your-app.example.com
```

Detailed reference:

- `./PREFLIGHT_TEST_GUIDE.md`

---

## Error Handling & Monitoring

### Enhanced Error Messages (Production)

The application now includes intelligent error handling:

| Error | User Message | Recovery |
|-------|--------------|----------|
| Network timeout | "Request timeout. Network may be slow." | Retry automatically (3 attempts) |
| API 401 | "Unauthorized. Check API keys." | Verify credentials in config |
| API 429 | "Rate limited. Service is busy." | Wait 60s and retry |
| API 500 | "Provider error. Try again shortly." | Automatic retry with backoff |
| localStorage full | "Storage quota exceeded." | Clear old sessions |
| No audio returned | "Generation completed but no audio." | Check provider logs |

### Monitoring Endpoints

**Backend Health Check**:
```bash
curl http://localhost:3000/health
```

**API Status**:
```bash
curl http://localhost:3000/api/status
```

### Logging

**Frontend Console** (Chrome DevTools → Console):
- Errors logged with 🔴 prefix
- Warnings logged with ⚠️ prefix

**Backend Logs**:
```bash
# View real-time logs
tail -f api.log | grep "ERROR\|WARN"
```

### Monitoring Tools

**Option A: Simple Log Rotation**
```bash
# Rotate logs daily
logrotate -f /etc/logrotate.conf
```

**Option B: Sentry (Error Tracking)**
```javascript
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "https://key@sentry.io/project",
  environment: "production"
});
```

**Option C: DataDog / New Relic**
```bash
# Add monitoring agent
npm install dd-trace

# Start with tracing
node -r dd-trace/init src/index.js
```

---

## Security Considerations

### 1. API Keys
- ✅ Store in environment variables, NOT in code
- ✅ Rotate keys every 90 days
- ✅ Use AWS Secrets Manager or Azure Key Vault in production

### 2. HTTPS
- ✅ All production endpoints MUST use HTTPS
- ✅ Use Let's Encrypt (free SSL certificates)
- ✅ Set HSTS headers:
  ```
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  ```

### 3. Content Security Policy
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; connect-src 'self' https://api.elevenlabs.io https://api.suno.ai
```

### 4. CORS Configuration
```javascript
// Only allow known origins
const allowedOrigins = [
  'https://your-frontend.com',
  'https://your-app.example.com'
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
```

### 5. Rate Limiting
```javascript
// Limit requests to prevent abuse
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use(limiter);
```

### 6. Input Validation
- ✅ Validate all user inputs (prompt length, file size)
- ✅ Sanitize file uploads
- ✅ Reject oversized payloads (>2MB)

---

## Troubleshooting

### Issue 1: "Cannot reach backend"
**Cause**: Backend not running or wrong URL
```bash
# Check if backend is running
curl http://localhost:3000/health

# Check environment variable
echo $VITE_API_BASE_URL
```

### Issue 2: "Unauthorized (401)"
**Cause**: Invalid or missing API key
```bash
# Verify API key format
echo $VITE_ELEVENLABS_API_KEY | head -c 10

# Test with curl
curl -H "Authorization: Bearer $VITE_ELEVENLABS_API_KEY" \
  https://api.elevenlabs.io/v1/voices
```

### Issue 3: "Generation timed out"
**Cause**: Provider service slow or network latency
```bash
# Increase timeout in .env
VITE_REQUEST_TIMEOUT=60000

# Check network latency
ping api.elevenlabs.io
```

### Issue 4: "localStorage full"
**Cause**: Too many saved sessions
```javascript
// Clear old sessions (in browser console)
localStorage.removeItem('pnf-aims-sessions');
```

### Issue 5: "CORS error"
**Cause**: Frontend and backend on different origins
```bash
# Check CORS headers
curl -i http://localhost:3000/api/apiframe/generate

# Add CORS middleware to backend
```

---

## Performance Tuning

### Frontend Optimization
- ✅ Built-in code splitting (HolographicGlobe lazy-loaded)
- ✅ Web Audio API for efficient audio processing
- ✅ FFT analysis at 30ms intervals (not blocking)
- ✅ localStorage caching for sessions

### Backend Optimization
- ✅ Connection pooling for API calls
- ✅ Caching job status responses
- ✅ Gzip compression on all endpoints
- ✅ Max 20 concurrent generation requests

### Monitoring Performance
```bash
# Frontend bundle size
npm run build -- --report

# Backend CPU/memory
pm2 monit
```

---

## Rollback Plan

If production breaks after deployment:

```bash
# Revert to previous version
git revert HEAD
npm run build
# Redeploy
```

Or use blue-green deployment:
```bash
# Deploy to "green" environment first
# Test thoroughly
# Switch traffic from "blue" to "green"
# Keep "blue" as rollback target
```

---

## Support & Documentation

- **API Docs**: See `/docs/technical/saion/03-runtime-and-apis.md`
- **Architecture**: See `/docs/technical/saion/02-system-architecture.md`
- **Release Notes**: See `/releases/release-history.jsonl`

---

## Version Info

- **Frontend**: React 18, Vite 4+
- **Backend**: Node.js 18+, Express
- **Last Updated**: 2026-07-24
- **Status**: Production Ready ✅
