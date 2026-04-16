FROM node:22-slim

# Install pnpm v10 (matches the version that generated pnpm-lock.yaml)
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

WORKDIR /app

# Copy workspace configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./

# Copy all workspace packages that api-server depends on
COPY lib/ lib/
COPY scripts/ scripts/

# Copy only the api-server artifact (not klaro-mobile or other web apps)
COPY artifacts/api-server/ artifacts/api-server/

# Create minimal package.json stubs for other artifact packages so pnpm
# doesn't complain about missing workspace members
RUN mkdir -p artifacts/klaro artifacts/klaro-mobile artifacts/mockup-sandbox && \
    echo '{"name":"@workspace/klaro","version":"0.0.0","private":true}' > artifacts/klaro/package.json && \
    echo '{"name":"@workspace/klaro-mobile","version":"0.0.0","private":true}' > artifacts/klaro-mobile/package.json && \
    echo '{"name":"@workspace/mockup-sandbox","version":"0.0.0","private":true}' > artifacts/mockup-sandbox/package.json

# Install dependencies — no frozen lockfile so pnpm v10 can reconcile freely
RUN pnpm install --no-frozen-lockfile

# Build the api-server (esbuild bundles everything into dist/index.mjs)
RUN pnpm --filter @workspace/api-server build

EXPOSE 3000

CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
