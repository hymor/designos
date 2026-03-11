FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY angular.json tsconfig*.json ./
COPY src ./src

RUN npm run build

FROM nginx:1.27-alpine AS runner

WORKDIR /usr/share/nginx/html

COPY --from=builder /app/dist/angular-template/browser ./

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

