FROM node:24-alpine
WORKDIR /opt/bot

ENV FORCE_COLOR=1

## Install Dep
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
RUN npm run compile
RUN npm run smoke
CMD [ "npm", "run", "deploy" ]