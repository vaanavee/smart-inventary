# Node backend (auth / RFID / room-entries) — port 4000
# Backed by Postgres via DATABASE_URL (see db.js).
FROM node:22-slim

WORKDIR /app
ENV NODE_ENV=production

# Install deps first for better layer caching
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

# App source
COPY . .

EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=5s --retries=5 --start-period=20s \
  CMD node -e "require('http').get('http://localhost:4000/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "index.js"]
