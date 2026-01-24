# ===========================================
# Portfolio X-Ray API - Dockerfile
# Multi-stage build for NestJS application
# ===========================================

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the application
RUN npm run build

# ===========================================
# Production stage
# ===========================================
FROM node:20-alpine AS production

WORKDIR /app

# Set environment
ENV NODE_ENV=production

# Copy built application and dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma

# Regenerate Prisma client in production to ensure it's available
RUN npx prisma generate

# Verify build artifacts exist
RUN ls -la dist/ || echo "WARNING: dist directory not found"
RUN test -f dist/src/main.js || echo "ERROR: dist/src/main.js not found"

# Expose port (Railway will set PORT env var)
EXPOSE 3000

# Note: Healthcheck is handled by Railway via railway.json
# Railway will check /api/health endpoint

# Start the application
# Use node directly to ensure proper signal handling
# NestJS preserves src/ directory structure in dist/
CMD ["node", "dist/src/main.js"]
