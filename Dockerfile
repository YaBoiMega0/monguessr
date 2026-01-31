FROM oven/bun:1 AS base

WORKDIR /app

COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile

COPY src ./src
COPY public ./public
COPY private ./private

RUN mkdir ./images

EXPOSE ${PORT:-8000}

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD bunx --bun http://localhost:${PORT:-8000}/ || exit 1

CMD ["bun", "run", "src/server.ts"]