var storageQuery = require("./Routes.js").storage;
var Int = require("./Int.js");
var Address = require("./Address.js");
var errors = require("./errors.js");
var extendType = require("./types.js").extendType;

module.exports = Storage;
function Storage(address) {
    if (!(this instanceof Storage)) {
        return new Storage(address);
    }
    this.address = Address(address).toString();
}
Storage.prototype = {
    "address" : "",
    "getKey" : getKey,
    "getRange" : getRange,
    "constructor" : Storage
};

function getKey(key) {
    key = EthWord(key).toString();
    return storageQuery({"keyhex":key, "address":this.address}).
        catch(errors.matchTag("NotDone"), function() {
            return [{"key" : key, "value" : "0"}];
        }).
        get(0).
        get("value").
        then(EthWord).
        tagExcepts("Storage");
}

function getRange(start, bytes) {
    var first = start.over(32); // Rounding down by 32
    var itemsNum = Math.floor((bytes + 31)/32); // Rounding up by 32
    var last = first.plus(itemsNum - 1);
    var starti = start.mod(32).valueOf();
    var length = last.plus(1).minus(first).times(32).valueOf()
    return storageQuery({
            "minkey":first.toString(10),
            "maxkey":last.toString(10),
            "address":this.address
        }).
        catch(errors.matchTag("NotDone"), function() {
            return [];
        }).
        then(function(storageQueryResponse){
            var keyVals = {};
            storageQueryResponse.map(function(keyVal) {
                keyVals[EthWord(keyVal.key).toString()] = keyVal.value;
            });

            var output = new Array(itemsNum);
            for (var i = 0; i < itemsNum; ++i) {
                var keyi = EthWord(Int(first.plus(i))).toString();
                if (keyi in keyVals) {
                    output[i] = keyVals[keyi];
                }
                else {
                    output[i] = EthWord(0).toString();
                }
            }
            return Buffer(output.join(""),"hex");
        }).
        call("slice", length - (starti + bytes), length - starti).
        tagExcepts("Storage");        
}

function pushZeros(output, count) {
    for (var i = 0; i < count; ++i) {
        output.push(EthWord(0));
    }
}

module.exports.Word = EthWord;
var ethWordDescrs = {
    toString: {
        value: function() {
            return Buffer.prototype.toString.bind(this)("hex");
        }
    },
    toJSON: {
        value: function() { return this.toString(); }
    },
    constructor: {
        value: EthWord
    }
};

function EthWord(x) {
    try {
        if (typeof x === "string" && x.match(/[0-9a-fA-F]/) === null) {
            throw new Error("'" + x + "' is not a hex string");
        }
        if (typeof x === "number" || Int.isInstance(x)) {
            x = x.toString(16);
        }
        else if (Buffer.isBuffer(x)) {
            x = x.toString("hex");
        }
        else if (typeof x === "object") {
            throw new Error("Input " + x + " (type " + x.constructor.name + ") " +
                            "not recognized");
        }
        else if (typeof x !== "string") {
            throw new Error("Input " + x + " not recognized");
        }
        
        if (x.length % 2 != 0) {
            x = "0" + x;
        }
        var numBytes = x.length / 2

        if (numBytes > 32) {
            throw new Error("input must have at most 32 bytes");
        }
        var result = new Buffer(32);
        result.fill(0);
        result.write(x, 32 - numBytes, numBytes, "hex");

        Object.defineProperties(result, ethWordDescrs);
        return result;
    }
    catch(e) {
        throw errors.pushTag("EthWord")(e);
    }
}

EthWord.prototype = Object.create(Buffer.prototype, ethWordDescrs);

EthWord.isInstance = function(x) {
    return (Buffer.isBuffer(x) && x.constructor === EthWord);
}
