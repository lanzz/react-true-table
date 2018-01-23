var path = require('path');
var ExtractTextPlugin = require('extract-text-webpack-plugin');


function resolve(relativePath) {
    return path.resolve(__dirname, relativePath);
}


module.exports = {
    entry: {
        'react-true-table': './src/table.jsx',
    },
    resolve: {
        extensions: ['.js', '.jsx', '.json', '.scss'],
        modules: ['src', 'node_modules']
    },
    output: {
        path: resolve('dist'),
        filename: '[name].js',
        library: 'ReactTrueTable',
        libraryTarget: 'umd',
        umdNamedDefine: false
    },
    module: {
        loaders: [
            {
                test: /\.jsx?$/,
                include: resolve('src'),
                use: 'babel-loader'
            },
            {
                test: /\.scss$/,
                include: resolve('src'),
                loader: ExtractTextPlugin.extract({
                    fallback: 'style-loader',
                    use: [
                        {
                            loader: 'css-loader',
                            options: {
                                modules: true,
                                localIdentName: '[name]__[local]__[hash:base64:5]'
                            }
                        },
                        'sass-loader'
                    ]
                })
            }
        ]
    }
};
