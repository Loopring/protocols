#!/usr/bin/env bash

browserify -g uglifyify -t uglifyify -r ./src/ens.js:ens > ./dist/ens.js
browserify -g uglifyify -t uglifyify -r ./src/hex-utils.js:hex-utils > ./dist/hex-utils.js
browserify -g uglifyify -t uglifyify -r ./src/keystore.js:keystore > ./dist/keystore.js
browserify -g uglifyify -t uglifyify -r ./src/wallet.js:wallet > ./dist/wallet.js
browserify -g uglifyify -t uglifyify -r ./src/validator.js:validator > ./dist/validator.js
browserify -g uglifyify -t uglifyify -r ./src/order.js:order > ./dist/order.js
browserify -g uglifyify -t uglifyify -r ./src/signer.js:signer > ./dist/signer.js
browserify -g uglifyify -t uglifyify -r ./src/decrypt.js:decrypt > ./dist/decrypt.js
browserify -g uglifyify -t uglifyify -r ethereumjs-util -r ./src/relay.js:relay > ./dist/relay.js
browserify -g uglifyify -t uglifyify -r ./src/loopring.js > ./dist/loopring.js

browserify -g uglifyify -t uglifyify -r ./src/ens.js:ens -r ./src/hex-utils.js:hex-utils -r ./src/keystore.js:keystore -r ./src/wallet.js:wallet -r ./src/validator.js:validator -r ./src/order.js:order -r ./src/signer.js:signer -r ./src/decrypt.js:decrypt -r ethereumjs-util -r ./src/relay.js:relay > ./dist/loopring.min.js
