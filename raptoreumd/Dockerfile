FROM --platform=linux/amd64 ubuntu:20.04

RUN apt-get update && apt-get install -y --no-install-recommends \
  wget ca-certificates \
  && apt-get clean

RUN mkdir /ghjk && cd /ghjk \
  && wget https://github.com/Raptor3um/raptoreum/releases/download/1.2.15.3/raptoreum_1.2.15.3_ubuntu20_64.tar.gz \
  && tar -xvof raptoreum_1.2.15.3_ubuntu20_64.tar.gz \
  && mv raptoreumd /usr/local/bin \
  && mv raptoreum-cli /usr/local/bin \
  && rm -rf /ghjk

WORKDIR /app

COPY app .
ENTRYPOINT [ "/app/entrypoint.sh" ]
