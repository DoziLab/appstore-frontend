# ---------- Build Stage ----------
FROM node:20-alpine AS build

WORKDIR /app

# Abhängigkeiten (ohne Lockfile)
COPY package.json ./
RUN npm install

# Quellcode kopieren
COPY . .

# Vite Build
RUN npm run build


# ---------- Runtime Stage ----------
FROM nginx:alpine

# openssl für Zertifikat-Generierung
RUN apk add --no-cache openssl

# Default Config entfernen
RUN rm /etc/nginx/conf.d/default.conf

# Eigene nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Vite Output
COPY --from=build /app/build /usr/share/nginx/html

# Selbstsigniertes Zertifikat generieren
RUN mkdir -p /etc/nginx/certs && \
    openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
      -keyout /etc/nginx/certs/selfsigned.key \
      -out /etc/nginx/certs/selfsigned.crt \
      -subj "/CN=appstore"

EXPOSE 80 443
CMD ["nginx", "-g", "daemon off;"]

