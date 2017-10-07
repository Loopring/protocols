const path = require('path');

  module.exports = {
    entry: './src/index.ts',
    devtool: 'inline-source-map',
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/
        },
        {
            test: /\.json$/,
            loader: 'json-loader',
        }
      ]
    },
    resolve: {
      extensions: [ ".json", ".ts", ".js" ]
    },
    output: {
      filename: 'loopring.js',
      path: path.resolve(__dirname, 'dist'),
      libraryTarget: 'umd',
      library: 'loopring',
      umdNamedDefine: true,
    }
  };
  