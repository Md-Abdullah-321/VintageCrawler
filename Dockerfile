FROM node:22.20.0
WORKDIR /app

COPY package*.json ./
RUN npm install --build-from-source  # rebuild native modules

COPY . .
EXPOSE 8000
CMD ["node", "dist/index.js"]
