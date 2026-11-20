FROM node:24-bookworm-slim
WORKDIR /app
COPY . .
RUN npm test && mkdir -p /data
ENV NODE_ENV=production LEARNING_DB=/data/learning.sqlite
EXPOSE 8080
CMD ["node","serve.mjs"]
