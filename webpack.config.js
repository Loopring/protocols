const UglifyJSPlugin = require('uglifyjs-webpack-plugin');

module.exports = {
    entry: "./src/loopring.js",
    resolve: {
        modules: ['bower_components', 'node_modules']
    },
    output: {
        path: __dirname + "/dist",
        library: "loopring",
        libraryTarget: "umd",
        filename: "loopring.min.js"
    },
    plugins: [
        new UglifyJSPlugin({
            exclude: /\/node\_modules/,
            parallel: true,
            uglifyOptions: {
                beautify: false,
                ecma: 5,
                compress: true,
                comments: false
            }
        })
    ],
    externals: [
        "async",
        "bignumber.js",
        "lodash",
        "axios"
    ]
};
