# syntax=docker/dockerfile:1
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/rules ./rules

# pdfjs-dist's fake worker (used when no real Worker is available, as in
# Node) dynamically imports pdf.worker.mjs relative to pdf.mjs at runtime.
# Next's file tracer only follows static imports, so it misses this file;
# copy it explicitly to the same path standalone output already resolves
# pdf.mjs from.
COPY --from=builder --chown=nextjs:nodejs \
  /app/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs \
  ./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs

USER nextjs

EXPOSE 8080
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
