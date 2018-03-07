FROM mhart/alpine-node:9.7

RUN apk add --no-cache git curl make gcc g++ python linux-headers

RUN npm install -g truffle@4.0.1 typescript@2.4.2

ADD package.json package.json

ADD package-lock.json package-lock.json

RUN npm install

RUN apk del git curl make gcc g++ linux-headers

ADD . .

RUN npm run compile

CMD npm run testdocker