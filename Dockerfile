FROM node:24-bookworm-slim
WORKDIR /app
COPY platform.mjs storage.mjs serve.mjs JSZip-LICENSE.md ./
ENV NODE_ENV=production LEARNING_DB=/data/learning.sqlite
RUN mkdir -p /data
CMD ["node","serve.mjs"]
