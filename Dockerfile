FROM --platform=linux/amd64 node:18

WORKDIR /app
#COPY npm-shrinkwrap.json package.json ./

COPY . .
RUN npm shrinkwrap
RUN npm install
RUN npm install -g
RUN mkdir -p /applogs
#RUN wget https://github.com/stedolan/jq/releases/download/jq-1.6/jq-1.6.tar.gz && \
#    tar -xvf jq-1.6.tar.gz && \
#    cd jq-1.6 && \
#    autoreconf -fi && ./configure && make && make install

COPY ./check.sh /usr/local/bin/
RUN chmod -R 755 /usr/local/bin

HEALTHCHECK --start-period=5m --interval=5m --retries=3 --timeout=120s \
  CMD ["bash", "check.sh"]

ENTRYPOINT [ "/app/entrypoint.sh" ]
