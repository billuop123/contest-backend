FROM oven/bun:alpine
WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install --legacy-peer-deps

# Copy app code
COPY . .

# Generate Prisma client
RUN npx prisma generate

EXPOSE 3000

# Start the app
CMD ["bun", "run", "bin.ts"]
