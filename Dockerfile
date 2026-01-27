# ===============================
# 0. Global deterministic settings
# ===============================
ARG NODE_IMAGE=node:20-alpine
ARG SOURCE_DATE_EPOCH=1767225600

# ===============================
# 1. Dependencies layer
# ===============================
FROM ${NODE_IMAGE} AS deps

ARG SOURCE_DATE_EPOCH
ENV SOURCE_DATE_EPOCH=${SOURCE_DATE_EPOCH}
ENV TZ=UTC

RUN apk add --no-cache libc6-compat

WORKDIR /app

ARG APP_COMMIT_SHA
ENV APP_COMMIT_SHA=${APP_COMMIT_SHA}

COPY package.json package-lock.json ./

RUN npm install -g npm@latest && \
    npm ci \
    --ignore-scripts \
    --no-audit \
    --no-fund

# ===============================
# 2. Build layer
# ===============================
FROM ${NODE_IMAGE} AS builder
RUN npm install -g npm@latest

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
ENV SENTRY_ORG=${SENTRY_ORG}
ENV SENTRY_PROJECT=${SENTRY_PROJECT}
ENV NEXT_PUBLIC_SENTRY_DSN=${NEXT_PUBLIC_SENTRY_DSN}
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PRIVATE_BUILD_WORKER_COUNT=1

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

# ---------------------------------------
# Set environment variables
# ---------------------------------------
ENV NEXT_PUBLIC_BACKEND_URL=${NEXT_PUBLIC_BACKEND_URL}
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
ENV NEXT_PUBLIC_GITHUB_URL=${NEXT_PUBLIC_GITHUB_URL}
ENV NEXT_PUBLIC_APP_NAME=${NEXT_PUBLIC_APP_NAME}
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

# Derived env (constructed from SUPABASE_URL)
ENV NEXT_PUBLIC_SUPABASE_API_URL=${NEXT_PUBLIC_SUPABASE_URL}/functions/v1

# ===============================
# 🔐 Validate required build args
# ===============================
RUN set -e; \
  : "${APP_COMMIT_SHA:?APP_COMMIT_SHA is required}"; \
  : "${NEXT_PUBLIC_SENTRY_DSN:?NEXT_PUBLIC_SENTRY_DSN is required}"; \
  : "${SENTRY_ORG:?SENTRY_ORG is required}"; \
  : "${SENTRY_PROJECT:?SENTRY_PROJECT is required}"; \
  : "${NEXT_PUBLIC_BACKEND_URL:?NEXT_PUBLIC_BACKEND_URL is required}"; \
  : "${NEXT_PUBLIC_SUPABASE_URL:?NEXT_PUBLIC_SUPABASE_URL is required}"; \
  : "${NEXT_PUBLIC_SUPABASE_ANON_KEY:?NEXT_PUBLIC_SUPABASE_ANON_KEY is required}"; \
  : "${NEXT_PUBLIC_GITHUB_URL:?NEXT_PUBLIC_GITHUB_URL is required}"; \
  : "${NEXT_PUBLIC_APP_NAME:?NEXT_PUBLIC_APP_NAME is required}"; \
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


# 1️⃣ Build
RUN --mount=type=secret,id=sentry_token \
    export SENTRY_AUTH_TOKEN=$(cat /run/secrets/sentry_token) && \
    npm run build

# 2️⃣ Normalize timestamps (MANDATORY)
RUN find .next -exec touch -d "@${SOURCE_DATE_EPOCH}" {} +

# 3️⃣ Normalize absolute paths in standalone server
RUN sed -i 's|/app/|/|g' .next/standalone/server.js

# ===============================
# 3. Runtime layer
# ===============================
FROM ${NODE_IMAGE} AS runner

ARG SOURCE_DATE_EPOCH
ARG APP_COMMIT_SHA 

ENV APP_COMMIT_SHA=${APP_COMMIT_SHA}
ENV SOURCE_DATE_EPOCH=${SOURCE_DATE_EPOCH}
ENV TZ=UTC
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

WORKDIR /app

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# ensure clean state
RUN rm -rf .next

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]