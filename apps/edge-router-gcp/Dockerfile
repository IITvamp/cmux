# syntax=docker/dockerfile:1

FROM node:20-slim AS builder

WORKDIR /app

COPY package.json tsconfig.json tsconfig.build.json ./
COPY src ./src

RUN npm install
RUN npm run build
RUN npm prune --omit=dev

FROM node:20-slim

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./package.json

EXPOSE 8787

CMD ["node", "dist/index.js"]
