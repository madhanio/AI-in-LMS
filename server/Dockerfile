FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache \
    build-base \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    python3 \
    py3-pip

COPY package.json package-lock.json requirements.txt ./

RUN npm ci

COPY . .

EXPOSE 3000

CMD ["node", "index.js"]
