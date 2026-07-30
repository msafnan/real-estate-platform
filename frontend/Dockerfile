# Frontend — Next.js (App Router)
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# BACKEND_URL: the /api proxy destination (read by next.config at build).
# NEXT_PUBLIC_SITE_URL: public site origin for sitemap/robots.
ARG BACKEND_URL=http://localhost:4000
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ENV BACKEND_URL=$BACKEND_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL

RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "run", "start"]
