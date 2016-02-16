var Promise = require("bluebird");

function isString(x) {
    return (typeof x === "string");
}

function prefixMessage(p, m) {
    return p + ": " + m;
}

function throwMessage(m) {
    throw new Error(m);
}

function internalError(m) {
    throwMessage(prefixMessage("INTERNAL ERROR", m));
}

function matchTag(tag) {
    if (!isString(tag)) {
        internalError(
            "error tag must be a string, not a '" + tag.constructor.name + "'"
        );
    }
    return function(e) {
        return (typeof e === "object") && ("errorTags" in e) &&
            (e.errorTags.lastIndexOf(tag) !== -1);
    };
}

function noMatchTag(tag) {
    var f = matchTag(tag);
    return function(e) { return !f(e); };
}

function tagError(tag, msg) {
    if (!isString(tag)) {
        internalError(
            "error tag must be a string, not a '" + tag.constructor.name + "'"
        );
    }
    if (!isString(msg)) {
        internalError(
            "error message must be a string, not a " +
                "'" + prefix.constructor.name + "'"
        );
    }
    return {
        errorTags: [tag],
        message: msg,
        toString: function() {
            var result = this.message;
            this.errorTags.forEach(function(t) {
                result = prefixMessage(t, result);
            });
            return result;
        }
    };
}

function pushTag(tag, prefix) {
    return function(error) {
        var result = tagError(tag, "");

        if (error.errorTags instanceof Array && error.errorTags.length > 0) {
            result.errorTags = error.errorTags.map(function(x){return x;});
            result.errorTags.push(tag);
        }

        if (isString(prefix)) {
            result.message = prefixMessage(prefix, error.message);
        }
        else if (prefix) {
            internalError(
                "error message prefix must be a string, not a " +
                    "'" + prefix.constructor.name + "'"
            );
        }
        else {
            result.message = error.message;
        }
        
        throw result;
    }
}

Promise.prototype.tagExcepts = function(tag) {
    return this.catch(noMatchTag(tag), pushTag(tag));
}

module.exports = {
    tagError: tagError,
    matchTag: matchTag,
    noMatchTag: noMatchTag,
    pushTag: pushTag,
    internalError: internalError,
    isString: isString
};
