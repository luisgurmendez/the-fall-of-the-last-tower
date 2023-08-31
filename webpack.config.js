const path = require("path");
/** Webpack plugins */
const HtmlWebpackPlugin = require("html-webpack-plugin");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const BundleAnalyzerPlugin =
  require("webpack-bundle-analyzer").BundleAnalyzerPlugin;

const TerserPlugin = require("terser-webpack-plugin");

const outputFolderName = "public";
module.exports = (env, argv) => {
  const isDevelopment = argv.mode === "development";

  return {
    entry: "./src/index.ts",
    /** Add `.ts` as a resolvable extension.
     * This will make import Name from "./Name"; work in typescript files
     */
    resolve: { extensions: [".ts", ".js"] },
    devtool: isDevelopment && "eval-cheap-module-source-map",
    devServer: {
      contentBase: path.resolve(__dirname, outputFolderName),
      index: "index.html", // Serve <outputFolderName>/index.html
      open: false, // Open a web browser on server start
      host: "localhost", // Set host to localhost
      port: 8081, // Run on port 8082
    },
    module: {
      rules: [
        /** Rules for ts files */
        {
          test: /\.ts$/,
          use: "ts-loader",
          exclude: /node_modules/,
        },
        {
          test: /\.(png|jpe?g|gif)$/i,
          use: [
            {
              loader: "file-loader",
            },
          ],
        },
      ],
    },
    output: {
      path: path.resolve(__dirname, outputFolderName),
      filename: "main.js",
    },
    plugins: [
      /** Empty the output folder folder */
      new CleanWebpackPlugin({
        dangerouslyAllowCleanPatternsOutsideProject: true,
      }),
      /** General index.html with script tags automatically from template */
      new HtmlWebpackPlugin({
        title: "Typescript - Siege",
        template: path.resolve(__dirname, "src", "index.html"),
        minify: !isDevelopment && {
          collapseWhitespace: true,
        },
      }),
      // new BundleAnalyzerPlugin(),
    ],
    /** Tree shaking */
    optimization: {
      usedExports: true,
      minimize: true,
      sideEffects: false,
      minimizer: !isDevelopment
        ? [
          new TerserPlugin({
            terserOptions: {
              mangle: {
                keep_fnames: false,
                keep_classnames: false,
                properties: true,
                module: true,
              },
              keep_fnames: false,
            },
          }),
        ]
        : [],
    },
  };
};
