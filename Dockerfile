FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npx tsc
CMD ["node", "dist/server/index.js"]
EXPOSE 3000
