var Promise = require("bluebird");
var request = Promise.promisify(require("request"));

module.exports = HTTPQuery;

var defaults = {};

module.exports.defaults = defaults;

function HTTPQuery(queryPath, params) {
    var options = {
        "uri":defaults.serverURI + defaults.apiPrefix + queryPath,
        "json" : true,
        rejectUnauthorized: false,
        requestCert: true,
        agent: false
    };
    if (Object.keys(params).length != 1) {
        throw new Error(
            "HTTPQuery(_, params): params must have exactly one field, " +
                "the method get|post|data"
        );
    }
    var method = Object.keys(params)[0];
    switch (method) {
    case "get":
        options.method = "GET";
        options.qs = params.get;
        break;
    case "post":
        options.method = "POST";
        options.form = params.post;
        break;
    case "data":
        options.method = "POST";
        options.body = params.data;
        break;
    default:
        throw new Error(
            "HTTPQuery(_, params): params must be of the form " +
                "{get|post|data: {<name>: <value>, ..} }"
        );
    }

    return request(options).
        catch(SyntaxError, function() {
            return []; // For JSON.parse
        }).
        catch(function (e) {
            throw new Error(
                "HTTPRequest failed:\n" + e
            );
        }).
        spread(function(response, body) {
            return body;
        });
}
