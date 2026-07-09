# Dashboard (Vite/React) — built to static files and served by nginx.
# nginx also replicates the dev-server proxy (vite.config.js) so the app's
# hardcoded relative paths (/api, /monitor-api, /monitor-ai-api) keep working
# in production without a VITE_API_BASE_URL.

# --- build stage ---
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci || npm install
COPY . .
RUN npm run build

# --- serve stage ---
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --retries=5 --start-period=10s \
  CMD wget -q --spider http://localhost/ || exit 1
