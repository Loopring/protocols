const UglifyJSPlugin = require('uglifyjs-webpack-plugin');

module.exports = {
    entry: "./src/loopring.js",
    output: {
        path: __dirname + "/dist",
        filename: "loopring.min.js"
    },
    plugins: [
        new UglifyJSPlugin({
            exclude: /\/node\_modules/,
            parallel: true,
            uglifyOptions: {
                beautify: false,
                ecma: 6,
                compress: true,
                comments: false
            }
        })
    ],
    externals: [
        "ajv",
        "bignumber.js",
        "lodash"
    ]
};