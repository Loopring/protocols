FROM mhart/alpine-node:8

RUN npm install -g ganache-cli@6.1.8

ADD ganache.sh ganache.sh

RUN chmod +x ganache.sh    

EXPOSE 8545

CMD sh ganache.sh
