
FROM oven/bun:alpine



WORKDIR /app

COPY package.json bun.lockb* ./

RUN bun install --legacy-peer-deps

COPY . .

EXPOSE 3000


CMD ["bun", "run","bin.ts"]
