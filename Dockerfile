# ---- Build du frontend ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --workspace=frontend --include-workspace-root=false
COPY frontend frontend
RUN npm run build --workspace=frontend

# ---- Image d'exécution ----
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=7001 \
    SERVE_FRONTEND=true

COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --workspace=backend --include-workspace-root=false --omit=dev && npm cache clean --force

COPY backend backend
COPY --from=build /app/frontend/dist frontend/dist

# Données (db.json, sessions, file d'ingestion) et vault Obsidian
RUN mkdir -p backend/data vault && chown -R node:node backend/data vault
VOLUME ["/app/backend/data", "/app/vault"]

USER node
EXPOSE 7001
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:${PORT}/api/auth/status >/dev/null || exit 1

CMD ["node", "backend/src/server.js"]
