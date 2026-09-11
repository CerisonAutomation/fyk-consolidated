# Docker Production Deployment Patterns

> Source: https://docs.docker.com/build/building/best-practices/

## Multi-Stage Dockerfile (Recommended)

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

# Stage 2: Production
FROM node:20-alpine AS production
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

EXPOSE 3000
USER node
CMD ["node", "dist/index.js"]
```

**Benefits:**
- Smaller final image (no dev dependencies, build tools)
- Reduced attack surface
- Better cache utilization

## Dockerfile Best Practices

### Choose the Right Base Image

```dockerfile
# Bad: Full OS image
FROM ubuntu:24.04

# Good: Alpine (minimal)
FROM node:20-alpine

# Better: Distroless (no shell, no package manager)
FROM gcr.io/distroless/nodejs20-debian12
```

### Use .dockerignore

```dockerignore
node_modules
.git
.env
.env.local
*.md
Dockerfile
docker-compose*.yml
.github
.vscode
coverage
.nyc_output
```

### Pin Base Image Versions

```dockerfile
# Mutable tag - can change between builds
FROM node:20

# Immutable digest - reproducible builds
FROM node:20-alpine@sha256:abc123...
```

### Leverage Build Cache

```dockerfile
# Install dependencies first (changes rarely)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source code last (changes frequently)
COPY . .
```

### Sort Multi-line Arguments

```dockerfile
# Alphabetical order makes maintenance easier
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    python3 \
    && rm -rf /var/lib/apt/lists/*
```

## Docker Compose for Production

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    restart: unless-stopped
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    deploy:
      resources:
        limits:
          memory: 256M

volumes:
  redis_data:
```

## Production Security

### Run as Non-Root User

```dockerfile
FROM node:20-alpine
RUN addgroup -g 1001 appgroup && adduser -u 1001 -G appgroup -s /bin/sh -D appuser
WORKDIR /app
COPY --chown=appuser:appgroup . .
USER appuser
CMD ["node", "index.js"]
```

### Read-Only Filesystem

```yaml
services:
  app:
    image: myapp
    read_only: true
    tmpfs:
      - /tmp
```

### Scan for Vulnerabilities

```bash
# Build with BuildKit for scanning
docker buildx build --sbom=true --provenance=true -t myapp:latest .

# Scan existing image
docker scout cves myapp:latest
```

## Image Tagging Strategy

```bash
# Semantic versioning
docker tag myapp:latest myapp:1.2.3
docker tag myapp:latest myapp:1.2
docker tag myapp:latest myapp:1

# Git SHA for traceability
docker tag myapp:latest myapp:abc1234

# Branch name for development
docker tag myapp:latest myapp:develop
```

## Rebuilding Images

```bash
# Pull latest base image
docker build --pull -t myapp:latest .

# Clean build (no cache)
docker build --no-cache -t myapp:latest .

# Both: fresh base + no cache
docker build --pull --no-cache -t myapp:latest .
```

## Quick Checklist

1. Use multi-stage builds for smaller images
2. Choose minimal base images (Alpine or distroless)
3. Create a `.dockerignore` file
4. Run containers as non-root
5. Set resource limits
6. Add health checks
7. Use semantic version tags
8. Scan for vulnerabilities regularly
9. Rebuild images frequently
10. Use Docker Compose or Swarm for orchestration
