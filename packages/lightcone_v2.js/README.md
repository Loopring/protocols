# Javascript library for Lightcone 2.0

* `npm install` to install dependencies
* `npm run build:proto` to generate models from protobuffer
* `npm run build` to build the project
* `npm run test` to run tests

# Entrypoint of library
`src/index.ts`

# How to build a Docker?
```
docker build -t lightcone-v2-js -f Dockerfile .
```

# How to run tests in Docker?
```
docker run --rm lightcone-v2-js sh -c 'npm run test'
```
