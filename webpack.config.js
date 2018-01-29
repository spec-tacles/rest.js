const path = require('path');
const UglifyJsPlugin = require('uglifyjs-webpack-plugin');
const CompressionPlugin = require('compression-webpack-plugin');

const config = {
  entry: './src/index.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'rest.js',
  },
  module: {
    rules: [{
      test: /\.ts$/,
      use: [{
        loader: 'ts-loader',
        options: {
          compilerOptions: { declaration: false },
        },
      }],
    }],
  },
  resolve: {
    extensions: ['.js', '.json', '.ts'],
  },
  plugins: [],
};

if (process.env.NODE_ENV === 'production') {
  config.output.filename = 'rest.min.js';
  config.plugins.push(
    new UglifyJsPlugin(),
    new CompressionPlugin(),
  );
}

module.exports = config;
