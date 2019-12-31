FROM mhart/alpine-node:10.15.3

RUN mkdir -p /usr/local/loopring3
WORKDIR /usr/local/loopring3

RUN mkdir testdata

RUN npm install -g ganache-cli@6.4.3

ADD docker_ganache.sh docker_ganache.sh

RUN chmod +x docker_ganache.sh

EXPOSE 8545

CMD sh docker_ganache.sh
