FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig*.json ./
COPY src ./src
COPY prisma ./prisma
COPY prisma.config.ts ./

# Prisma generate only needs DATABASE_URL to be set so the config loads; value is not used at build time.
ARG DATABASE_URL=postgresql://postgres:postgres@postgres:5432/mydb?schema=public
ENV DATABASE_URL=${DATABASE_URL}

# Build NestJS application and Prisma client
RUN npx prisma generate && npm run build
RUN test -f /app/dist/main.js || (echo "Build failed: dist/main.js not found" && ls -la /app/dist 2>/dev/null; exit 1)

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./
# Prisma client is generated in builder; runner's npm ci does not run prisma generate
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 3000

# Apply migrations then start the app (DATABASE_URL from docker-compose)
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]

