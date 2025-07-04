module.exports = {
    moduleDirectories: [
        "src",
        "node_modules"
    ],
    moduleNameMapper: {
        'source-map-support/register': 'identity-obj-proxy'
    },
    testMatch: ["**/?(*.)(spec|test).js?(x)"],
    transform: {
        "^.+\\.jsx?$": "babel-jest"
    }
};
