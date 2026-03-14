FROM node:22-alpine AS builder

# Build context is repo root. Mirror repo layout so relative path ../../../../../../src (6 levels up from shell) resolves.
WORKDIR /app
COPY frontend ./frontend
COPY src ./src

WORKDIR /app/frontend/shell
RUN npm ci
RUN npm run build
# Normalize to a fixed path (handles ../../dist from shell or /app/dist from cached build)
RUN cp -r ../../dist/angular-ui/browser /app/angular-build 2>/dev/null || cp -r /app/dist/angular-ui/browser /app/angular-build

FROM nginx:1.27-alpine AS runner

WORKDIR /usr/share/nginx/html

COPY --from=builder /app/angular-build ./

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

