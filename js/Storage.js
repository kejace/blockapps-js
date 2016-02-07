var storageQuery = require("./Routes.js").storage;
var Int = require("./Int.js");
var Address = require("./Address.js");
var errors = require("./errors.js");

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
    return storageQuery({"keyhex":key, "address":this.address}).
        catch(errors.matchTag("NotDone"), function() {
            return [{"key" : key, "value" : "0"}];
        }).
        get(0).
        get("value").
        then(EthWord).
        catch.apply(null, errors.addTag("Storage"));
}

function getRange(start, bytes) {
    var first = start.over(32); // Rounding down by 32
    var itemsNum = Math.ceil((bytes + 31)/32); // Rounding up by 32
    var last = first.plus(itemsNum - 1);
    var starti = start.mod(32).valueof();
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
                var keyi = EthWord(first.plus(i)).toString();
                if (keyi in keyVals) {
                    output[i] = keyVals[keyi];
                }
                else {
                    output[i] = EthWord.zero().toString();
                }
            }
            return Buffer(output.join(""),"hex");
        }).
        call("slice", starti, starti + bytes).
        catch.apply(null, errors.addTag("Storage"));        
}

function pushZeros(output, count) {
    for (var i = 0; i < count; ++i) {
        output.push(EthWord.zero());
    }
}

module.exports.Word = EthWord;
module.exports.Word.zero = EthWord.bind(undefined, "00");
function EthWord(x) {
    function prepare() {
        if (typeof x === "string" && x.match(/[0-9a-fA-F]/) === null) {
            throw errors.tagError(
                "EthWord",
                "input must be a hex string"
            );
        }
        if (typeof x == "number" || Int.isInstance(x)) {
            x = x.toString(16);
        }
        if (x.length % 2 != 0) {
            x = "0" + x;
        }
        var numBytes = x.length / 2

        if (numBytes > 32) {
            throw errors.tagError(
                "EthWord",
                "input must have at most 32 bytes"
            );
        }
        var result = new Buffer(32);
        result.fill(0);
        result.write(x, 32 - numBytes, numBytes, "hex");

        result.toString = Buffer.prototype.toString.bind(result, "hex");
        return result;
    }
    return Promise.try(prepare).
        catch.apply(null, errors.addTag("EthWord")).
        value();
}
