# ---- 构建前端 ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- 运行：单进程同时托管 dist/ 和 /api ----
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8787
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server ./server
COPY stories ./stories
COPY --from=build /app/dist ./dist
# 会话落盘目录，挂成 volume，发版/重启不丢局
RUN mkdir -p data && chown node:node data
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8787/api/health || exit 1
CMD ["node_modules/.bin/tsx", "server/index.ts"]
