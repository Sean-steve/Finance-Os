# Separate authenticated staging SPA, no prototype bundles, repo or private env.
FROM nginx:stable-alpine
RUN rm -f /etc/nginx/conf.d/default.conf
COPY connected.html /usr/share/nginx/html/connected.html
COPY rebuild/connected.css /usr/share/nginx/html/rebuild/connected.css
COPY rebuild/connected.js /usr/share/nginx/html/rebuild/connected.js
COPY backend/deploy/staging.nginx.conf.template /etc/nginx/templates/default.conf.template
EXPOSE 8080
