FROM node:24-alpine
WORKDIR /opt/bot

ENV FORCE_COLOR=1

## Install Dep
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# install the exact pnpm pinned in package.json's packageManager field
RUN npm install -g --allow-scripts=pnpm "$(node -p "require('./package.json').packageManager")"
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm exec prisma generate
RUN pnpm run compile
RUN pnpm run smoke
CMD [ "pnpm", "run", "deploy" ]