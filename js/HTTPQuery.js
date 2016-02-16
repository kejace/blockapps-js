var Promise = require("bluebird");
var request = Promise.promisify(require("request"), {multiArgs: true});
var errors = require("./errors.js");

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

    try {
        var paramsError = "query object must have exactly one field, " +
            "from amoqng get|post|data|postData";
        
        if (Object.keys(params).length != 1) {
            throw new Error(paramsError);
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
            throw new Error(paramsError);
        }
        options[optionsField] = params[method];
    }
    catch (e) {
        errors.pushTag("HTTPQuery")(e);
    }
    return request(options).
        catch(SyntaxError, function() {
            return []; // For JSON.parse
        }).
        spread(function(response, body) {
            return body;
        }).
        then(function(r) {
            var inval = "Invalid Arguments\n";
            var inter = "Internal Error:\n";
            if (r instanceof Object) {
                return r;
            }
            else if (typeof r === "string" && r.startsWith(inval))
            {
                var s = r.slice(inval.length);
                var e = JSON.parse(s);
                throw new Error(e.error);
            }
            else if (typeof r === "string" && r.startsWith(inter)) {
                r = r.slice(inter.length);
                throw new Error(r);
            }
            else {
                return r;
            //     throw new Error(r);
            }
        }).
        tagExcepts("HTTPQuery");
}
