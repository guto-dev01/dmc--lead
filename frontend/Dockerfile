FROM node:20-alpine AS builder
WORKDIR /app
# A URL do backend é "assada" no build do Next (variável NEXT_PUBLIC_*)
ARG NEXT_PUBLIC_API_URL=http://localhost:8001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY package.json .
RUN npm install
COPY . .
RUN mkdir -p public
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Next standalone escuta em $PORT (injetado pela plataforma) e precisa do
# HOSTNAME 0.0.0.0 para aceitar conexões externas no Railway/Render/Docker.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
