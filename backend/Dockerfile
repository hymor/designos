FROM node:22-alpine AS builder

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci

COPY tsconfig*.json ./
COPY src ./src
COPY prisma ./prisma
COPY prisma.config.ts ./

# Build NestJS application and Prisma client
RUN npx prisma generate && npm run build

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000

CMD ["node", "dist/main.js"]

