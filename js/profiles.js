var ethValue = require("./Units.js").ethValue;
var polling = require("./routes/pollPromise.js").defaults;
var txParams = require("./Transaction.js").defaults;
var query = require("./HTTPQuery.js").defaults;
var multiTX = require("./MultiTX.js").defaults;

module.exports = setProfile;
function setProfile(profName, apiURL, version) {
    var profile = profiles[profName];

    query.serverURI = apiURL;
    if (typeof version === "string" && version.match(/^[0-9]+\.[0-9]+$/)) {
        query.apiPrefix = "/eth/v" + version;
    }

    polling.pollEveryMS = profile.pollEveryMS;
    polling.pollTimeoutMS = profile.pollTimeoutMS;

    txParams.gasPrice = profile.gasPrice;
    txParams.gasLimit = profile.gasLimit;

    multiTX.address = profile.multiTXaddr;
}

var profiles = {
    "strato-dev" :
    {
        "pollEveryMS" : 500,
        "pollTimeoutMS" : 10000,
        "gasPrice" : ethValue(1).in("wei"),
        "gasLimit" : 3141592,
        "multiTXaddr" : "8a53483de69960d69fdbf98dfcb6af368a8b4abf"
    },
    "ethereum-frontier":
    {
        "pollEveryMS" : 1000,
        "pollTimeoutMS" : 30000,
        "gasPrice" : ethValue(1).in("szabo"),
        "gasLimit" : 1e6
    }
};
module.exports.profiles = profiles;
