FROM --platform=linux/amd64 node:10

WORKDIR /app
COPY npm-shrinkwrap.json package.json ./
RUN npm install

COPY . .
ENTRYPOINT [ "/app/entrypoint.sh" ]
