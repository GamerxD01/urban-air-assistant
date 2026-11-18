# Small, non-root production image for Google Cloud Run (or any container host).
FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

# Install only runtime dependencies (express); dev tooling never reaches the image.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

COPY server.js ./
COPY src ./src
COPY public ./public

USER node
# Cloud Run injects PORT (default 8080); server.js reads it.
ENV PORT=8080 TRUST_PROXY=1
EXPOSE 8080
CMD ["node", "server.js"]
