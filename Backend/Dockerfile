# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — deps
#   Install only production + dev dependencies so we can compile TypeScript.
#   Keeping this in its own layer means Docker cache is reused when only
#   source files change (not package.json).
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
# Install ALL deps (dev deps needed for tsc)
RUN npm ci

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — build
#   Copy source, generate Prisma client, compile TypeScript → dist/
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app

# Bring in installed node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source files
COPY . .

# Generate Prisma client (schema must be present before tsc runs because
# @prisma/client is referenced from source files)
RUN npx prisma generate

# Compile TypeScript → dist/
RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 3 — runtime
#   Lean production image — only compiled JS + production node_modules.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

WORKDIR /app

# Re-install only production dependencies (no dev deps, no tsc, no ts-node)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy compiled output from build stage
COPY --from=build /app/dist ./dist

# Copy Prisma schema + generated client (needed at runtime for query engine)
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 4000

# The backend owns production migrations. Railway's worker service overrides
# this command and starts only the BullMQ worker.
CMD ["sh", "-c", "npm run migrate && node dist/server.js"]
