FROM node:24-bookworm-slim

WORKDIR /workspace

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci

COPY backend/src backend/src
COPY infra/docker/apply-local-migrations.mjs infra/docker/apply-local-migrations.mjs

EXPOSE 3000
CMD ["npm", "run", "dev", "--workspace", "backend"]
