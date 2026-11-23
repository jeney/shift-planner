# Works with both BuildKit and the legacy builder. Targets: prod (default in compose.yaml), dev.
ARG NODE_VERSION=22

# ---- deps ----
FROM node:${NODE_VERSION}-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---- build: static bundle ----
FROM deps AS build
COPY . .
RUN npm run build

# ---- prod: nginx serves the bundle and proxies /api to the backend ----
FROM nginx:stable-alpine AS prod
ENV API_UPSTREAM=http://backend:8000
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --retries=5 CMD wget -qO- http://127.0.0.1/healthz || exit 1

# ---- dev: Vite dev server with hot reload (source is bind-mounted) ----
# Kept last so the legacy builder doesn't build it for the prod target.
FROM deps AS dev
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
