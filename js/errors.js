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
        return ("errorTags" in e) && (tag in e.errorTags);
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
        toString: throwMessage(prefixMessage(errorTags[0], message))
    };
}

function pushTag(tag, prefix) {
    return function(error) {
        var result = {};

        if (error.errorTags instanceof Array && error.errorTags.length > 0) {
            result.errorTags = error.errorTags;
            result.errorTags.push(tag);
        }
        else {
            result.errorTags = [tag];
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

function addTag(tag, prefix) {
    return [
        noMatchTag(tag),
        pushTag.bind(null, tag, prefix)
    ];
}

function changeTag(tag1, tag2) {
    return [
        matchTag(tag1),
        noMatchTag(tag2),
        pushTag.bind(null, tag)
    ];
}

Promise.prototype.tagExcepts = function(tag) {
    return this.catch.apply(this, addTag(tag));
}

module.exports = {
    tagError: tagError,
    matchTag: matchTag,
    noMatchTag: noMatchTag,
    changeTag: changeTag,
    pushTag: pushTag,
    addTag: addTag,
    internalError: internalError,
    isString: isString
};
