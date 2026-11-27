FROM node:24-bookworm-slim
WORKDIR /app
COPY . .
RUN node pipeline-v39-1.mjs && node people-analytics-v40.mjs --install && node topbar-v40-1.mjs --install
RUN npm install --no-save --package-lock=false --ignore-scripts --omit=dev --no-audit --no-fund @aws-sdk/client-s3@3.1174.0 \
    && LEARNING_MEDIA_MODE=sqlite LEARNING_BACKUP_DIRECTORY= npm test \
    && LEARNING_BACKUP_DIRECTORY= node verify-enterprise-v27.mjs \
    && LEARNING_ALLOWED_HOSTS= node verify-security-v28.mjs \
    && node --test verify-notificacoes-v31.mjs \
    && node --test verify-email-convite-v32.mjs \
    && node --test verify-email-notificacoes-v33.mjs \
    && node --test verify-notificacoes-v34.mjs \
    && node --test verify-notificacoes-v35.mjs \
    && node --test verify-intranet-v36.mjs \
    && node --test verify-email-v37.mjs \
    && node --test verify-usabilidade-v38.mjs \
    && node --test verify-refinamento-v39.mjs \
    && node --test verify-estabilidade-v39-1.mjs \
    && node --test verify-people-analytics-v40.mjs \
    && node --test verify-topbar-v40-1.mjs \
    && mkdir -p /data
ENV NODE_ENV=production LEARNING_DB=/data/learning.sqlite
EXPOSE 8080
CMD ["node","serve.mjs"]
