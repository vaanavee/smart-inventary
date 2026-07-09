# Node backend (auth / RFID / room-entries) — port 4000
# Uses the built-in node:sqlite module, which needs Node >= 22.5 (matches render.yaml's 22.12).
FROM node:22-slim

WORKDIR /app
ENV NODE_ENV=production

# Install deps first for better layer caching
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

# App source
COPY . .

# SQLite file lives on a mounted volume so data survives container restarts.
# db.js honours DB_PATH (falls back to ./data.db when unset).
RUN mkdir -p /data
ENV DB_PATH=/data/data.db

EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=5s --retries=5 --start-period=20s \
  CMD node -e "require('http').get('http://localhost:4000/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "index.js"]
