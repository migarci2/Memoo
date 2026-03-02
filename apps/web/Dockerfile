FROM node:22-alpine

WORKDIR /app

# Copy only manifests so npm install is a cached layer.
# The source code is volume-mounted at runtime.
COPY package.json package-lock.json* ./

RUN npm install

# node_modules stays inside the image (anonymous volume in compose
# shadows the host path so the container's modules are used).
# WATCHPACK_POLLING lets Next.js detect file changes inside Docker
# via polling instead of inotify (more reliable on Linux bind-mounts).
ENV WATCHPACK_POLLING=true
ENV CHOKIDAR_USEPOLLING=true
ENV NEXT_TELEMETRY_DISABLED=1

CMD ["npx", "next", "dev", "-H", "0.0.0.0", "--no-turbopack"]
