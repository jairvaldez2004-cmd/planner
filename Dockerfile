# Build determinista para Railway (evita el builder Nixpacks y su montaje de caché runc/overlayfs).
FROM node:22-bookworm-slim AS runner

# Prisma necesita openssl en imágenes slim.
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Dependencias primero (mejor caché). postinstall corre `prisma generate`, por eso
# copiamos el schema antes de `npm ci`. --include=dev garantiza typescript/@types para el build.
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --include=dev

# Código y build de producción.
COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

# start:prod = prisma db push (sincroniza el schema en la BD de Railway) + next start.
# Next escucha en $PORT (lo inyecta Railway).
CMD ["npm", "run", "start:prod"]
