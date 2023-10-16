FROM node:lts-bullseye-slim
RUN apt-get update && apt-get install -y openssl libssl-dev
WORKDIR /opt/bot
## Install Dep
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
RUN npm run compile
CMD [ "npm", "run", "deploy" ]