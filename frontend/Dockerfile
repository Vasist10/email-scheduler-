# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — build
#   Install dependencies and compile the Vite / React app.
#   Output lands in dist/ as static HTML + JS + CSS bundles.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite reads VITE_* env vars at build time.
# Pass VITE_API_BASE_URL as a build arg so the image can be reused
# for different environments without rebuilding from scratch.
ARG VITE_API_BASE_URL=http://localhost:4000
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — serve
#   Minimal nginx image serves the static bundle.
#   The custom nginx.conf routes all paths through index.html so that
#   React Router's client-side navigation works correctly.
# ─────────────────────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom config
COPY nginx.conf /etc/nginx/conf.d/app.conf

# Copy compiled React app from build stage
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
