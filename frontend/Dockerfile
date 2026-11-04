FROM node:24-bookworm-slim

WORKDIR /workspace

COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
RUN npm ci

COPY frontend frontend
# O frontend importa schemas Zod puros da arvore do backend.
COPY backend/src backend/src

EXPOSE 5173
WORKDIR /workspace/frontend
CMD ["/workspace/node_modules/.bin/vite", "--host", "0.0.0.0", "--port", "5173", "--strictPort"]
