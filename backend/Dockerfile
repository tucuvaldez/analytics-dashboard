FROM node:20-alpine

# Prisma's query engine needs openssl on Alpine
RUN apk add --no-cache openssl

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# "build" runs `prisma generate` and then compiles TypeScript
RUN npm run build

EXPOSE 5000
# Apply pending migrations, then start the API
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
