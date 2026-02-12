# ===============================
# 0. Global deterministic settings
# ===============================
ARG NODE_IMAGE=node:20.19.0-alpine3.20@sha256:9a9c00587bcb88209b164b2dba1f59c7389ac3a2cec2cfe490fc43cd947ed531
ARG SOURCE_DATE_EPOCH=1767225600

# ===============================
# 1. Dependencies layer
# ===============================
FROM ${NODE_IMAGE} AS deps

ARG SOURCE_DATE_EPOCH
ENV SOURCE_DATE_EPOCH=${SOURCE_DATE_EPOCH}
ENV TZ=UTC

# Install only required native dependencies
RUN apk add --no-cache \
    libc6-compat \
    && rm -rf /var/cache/apk/*

# Update npm to version 11
RUN npm install -g npm@11.10.0

WORKDIR /app

ARG APP_COMMIT_SHA
ENV APP_COMMIT_SHA=${APP_COMMIT_SHA}

COPY package.json package-lock.json ./

# Use npm ci (installs all deps for building)
# Note: npm cache clean --force is omitted here to speed up the build.
# The multi-stage build ensures the npm cache is not included in the final image.
# Next.js standalone output (used in builder stage) automatically tree-shakes dependencies,
# excluding devDependencies from the final production bundle in .next/standalone/node_modules.
RUN npm ci \
    --ignore-scripts \
    --no-audit \
    --no-fund \
    --prefer-offline

# ===============================
# 2. Build layer
# ===============================
FROM ${NODE_IMAGE} AS builder

ARG SOURCE_DATE_EPOCH
ARG APP_COMMIT_SHA
ARG SENTRY_ORG
ARG SENTRY_PROJECT
ARG NEXT_PUBLIC_SENTRY_DSN

ENV SOURCE_DATE_EPOCH=${SOURCE_DATE_EPOCH}
ENV APP_COMMIT_SHA=${APP_COMMIT_SHA}
ENV NEXT_PUBLIC_GIT_COMMIT_SHA=${APP_COMMIT_SHA}
ENV TZ=UTC
ENV NODE_ENV=production
ENV TURBOPACK=0
ENV SENTRY_ORG=${SENTRY_ORG}
ENV SENTRY_PROJECT=${SENTRY_PROJECT}
ENV NEXT_PUBLIC_SENTRY_DSN=${NEXT_PUBLIC_SENTRY_DSN}
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PRIVATE_BUILD_WORKER_COUNT=1

# Update npm to version 11
RUN npm install -g npm@11.10.0

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --link . .

# ---------------------------------------
# Public Next.js envs (compile-time)
# ---------------------------------------
ARG NEXT_PUBLIC_BACKEND_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_GITHUB_URL
ARG NEXT_PUBLIC_APP_NAME
ARG NEXT_PUBLIC_APP_VERSION
ARG NEXT_PUBLIC_APP_DOMAIN
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_SITEMAP_URL
ARG NEXT_PUBLIC_APP_EMAIL
ARG NEXT_PUBLIC_AUTHOR_NAME
ARG NEXT_PUBLIC_AUTHOR_URL
ARG NEXT_PUBLIC_LEGAL_EMAIL
ARG NEXT_PUBLIC_LEGAL_EFFECTIVE_DATE
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY
ARG NEXT_PUBLIC_GA_ID

ENV NEXT_PUBLIC_BACKEND_URL=${NEXT_PUBLIC_BACKEND_URL}
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
ENV NEXT_PUBLIC_GITHUB_URL=${NEXT_PUBLIC_GITHUB_URL}
ENV NEXT_PUBLIC_APP_NAME=${NEXT_PUBLIC_APP_NAME}
ENV NEXT_PUBLIC_APP_VERSION=${NEXT_PUBLIC_APP_VERSION}
ENV NEXT_PUBLIC_APP_DOMAIN=${NEXT_PUBLIC_APP_DOMAIN}
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV NEXT_PUBLIC_SITEMAP_URL=${NEXT_PUBLIC_SITEMAP_URL}
ENV NEXT_PUBLIC_APP_EMAIL=${NEXT_PUBLIC_APP_EMAIL}
ENV NEXT_PUBLIC_AUTHOR_NAME=${NEXT_PUBLIC_AUTHOR_NAME}
ENV NEXT_PUBLIC_AUTHOR_URL=${NEXT_PUBLIC_AUTHOR_URL}
ENV NEXT_PUBLIC_LEGAL_EMAIL=${NEXT_PUBLIC_LEGAL_EMAIL}
ENV NEXT_PUBLIC_LEGAL_EFFECTIVE_DATE=${NEXT_PUBLIC_LEGAL_EFFECTIVE_DATE}
ENV NEXT_PUBLIC_TURNSTILE_SITE_KEY=${NEXT_PUBLIC_TURNSTILE_SITE_KEY}
ENV NEXT_PUBLIC_GA_ID=${NEXT_PUBLIC_GA_ID}
ENV NEXT_PUBLIC_SUPABASE_API_URL=${NEXT_PUBLIC_SUPABASE_URL}/functions/v1
ENV SERWIST_SUPPRESS_TURBOPACK_WARNING=1

# Validate required build args
RUN set -e; \
  : "${APP_COMMIT_SHA:?APP_COMMIT_SHA is required}"; \
  : "${NEXT_PUBLIC_BACKEND_URL:?NEXT_PUBLIC_BACKEND_URL is required}"; \
  : "${NEXT_PUBLIC_SUPABASE_URL:?NEXT_PUBLIC_SUPABASE_URL is required}"; \
  : "${NEXT_PUBLIC_SUPABASE_ANON_KEY:?NEXT_PUBLIC_SUPABASE_ANON_KEY is required}"; \
  : "${NEXT_PUBLIC_APP_NAME:?NEXT_PUBLIC_APP_NAME is required}"; \
  : "${NEXT_PUBLIC_APP_VERSION:?NEXT_PUBLIC_APP_VERSION is required}"; \
  : "${NEXT_PUBLIC_APP_DOMAIN:?NEXT_PUBLIC_APP_DOMAIN is required}"; \
  : "${NEXT_PUBLIC_APP_URL:?NEXT_PUBLIC_APP_URL is required}"; \
  : "${NEXT_PUBLIC_SITEMAP_URL:?NEXT_PUBLIC_SITEMAP_URL is required}"; \
  : "${NEXT_PUBLIC_APP_EMAIL:?NEXT_PUBLIC_APP_EMAIL is required}"; \
  : "${NEXT_PUBLIC_AUTHOR_NAME:?NEXT_PUBLIC_AUTHOR_NAME is required}"; \
  : "${NEXT_PUBLIC_AUTHOR_URL:?NEXT_PUBLIC_AUTHOR_URL is required}"; \
  : "${NEXT_PUBLIC_LEGAL_EMAIL:?NEXT_PUBLIC_LEGAL_EMAIL is required}"; \
  : "${NEXT_PUBLIC_LEGAL_EFFECTIVE_DATE:?NEXT_PUBLIC_LEGAL_EFFECTIVE_DATE is required}"; \
  : "${NEXT_PUBLIC_TURNSTILE_SITE_KEY:?NEXT_PUBLIC_TURNSTILE_SITE_KEY is required}"; \
  : "${NEXT_PUBLIC_GA_ID:?NEXT_PUBLIC_GA_ID is required}";

# Build with minimal resources and clean cache
RUN --mount=type=secret,id=sentry_token \
    export SENTRY_AUTH_TOKEN=$(cat /run/secrets/sentry_token) && \
    npm run build && \
    rm -rf .next/cache

# Compile service worker with runtime caching
# @serwist/next doesn't generate SW with standalone mode, so we compile src/sw.ts manually using esbuild
# Note: Precaching is disabled (self.__SW_MANIFEST='[]') since we don't have a build-time manifest;
# runtime caching strategies (NetworkFirst, CacheFirst, StaleWhileRevalidate) can only serve previously cached resources offline (full offline support would require precaching or explicit caching logic)
RUN if [ ! -f "public/sw.js" ]; then \
      echo "Compiling service worker from src/sw.ts..."; \
      npx esbuild src/sw.ts \
        --bundle \
        --outfile=public/sw.js \
        --format=iife \
        --target=es2020 \
        --minify \
        --define:self.__SW_MANIFEST='[]' \
        --platform=browser \
        --log-level=warning && \
      echo "✓ Service worker compiled: $(du -h public/sw.js | cut -f1)"; \
    else \
      echo "✓ Service worker already exists"; \
    fi

# 2. Normalize timestamps
RUN find .next -exec touch -d "@${SOURCE_DATE_EPOCH}" {} +

# 3. Normalize absolute paths in standalone server
RUN sed -i 's|/app/|/|g' .next/standalone/server.js

# ===============================
# 3. Runtime layer
# ===============================
FROM ${NODE_IMAGE} AS runner

ARG SOURCE_DATE_EPOCH
ARG APP_COMMIT_SHA
ENV SOURCE_DATE_EPOCH=${SOURCE_DATE_EPOCH}
ENV APP_COMMIT_SHA=${APP_COMMIT_SHA}
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Build argument for customizable hostname binding
# Override at build time with: --build-arg NEXT_HOSTNAME=127.0.0.1 for localhost-only binding
ARG NEXT_HOSTNAME="0.0.0.0"

# NOTE: HOSTNAME controls the network interface binding (listen address), not the public URL hostname.
# When binding to 0.0.0.0, this container must be deployed behind a reverse proxy, firewall,
# or equivalent network control; direct external access to the container must be prevented.
# For the full security checklist and deployment patterns, see docs/SECURITY.md.
ENV HOSTNAME="${NEXT_HOSTNAME}"

WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    apk add --no-cache wget

# Core Next.js output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Copy public folder including the generated service worker
# The sw.js file is compiled by esbuild during Docker build (standalone mode workaround)
# as @serwist/next doesn't generate it with output: "standalone"
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Clean up
RUN rm -rf \
    /usr/share/man/* \
    /usr/share/doc/* \
    /var/cache/apk/* \
    /tmp/* \
    /root/.npm \
    /root/.cache

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:80/api/health || exit 1

CMD ["node", "server.js"]