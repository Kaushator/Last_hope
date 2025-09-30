FROM node:20-alpine
WORKDIR /app
COPY apps/frontend/package.json /app/
RUN npm i --no-audit --no-fund || true
COPY apps/frontend /app
EXPOSE 3000
CMD ["npm","run","dev"]
