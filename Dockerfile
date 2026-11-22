FROM node:22-bookworm-slim
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod --ignore-scripts
COPY --chown=node:node api ./api
COPY --chown=node:node db ./db
COPY --chown=node:node p2 ./p2
COPY --chown=node:node conteudo-portal ./conteudo-portal
# /app/media: fotos enviadas pelo painel (volume na VPS, entra no backup diário).
RUN mkdir -p /app/.runtime /app/backups /app/media && chown node:node /app/.runtime /app/backups /app/media
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4183 MEDIA_DIR=/app/media
USER node
EXPOSE 4183
CMD ["node", "api/server.mjs"]
