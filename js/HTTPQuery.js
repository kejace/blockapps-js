var Promise = require("bluebird");
var request = Promise.promisify(require("request"));
var errors = require("./errors.js");

module.exports = HTTPQuery;

var defaults = {};

module.exports.defaults = defaults;

function HTTPQuery(queryPath, params) {
    function prepare() {
        var options = {
            "uri":defaults.serverURI + defaults.apiPrefix + queryPath,
            "json" : true,
            rejectUnauthorized: false,
            requestCert: true,
            agent: false
        };

        var paramsError = tagError(
            "HTTPQuery",
            "query object must have exactly one field, " +
                "from among get|post|data|postData"
        );
        
        if (Object.keys(params).length != 1) {
            throw paramsError;
        }
        var method = Object.keys(params)[0];
        var optionsField;
        var paramsField;
        switch (method) {
        case "get":
            options.method = "GET";
            optionsField = "qs";
            break;
        case "post":
            options.method = "POST";
            optionsField = "form";
            break;
        case "data":
            options.method = "POST";
            optionsField = "body";
            break;
        case "postData":
            options.method = "POST";
            optionsField = "formData";
            break;
        default:
            throw paramsError;
        }
        options[optionsField] = params[method];
        return options;
    }
        
    return Promise.try(prepare).
        then(request).
        catch(SyntaxError, function() {
            return []; // For JSON.parse
        }).
        spread(function(response, body) {
            return body;
        }).
        tagExcepts("HTTPQuery");
}
