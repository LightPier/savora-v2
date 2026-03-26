FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx tsc
RUN npm prune --omit=dev
CMD ["node", "dist/server/index.js"]
EXPOSE 3000
