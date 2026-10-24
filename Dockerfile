FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:24-bookworm-slim
ARG IMAGE_VERSION=dev
ARG VCS_REF
ARG BUILD_DATE
LABEL org.opencontainers.image.title="How Long Will It Last?" \
      org.opencontainers.image.description="Self-hosted reserve tracking and depletion forecasts from irregular measurements." \
      org.opencontainers.image.url="https://github.com/simonjamain/howlongwillitlast" \
      org.opencontainers.image.documentation="https://github.com/simonjamain/howlongwillitlast/blob/main/README.md" \
      org.opencontainers.image.source="https://github.com/simonjamain/howlongwillitlast" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.authors="simonjamain (https://github.com/simonjamain)" \
      org.opencontainers.image.vendor="simonjamain" \
      org.opencontainers.image.version="${IMAGE_VERSION}" \
      org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.created="${BUILD_DATE}"
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 DATABASE_PATH=/data/app.sqlite AUTH_MODE=proxy
WORKDIR /app
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
RUN mkdir /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server/server.js"]
