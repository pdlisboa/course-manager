# ---------- 1. Compila o front (Vue + Vite) ----------
FROM node:24-slim AS web
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY vite.config.ts ./
COPY shared ./shared
COPY web ./web
RUN npm run build

# ---------- 2. Imagem final: só o servidor e o front já compilado ----------
FROM node:24-slim

ENV NODE_ENV=production \
    COURSES_DIR=/courses \
    DATA_DIR=/data \
    PORT=3000

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src
COPY shared ./shared
COPY --from=web /app/dist ./dist

RUN mkdir -p /data && chown node:node /data
USER node

EXPOSE 3000
VOLUME /data

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "--disable-warning=ExperimentalWarning", "src/server.ts"]
