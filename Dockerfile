# YourMoneyOurMoney production image: the built React client and the Express API in one container.
# Cloud Run runs this image, CI builds it, and docker-compose.yml runs it locally (L5-03).
# Adapted from the Lab 5 Starter Kit root Dockerfile. Build from the repo root: docker build .
#
# - Listens on $PORT (Cloud Run sets it; 3000 by default here).
# - No secret is baked in: DATABASE_URL, SESSION_SECRET and the seed passwords come from the
#   environment at run time (Secret Manager on Cloud Run).
# - prisma/ and the dev dependencies (prisma CLI, tsx) stay in the image on purpose: the Cloud Run
#   migration job runs `npx prisma migrate deploy && npm run prisma:seed` from this same image.

# Stage 1: build the client (tsc + Vite) into /app/client/dist.
FROM node:24-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Stage 2: build the server (Prisma client + tsc) into /app/server/dist.
FROM node:24-alpine AS server-builder
WORKDIR /app/server
# Prisma's query engine needs openssl on alpine.
RUN apk add --no-cache openssl
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npx prisma generate && npm run build

# Stage 3: runtime image.
FROM node:24-alpine AS production
WORKDIR /app/server
RUN apk add --no-cache openssl

COPY --from=server-builder /app/server/package*.json ./
COPY --from=server-builder /app/server/node_modules ./node_modules
COPY --from=server-builder /app/server/dist ./dist
COPY --from=server-builder /app/server/prisma ./prisma
# server/src/app.ts serves the built client from here (CLIENT_DIST_DIR) outside NODE_ENV=test.
COPY --from=client-builder /app/client/dist /app/client/dist

ENV NODE_ENV=production
ENV TZ=Asia/Bangkok
ENV PORT=3000
ENV CLIENT_DIST_DIR=/app/client/dist
EXPOSE 3000

# Run as the unprivileged user that ships with the node image.
USER node

# tsc compiles src/ to dist/src/ because tsconfig also includes prisma/ and test/ (see `npm start`).
CMD ["node", "dist/src/index.js"]
