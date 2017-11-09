var path = require('path');

module.exports = {
    node: {
        dns: 'mock',
        net: 'mock'
    },
    entry: {
        decrypt: "./src/decrypt.js",
        ens: "./src/ens.js",
        keystore: "./src/keystore.js",
        order: "./src/order.js",
        privateKey: "./src/privateKey.js",
        relay: "./src/relay.js",
        signer: "./src/signer.js",
        validator: "./src/validator.js"
    },
    output: {
        path: path.join(__dirname, "dist"),
        filename: "[name].js"
    }
};