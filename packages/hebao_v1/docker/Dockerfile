FROM mhart/alpine-node:10.15.3

RUN mkdir -p /usr/local/loopring3
WORKDIR /usr/local/loopring3

RUN mkdir testdata

RUN npm install -g ganache-cli@6.9.0 --registry=http://registry.npm.taobao.org

ADD docker_ganache.sh docker_ganache.sh
ADD docker_ganache_blocktime.sh docker_ganache_blocktime.sh

RUN chmod +x docker_ganache.sh
RUN chmod +x docker_ganache_blocktime.sh

EXPOSE 8545

CMD sh docker_ganache_blocktime.sh
