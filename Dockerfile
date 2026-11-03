# Retro League on one machine: the Bun game server, serving the built client
# (dist/) and its WebSocket (/ws) from the same address. See docs/architecture/deploy.md.

FROM oven/bun:1 AS build
WORKDIR /app
COPY . .
RUN bun install
# The server imports @siege/shared's build (packages/shared/dist)
RUN cd packages/shared && bunx tsc -b
# The client, with the art and sounds in public/ (not in git, sent with the build context)
RUN bunx vite build

FROM oven/bun:1-slim
WORKDIR /app
COPY --from=build /app /app
ENV NODE_ENV=production \
    PORT=8080 \
    STATIC_DIR=/app/dist \
    LOG_LEVEL=info
EXPOSE 8080
WORKDIR /app/packages/server
CMD ["bun", "run", "src/server.ts"]
