# syntax = docker/dockerfile:1

# Adjust NODE_VERSION as desired
ARG NODE_VERSION=24
FROM node:${NODE_VERSION}-slim AS base

LABEL fly_launch_runtime="Node.js"

# Node.js app lives here
WORKDIR /app

# Set production environment
ENV NODE_ENV="production"

# Throw-away build stage to reduce size of final image
FROM base AS build

# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3 jq

# Install node modules
COPY .npmrc package.json ./
RUN npm --version
# Remove the dev version of the dependencies for '@register-dynamics/importer'
RUN jq 'del(.dependencies["@register-dynamics/importer"])' package.json > /tmp/package.json
RUN mv /tmp/package.json .

# Explicitly load the latest version
RUN npm install --save "https://gitpkg.vercel.app/register-dynamics/data-import/lib/importer?main"
RUN npm install

# Copy application code
COPY . .


# Final stage for app image
FROM base

# Copy built application
COPY --from=build /app /app

# Start the server by default, this can be overwritten at runtime
EXPOSE 3000
CMD [ "npm", "run", "start" ]
