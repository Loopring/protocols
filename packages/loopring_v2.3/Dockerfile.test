FROM mhart/alpine-node:8

RUN apk add --no-cache git curl make gcc g++ python linux-headers

ADD package.json package.json

ADD package-lock.json package-lock.json

RUN npm install

RUN apk del git curl make gcc g++ linux-headers

ADD . .

RUN npm run compile

CMD npm run testdocker
