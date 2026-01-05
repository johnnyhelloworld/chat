FROM node:18-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

# Generate Prisma Client explicitly for the targets defined in schema.prisma
RUN npx prisma generate

COPY . .

EXPOSE 3002

CMD ["npm", "run", "start:dev"]