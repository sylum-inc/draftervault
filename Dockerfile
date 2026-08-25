# syntax=docker/dockerfile:1

# ---- build ----------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

# Husky's prepare script has no git repo to install hooks into inside the image
ENV HUSKY=0

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Build-time configuration. Vite bakes VITE_* values into the bundle, so anything
# passed here ends up readable in the shipped JavaScript — public values only.
ARG VITE_APP_ENV=production
ARG VITE_APP_URL
ARG VITE_ROUTER
ENV VITE_APP_ENV=$VITE_APP_ENV VITE_APP_URL=$VITE_APP_URL VITE_ROUTER=$VITE_ROUTER

RUN npm run build

# ---- runtime --------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -q --spider http://127.0.0.1/ || exit 1
