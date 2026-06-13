# ---- Build stage ----
FROM node:20-alpine AS builder

WORKDIR /app

# Prisma on Alpine (musl) needs openssl so it picks the correct query engine
RUN apk add --no-cache openssl

# Install dependencies (including dev deps needed for build, prisma & seed)
COPY package*.json ./
COPY prisma ./prisma
RUN npm install

# Build app
COPY . .
RUN npx prisma generate
RUN npm run build

# ---- Production stage ----
FROM node:20-alpine

WORKDIR /app

# Prisma query engine needs libssl/openssl available at runtime on Alpine
RUN apk add --no-cache openssl

# ts-node (used to run the seed) needs a shell; alpine already has /bin/sh
# Copy build output and everything required to run migrations + seed at start.
# node_modules already contains the generated Prisma client + engine from the
# builder stage, so we do NOT run `prisma generate` again here (avoids a second
# engine download — which was failing on flaky networks).
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY package*.json ./
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Persisted uploads live here (mount a volume to keep them)
RUN mkdir -p /app/uploads

ENV NODE_ENV=production
ENV PORT=3100
EXPOSE 3100

ENTRYPOINT ["./docker-entrypoint.sh"]
