FROM node:24-bookworm-slim
WORKDIR /app
COPY . .
# Apply the reviewed email integration inside the image, before compiling assets.
RUN node integrar-brevo.mjs
# Tests run with external services disabled; the user never needs a local terminal.
RUN npm install --no-save --package-lock=false --ignore-scripts --omit=dev --no-audit --no-fund @aws-sdk/client-s3@3.1174.0 \
    && LEARNING_MEDIA_MODE=sqlite LEARNING_BACKUP_DIRECTORY= npm test \
    && LEARNING_BACKUP_DIRECTORY= node verify-enterprise-v27.mjs \
    && LEARNING_ALLOWED_HOSTS= node verify-security-v28.mjs \
    && mkdir -p /data
ENV NODE_ENV=production LEARNING_DB=/data/learning.sqlite
EXPOSE 8080
CMD ["node","serve.mjs"]
