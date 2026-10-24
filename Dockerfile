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

# the commit this image was built from (CI passes it); telemetry reports it as service.version. Declared last
# because it changes every build, and everything after it is rebuilt.
ARG GIT_SHA=
ENV GIT_SHA=${GIT_SHA}

# same steps as `pnpm run deploy`, without package-manager processes idling beside the bot (~50 MB on a
# 1 GB droplet); exec makes node PID 1 so `docker stop` reaches bot.js's SIGTERM handler
CMD [ "sh", "-c", "node ./cache/cache.js && exec node bot.js" ]