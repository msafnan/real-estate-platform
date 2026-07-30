# Backend — Express + TypeScript + Prisma
FROM node:18-alpine

WORKDIR /app

# Install deps (with dev deps for the build + prisma generate).
COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

ENV NODE_ENV=production
EXPOSE 4000

# Apply migrations, then start. (Seed separately: `npm run seed`.)
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
