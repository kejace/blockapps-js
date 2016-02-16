module.exports.ethbase = {
    "Account" : require("./js/Account.js"),
    "Address" : require("./js/Address.js"),
    "Int"     : require("./js/Int.js"),
    "Storage" : require("./js/Storage.js"),
    "Transaction" : require("./js/Transaction.js"),
    "Units"   : require("./js/Units.js")
}
module.exports.routes = require("./js/Routes.js");
module.exports.query  = require("./js/HTTPQuery.js").defaults;
module.exports.polling = require("./js/routes/pollPromise.js").defaults;
module.exports.Solidity = require("./js/Solidity.js");
module.exports.MultiTX = require("./js/MultiTX.js");
module.exports.setProfile = require("./js/profiles.js");

module.exports.setProfile("strato-dev","https://strato-dev2.blockapps.net","1.0");
