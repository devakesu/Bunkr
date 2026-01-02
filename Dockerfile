# ===============================
# 0. Global deterministic settings
# ===============================
ARG NODE_IMAGE=node@sha256:bf77dc26e48ea95fca9d1aceb5acfa69d2e546b765ec2abfb502975f1a2d4def
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

ARG SOURCE_COMMIT
ENV SOURCE_COMMIT=${SOURCE_COMMIT}

COPY package.json package-lock.json ./

RUN npm ci \
  --ignore-scripts \
  --no-audit \
  --no-fund

# ===============================
# 2. Build layer
# ===============================
FROM ${NODE_IMAGE} AS builder

ARG SOURCE_DATE_EPOCH
ARG SOURCE_COMMIT

ENV SOURCE_DATE_EPOCH=${SOURCE_DATE_EPOCH}
ENV SOURCE_COMMIT=${SOURCE_COMMIT}
ENV NEXT_PUBLIC_GIT_COMMIT_SHA=${SOURCE_COMMIT}
ENV TZ=UTC
ENV NODE_ENV=production

# 🔒 Deterministic Next.js build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PRIVATE_BUILD_WORKER_COUNT=1

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --link . .

# Public Next.js envs (compile-time)
ARG NEXT_PUBLIC_BACKEND_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_GITHUB_URL

# Derived value MUST be constructed manually
ENV NEXT_PUBLIC_BACKEND_URL=${NEXT_PUBLIC_BACKEND_URL}
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
ENV NEXT_PUBLIC_GITHUB_URL=${NEXT_PUBLIC_GITHUB_URL}

# Derived env
ENV NEXT_PUBLIC_SUPABASE_API_URL=${NEXT_PUBLIC_SUPABASE_URL}/functions/v1

# ===============================
# 🔐 Validate required build args
# ===============================
RUN set -e; \
  : "${SOURCE_COMMIT:?SOURCE_COMMIT is required}"; \
  : "${NEXT_PUBLIC_BACKEND_URL:?NEXT_PUBLIC_BACKEND_URL is required}"; \
  : "${NEXT_PUBLIC_SUPABASE_URL:?NEXT_PUBLIC_SUPABASE_URL is required}"; \
  : "${NEXT_PUBLIC_SUPABASE_ANON_KEY:?NEXT_PUBLIC_SUPABASE_ANON_KEY is required}"; \
  : "${NEXT_PUBLIC_GITHUB_URL:?NEXT_PUBLIC_GITHUB_URL is required}"


# 1️⃣ Build
RUN npm run build

# 2️⃣ Normalize timestamps (MANDATORY)
RUN find .next -exec touch -d "@${SOURCE_DATE_EPOCH}" {} +

# 3️⃣ Normalize absolute paths in standalone server
RUN sed -i 's|/app/|/|g' .next/standalone/server.js

# ===============================
# 3. Runtime layer
# ===============================
FROM ${NODE_IMAGE} AS runner

ARG SOURCE_DATE_EPOCH
ARG SOURCE_COMMIT 

ENV SOURCE_COMMIT=${SOURCE_COMMIT}
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
