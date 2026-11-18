# API サーバーとマイグレーションのイメージ。リポジトリのルートを文脈にしてビルドする（CDK もそうする）。
#   docker build -f apps/server/Dockerfile .
FROM node:22-alpine AS build
WORKDIR /repository
RUN npm install --global pnpm@12.21.0
COPY . .
RUN pnpm install --frozen-lockfile --filter @app/server...
RUN pnpm --filter @app/server build

FROM node:22-alpine
WORKDIR /app
# RDS の証明書。DB のサーバーを確かめる TLS で接続するために使う（DATABASE_CERTIFICATE_FILE）。
ADD https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem /app/rds-certificate.pem
COPY --from=build /repository/apps/server/dist ./
RUN chmod 644 /app/rds-certificate.pem
ENV NODE_ENV=production PORT=3000
USER node
EXPOSE 3000
CMD ["node", "server.mjs"]
