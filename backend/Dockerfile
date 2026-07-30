# Backend — Express + TypeScript + Prisma
# Debian "slim" (glibc), not alpine: alpine+npm hits an "Exit handler never
# called" bug under memory-limited CI builders (e.g. Render free tier).
FROM node:18-slim

# Prisma needs OpenSSL at generate + runtime.
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps. --include=dev forces devDependencies (TypeScript, prisma CLI)
# even if the builder sets NODE_ENV=production. --ignore-scripts skips the
# @prisma/client postinstall (engine download) that crashes npm on the free-tier
# builder — we run `prisma generate` explicitly right after instead.
COPY package*.json ./
RUN npm ci --include=dev --ignore-scripts --no-audit --no-fund

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

ENV NODE_ENV=production
EXPOSE 4000

# Apply migrations, then start. (Seed separately: `npm run seed`.)
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
