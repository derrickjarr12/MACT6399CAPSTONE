# PNF-AIMS Docker Deployment Guide

## Overview

This guide covers building, testing, and deploying PNF-AIMS using Docker and Docker Compose.

## Prerequisites

### System Requirements
- **Docker**: v20.10+ ([Install](https://docs.docker.com/get-docker/))
- **Docker Compose**: v1.29+ (usually included with Docker Desktop)
- **Disk Space**: ~2GB for build artifacts
- **RAM**: 2GB minimum, 4GB recommended
- **CPU**: 2 cores minimum

### Verify Installation
```bash
docker --version
docker-compose --version
docker run hello-world  # Test Docker daemon
```

---

## File Structure

```
MACT6399CAPSTONE/
├── Dockerfile              # Multi-stage build configuration
├── docker-compose.yml      # Orchestration for local development
├── .env.production         # Production environment variables
├── gui/                    # Frontend (React + Vite)
├── src/                    # Backend (Node.js)
└── README.md              # Project documentation
```

---

## Quick Start (5 minutes)

### Option 1: Docker Compose (Recommended for local testing)

```bash
# Navigate to project root
cd /path/to/MACT6399CAPSTONE

# Start with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f pnf-aims-api

# Access the app at http://localhost:3000
```

**Stop the container**:
```bash
docker-compose down
```

### Option 2: Build & Run Manually

```bash
# Build the image
docker build -t pnf-aims:latest .

# Run the container
docker run -p 3000:3000 \
  -e VITE_ELEVENLABS_API_KEY=sk_xxxxx \
  -e VITE_API_BASE_URL=http://localhost:3000 \
  pnf-aims:latest

# Access at http://localhost:3000
```

**Stop the container**:
```bash
# Find container ID
docker ps

# Stop it
docker stop <container-id>
```

---

## Build Instructions

### Local Development Build

```bash
# Full rebuild (no cache)
docker build --no-cache -t pnf-aims:dev .

# With build output
docker build -t pnf-aims:dev . --progress=plain

# View layers
docker history pnf-aims:dev
```

### Production Build

```bash
# Optimized build for production
docker build \
  --target production \
  -t pnf-aims:1.0.0 \
  -t pnf-aims:latest \
  .

# Push to registry
docker tag pnf-aims:latest myregistry.azurecr.io/pnf-aims:1.0.0
docker push myregistry.azurecr.io/pnf-aims:1.0.0
```

### Build Optimization

**Reduce build time**:
```bash
# Use BuildKit (faster parallel builds)
DOCKER_BUILDKIT=1 docker build -t pnf-aims:latest .

# With caching
docker build -t pnf-aims:latest . --build-arg BUILDKIT_INLINE_CACHE=1
```

**Reduce image size**:
```bash
# View layer sizes
docker inspect -f '{{ range .RootFS.Layers }}{{ println .}}{{ end }}' pnf-aims:latest | wc -l

# Current size should be ~800MB-1GB
docker images pnf-aims
```

---

## Running with Docker Compose

### Basic Setup

```yaml
# docker-compose.yml (already created)
version: '3.8'

services:
  pnf-aims-api:
    build: .
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      VITE_ELEVENLABS_API_KEY: ${VITE_ELEVENLABS_API_KEY}
    restart: unless-stopped
```

### Create `.env` file

```bash
# .env (not in version control!)
VITE_ELEVENLABS_API_KEY=sk_your_key_here
VITE_SUNO_API_KEY=your_suno_key_here
VITE_MUREKA_API_KEY=your_mureka_key_here
```

### Start Services

```bash
# Start in foreground (see logs)
docker-compose up

# Start in background
docker-compose up -d

# Start specific service
docker-compose up pnf-aims-api

# Rebuild and start
docker-compose up --build
```

### View Logs

```bash
# Follow logs
docker-compose logs -f

# Follow specific service
docker-compose logs -f pnf-aims-api

# Show last 100 lines
docker-compose logs --tail=100

# Clear logs (in some systems)
docker-compose logs --no-log-prefix
```

### Stop Services

```bash
# Stop running containers
docker-compose stop

# Remove containers and networks
docker-compose down

# Remove everything including volumes
docker-compose down -v

# Remove specific service
docker-compose stop pnf-aims-api
docker-compose rm pnf-aims-api
```

### Advanced Compose Options

**Scale multiple instances**:
```bash
# Run 3 copies (requires load balancer)
docker-compose up --scale pnf-aims-api=3
```

**Environment override**:
```bash
# Use different compose file
docker-compose -f docker-compose.prod.yml up

# Override environment
docker-compose up -e NODE_ENV=production
```

**Health checks**:
```bash
# Check container health
docker-compose ps

# Output:
# NAME                 STATUS              HEALTH
# pnf-aims-api         Up 2 minutes        healthy ✅
```

---

## Testing the Deployment

### Step 1: Container Startup

```bash
# Watch container start
docker-compose up pnf-aims-api

# Expected output:
# pnf-aims-api  | ✅ Frontend: dist/ files ready
# pnf-aims-api  | ✅ Backend listening on port 3000
# pnf-aims-api  | Health check passed
```

### Step 2: Health Check

```bash
# Test health endpoint
curl http://localhost:3000/health

# Expected: 
# {"status":"ok","uptime":123}
```

### Step 3: API Test

```bash
# Test API endpoint
curl -X POST http://localhost:3000/api/apiframe/generate \
  -H "Content-Type: application/json" \
  -d '{
    "generator": "suno",
    "prompt": "uplifting piano melody in C major",
    "requestId": "test-123"
  }'

# Expected: Job ID returned (or error if no API key configured)
```

### Step 4: Frontend Test

Open browser:
```
http://localhost:3000
```

- [ ] Page loads without errors
- [ ] PERFORMANCE tab responsive
- [ ] Dials move smoothly
- [ ] GENERATE tab shows
- [ ] All buttons clickable
- [ ] Console shows no errors

### Step 5: Performance Check

**In browser console**:
```javascript
// Check memory
window.PERF_TEST_SCENARIOS.quickMemoryCheck()

// Should show:
// {
//   heapUsedMB: "45.2",
//   heapPercentUsed: "2.2",
//   timestamp: "..."
// }
```

### Step 6: Error Simulation (in container)

```bash
# Stop backend to test error handling
docker-compose stop pnf-aims-api

# In browser, try to generate - should show:
# "Cannot reach local backend. Ensure backend is running on port 3000."

# Restart
docker-compose up pnf-aims-api
```

---

## Debugging Containers

### View Container Status

```bash
# List running containers
docker ps

# List all containers
docker ps -a

# Show container details
docker inspect pnf-aims-api
```

### Access Container Shell

```bash
# Enter running container
docker exec -it <container-id> /bin/sh

# Navigate inside container
# cd /app
# ls -la
# npm list
# env | grep VITE
```

### View Container Logs

```bash
# Real-time logs
docker logs -f <container-id>

# Show last 50 lines
docker logs --tail=50 <container-id>

# Show logs with timestamps
docker logs -t <container-id>
```

### Common Issues

**Port already in use**:
```bash
# Check what's using port 3000
lsof -i :3000

# Use different port
docker run -p 3001:3000 pnf-aims:latest
```

**Image build failed**:
```bash
# Rebuild with full output
docker build -t pnf-aims:latest . --progress=plain

# Check node version in Dockerfile
# Ensure npm cache is cleared
docker builder prune
```

**Container won't start**:
```bash
# Check logs immediately
docker-compose logs pnf-aims-api

# Check file permissions (usually not the issue with Alpine)
# Check if VITE environment variables are set
docker exec <container-id> env | grep VITE
```

---

## Docker Image Details

### Dockerfile Breakdown

```dockerfile
# Stage 1: Builder
FROM node:20-alpine

# Install dependencies
COPY package*.json ./src/
RUN cd src && npm ci --production

# Build frontend
COPY gui/package*.json ./gui/
RUN cd gui && npm ci && npm run build

# Stage 2: Runtime (same image, but optimized)
# Copy built files and dependencies
COPY --from=builder /app/src ./src
COPY --from=builder /app/gui/dist ./gui/dist

# Health check
HEALTHCHECK --interval=30s --timeout=3s CMD curl -f http://localhost:3000/health

# Run app
CMD ["node", "src/index.js"]
```

### Image Size Optimization

Current approach:
- ✅ Alpine Linux (small base: 5MB)
- ✅ Single-stage build (or build only)
- ✅ Production dependencies only (`npm ci --production`)
- ✅ No test files or source maps
- ✅ Compressed gzip assets

**Expected final size**: 800MB-1GB

To further reduce:
```bash
# Strip debug symbols
node --prof <file.js>  # Doesn't help much

# Use distroless base (experimental)
FROM gcr.io/distroless/nodejs20-debian11
```

---

## Production Deployment

### AWS ECS

```bash
# Push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789.dkr.ecr.us-east-1.amazonaws.com

docker tag pnf-aims:latest 123456789.dkr.ecr.us-east-1.amazonaws.com/pnf-aims:latest
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/pnf-aims:latest
```

Then create ECS task definition with the image URI.

### Azure Container Instances

```bash
# Push to ACR
az acr build -r myregistry -t pnf-aims:latest .

# Run container
az container create \
  --resource-group myResourceGroup \
  --name pnf-aims-container \
  --image myregistry.azurecr.io/pnf-aims:latest \
  --ports 3000 \
  --environment-variables \
    VITE_ELEVENLABS_API_KEY="sk_xxxxx" \
    NODE_ENV="production"
```

### Google Cloud Run

```bash
# Build and push
gcloud builds submit --tag gcr.io/my-project/pnf-aims

# Deploy
gcloud run deploy pnf-aims \
  --image gcr.io/my-project/pnf-aims \
  --platform managed \
  --region us-central1 \
  --port 3000 \
  --set-env-vars="VITE_ELEVENLABS_API_KEY=sk_xxxxx"
```

### Kubernetes (K8s / AKS)

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: pnf-aims
spec:
  replicas: 3
  selector:
    matchLabels:
      app: pnf-aims
  template:
    metadata:
      labels:
        app: pnf-aims
    spec:
      containers:
      - name: api
        image: myregistry.azurecr.io/pnf-aims:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: VITE_ELEVENLABS_API_KEY
          valueFrom:
            secretKeyRef:
              name: pnf-aims-secrets
              key: elevenlabs-api-key
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1024Mi"
            cpu: "500m"
```

Deploy:
```bash
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
```

---

## Monitoring & Logging

### Docker Stats

```bash
# View resource usage in real-time
docker stats pnf-aims-api

# Expected output:
# CONTAINER    CPU %  MEM USAGE  NET I/O
# pnf-aims-api 0.5%   65.2 MiB   1.2 MB
```

### Log Aggregation

**With Docker logging driver**:
```bash
docker run \
  --log-driver awslogs \
  --log-opt awslogs-group=/ecs/pnf-aims \
  --log-opt awslogs-region=us-east-1 \
  pnf-aims:latest
```

**ELK Stack integration**:
```bash
docker-compose -f docker-compose.elk.yml up
# Includes Elasticsearch, Logstash, Kibana
```

---

## Cleanup

```bash
# Remove stopped containers
docker container prune

# Remove unused images
docker image prune

# Remove all unused data
docker system prune

# Remove specific image
docker rmi pnf-aims:latest

# Clean builder cache
docker builder prune
```

---

## Troubleshooting

### Build Fails
```bash
# Rebuild with verbose output
DOCKER_BUILDKIT=1 docker build --progress=plain -t pnf-aims:latest .

# Check Node version compatibility
docker run -it node:20-alpine node --version

# Check npm cache
npm cache clean --force
```

### Container Won't Start
```bash
# Check the exact error
docker logs <container-id> 2>&1 | head -20

# Common issues:
# - Missing VITE environment variables
# - Port 3000 already in use
# - Insufficient memory
```

### High Memory Usage
```bash
# Reduce Node memory limit
docker run -m 512m pnf-aims:latest

# Or in docker-compose:
services:
  pnf-aims-api:
    mem_limit: 512m
    memswap_limit: 512m
```

### Slow Performance
```bash
# Check CPU throttling
docker stats

# Increase allocated resources
docker run -c 1024 pnf-aims:latest  # 1024 CPU shares

# Check if frontend is being served correctly
curl -I http://localhost:3000  # Should show index.html
```

---

## Checklists

### Before First Deploy
- [ ] Docker installed and tested
- [ ] `.env` file created with API keys
- [ ] `docker-compose.yml` reviewed
- [ ] Dockerfile builds without errors
- [ ] Image < 2GB (reasonable)
- [ ] Health check endpoint working
- [ ] App loads at localhost:3000
- [ ] No console errors
- [ ] Memory usage < 500MB

### Production Deployment Checklist
- [ ] Use `docker-compose.prod.yml` (if different)
- [ ] All environment variables set securely
- [ ] Image tagged with version (e.g., `:1.0.0`)
- [ ] Image pushed to registry
- [ ] Health checks configured
- [ ] Resource limits set (memory, CPU)
- [ ] Logs forwarded to centralized logging
- [ ] Monitoring/alerting configured
- [ ] Backup/disaster recovery plan documented
- [ ] Rollback procedure tested

---

## References

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Reference](https://docs.docker.com/compose/compose-file/)
- [Node.js Docker Best Practices](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/)
- [Alpine Linux](https://alpinelinux.org/)
- [Dockerfile Reference](https://docs.docker.com/engine/reference/builder/)
