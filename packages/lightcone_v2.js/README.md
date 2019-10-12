# Javascript library for Lightcone 2.0

## Node version: 10.x

- `npm install` to install dependencies
- `npm run build:proto` to generate models from protobuffer
- `npm run build` to build the project
- `npm run test` to run tests

## Steps to run unit tests

- Launch a local Eth node

```
docker run -p 8545:8545 kongliangzhong/contracts-beta2:0.2
```

- Run tests

```
npm install
npm run build
npm run test
```

## How to publish the library to github npm registry

Follow [this instruction](https://help.github.com/en/articles/configuring-npm-for-use-with-github-package-registry#authenticating-to-github-package-registry) to set up your access token ,and log into github npm registry using `npm login --registry=https://npm.pkg.github.com/`.

Then you can run `npm publish`.

The published packages can be found here - https://github.com/loopring/protocols/packages

## Entrypoint of library

`src/index.ts`

## How to build a Docker?

```
docker build -t lightcone-v2-js -f Dockerfile .
```

## How to run tests in Docker?

```
docker run --rm lightcone-v2-js sh -c 'npm run test'
```
