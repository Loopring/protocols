# Loopring Protocol Javascript Library

## Compile


If you are using Windows:
```
npm install --global --production windows-build-tools
```

Then run the following commands from project's root directory:
 
```
npm install -g webpack
npm install -g mocha
npm install -g typescript
npm install
```

Build commonjs library
```
npm run build:commonjs
```

Build UMD library
```
npm run build:umd
```

## Test

```
npm run test
```