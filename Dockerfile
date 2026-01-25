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

# Default Config entfernen
RUN rm /etc/nginx/conf.d/default.conf

# Eigene nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# ✅ Vite Output liegt bei euch in "build/"
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
