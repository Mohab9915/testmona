FROM node:22-alpine AS build

WORKDIR /app

ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=${VITE_API_URL}

COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY . .

# V8 caps its own heap (~512MB by default on a 1GB host) and aborts on reaching
# it rather than growing into swap - so adding swap alone does not rescue this
# build on a small VM. Raise the ceiling so the allocation can spill to swap.
# Overridable at build time: --build-arg NODE_HEAP_MB=4096 on a larger machine.
ARG NODE_HEAP_MB=2048
ENV NODE_OPTIONS=--max-old-space-size=${NODE_HEAP_MB}
RUN npm run build

FROM nginx:1.27-alpine

RUN apk add --no-cache curl

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD curl --fail --silent --show-error --max-time 5 http://localhost:3000/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
