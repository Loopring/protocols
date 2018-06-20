# Loopring Protocol Javascript Library

**Development ongoing**

## Environment

You need to install [npm](https://www.npmjs.com/get-npm), [yarn](https://yarnpkg.com/lang/en/docs/cli/install/),[babel](https://babeljs.io/docs/en/index.html) and [webpack](https://github.com/webpack/webpack).

## Compile

Then run the following commands from project's root directory:

```
yarn install 
```

To build the dist directory and lib directory from the src director run the following:

```
npm run build
```

## Installation

```javascript
npm install loopring.js --save
```

## Browser Usage

loopring.js ships as both a [UMD](https://github.com/umdjs/umd) module and a [CommonJS](https://en.wikipedia.org/wiki/CommonJS) package.

##### UMD Package

Include the following script tags in your HTML:

```javascript
<script src="../node_modules/loopring/dist/loopring.min.js"></script>
```

To use the library in your JavaSrcipt code, get each component like so:

```javascript
window.loopring.common
window.loopring.ethereum
window.loopring.relay
```

##### CommonJS  Package

```javascript
import loopring from 'loopring.js';
or
import {relay} from 'loopring.js';
or
const loopring = require('loopring.js');
```

babel-polyfill is also required

####  [中文开发者文档](https://github.com/Loopring/loopring.js/wiki/loopring.js-v2.0.0-%E4%B8%AD%E6%96%87%E5%BC%80%E5%8F%91%E8%80%85%E6%96%87%E6%A1%A3). 

####  [English Documentation](https://github.com/Loopring/loopring.js/wiki/loopring.js-v2.0.0-English-Developer%E2%80%99s-Documentation)

## Developers

Before commit your changes or submit a pull request, please lint your code by running:

```
npm run lint
npm run build
```
