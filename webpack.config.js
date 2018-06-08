/*

  Copyright 2017 Loopring Project Ltd (Loopring Foundation).

  Licensed under the Apache License, Version 2.0 (the 'License');
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an 'AS IS' BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.

*/

const UglifyJSPlugin = require('uglifyjs-webpack-plugin');
const Path = require('path');

module.exports = {
    entry: ['babel-polyfill', './src/index.js'],
    mode: 'production',
    resolve: {
        modules: [
            'bower_components',
            'node_modules'
        ]
    },
    devtool: 'source-map',
    module: {
        rules: [
            { test: /\.js$/,
                exclude: /node_modules/,
                use: {loader: 'babel-loader',
                    options: {presets: ['env'],
                        plugins: ['babel-plugin-transform-object-rest-spread', 'babel-plugin-transform-es2015-spread']}
                }
            }
        ]
    },
    output: {
        path: Path.join(__dirname, '/dist'),
        library: 'loopring',
        libraryTarget: 'umd',
        filename: 'loopring.min.js'
    },
    plugins: [
        new UglifyJSPlugin({
            exclude: /\/node_modules/,
            parallel: true,
            sourceMap: true,
            uglifyOptions: {
                beautify: false,
                ecma: 6,
                compress: true,
                comments: false
            }
        })
    ]
};
