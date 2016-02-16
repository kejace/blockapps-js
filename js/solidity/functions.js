var Int = require("../Int.js");
var Transaction = require("../Transaction.js");
var util = require("./util.js");
var errors = require("../errors.js");
var Enum = require("./enum.js");

function solMethod(typesDef, funcDef, name) {
    var vals = funcDef["vals"];
    util.setTypedefs(typesDef, vals);
    var args = funcDef["args"];
    util.setTypedefs(typesDef, args);
    var argsList = entriesToList(args);

    return function() {
        var argArr = [];

        var firstArg = arguments[0];
        if (arguments.length == 1 &&
            firstArg instanceof Object &&
            firstArg.constructor === Object)
        {
            for (var arg in args) {
                if (firstArg[arg] === undefined) {
                    throw errors.tagError(
                        "Solidity",
                        "function \"" + name + "\" " +
                            "arguments must include \"" + arg + "\""
                    );
                }
                argArr.push(util.readInput(typesDef, args[arg], firstArg[arg]));
            }
        }
        else {
            if (arguments.length !== argsList.length) {
                throw errors.tagError(
                    "Solidity",
                    "function \"" + name + "\" " +
                        "takes exactly " + argsList.length + " arguments"
                );
            }
            var argumentsList = arguments;
            argArr = argsList.map(function(argDef, i) {
                return util.readInput(typesDef, argDef, argumentsList[i]);
            });
        }
        
        var result = Transaction({
            "to" : this,
            "data": funcArgs(funcDef["selector"], argsList, argArr)
        });
        result.txParams = txParams;
        result.callFrom = callFrom;
        Object.defineProperties(result, {
            "_ret" : {
                value: {
                    type: "Array",
                    entries: vals,
                    length: Object.keys(vals).length
                }
            }
        });
        return result;
    }
}

function txParams(given) {
    ["value", "gasPrice", "gasLimit"].forEach(function(param) {
        if (param in given) {
            this[param] = "0x" + Int(given[param]).toString(16);
        }
    }.bind(this))
    return this;
}

function callFrom(from) {
    return this.send(from).get("response").bind(this).then(function(r) {
        var result = decodeReturn(this._ret, r);
        switch (result.length) {
        case 0:
            return null;
        case 1:
            return result[0];
        default:
            return result;
        }
    });
}

function funcArgs(selector, argsList, x) {
    var funcArgsDef = {
        "type" : "Array",
        "entries" : argsList
    };

    return selector + funcArg(funcArgsDef, x);
}

function funcArg(varDef, y) {
    switch (varDef["type"]) {
    case "Address": case "Int":
        return y.toEthABI();
    case "Bool":
        var result = y ? "01" : "00";
        for (var i = 0; i < 31; ++i) {
            result = "00" + result;
        }
        return result;
    case "String":
        y = new Buffer(y, "utf8");
        // Fall through!
    case "Bytes":
        var result = y.toString("hex");
        while (result.length % 64 != 0) {
            result = result + "00";
        }

        if (varDef.dynamic) {
            var len = Int(y.length/2).toEthABI();
            result = len + result;
        }
        
        return result;
    case "Array":
        var entries = varDef["entries"];
        if (entries === undefined) {
            entries = [];
            var entry = varDef["entry"];
            for (var i = 0; i < y.length; ++i) {
                entries.push(entry);
            }
        }

        var totalHeadLength = 0;
        var head = [];
        var tail = [];
        y.forEach(function(obj, i) {
            var entry = entries[i];
            if (entry.dynamic) {
                totalHeadLength += 32;
                head.push(undefined);
                var a = funcArg(entry, obj);
                tail.push(a);
            }
            else {
                var enc = funcArg(entry, obj);
                totalHeadLength += enc.length/2; // Bytes not nibbles
                head.push(enc);
                tail.push("");
            }
        })

        var currentTailLength = 0;
        head = head.map(function(z, i) {
            var lastTailLength = currentTailLength;
            currentTailLength += tail[i].length/2;
            if (z === undefined) {
                return Int(totalHeadLength + lastTailLength).toEthABI();
            }
            else {
                return z;
            }
        });

        var enc = head.join("") + tail.join("");
        if (varDef.dynamic) {
            len = Int(y.length).toEthABI;
            enc = len + enc
        }

        return enc;
    }
}

function decodeReturn(valsDef, x) {
    if (valsDef === undefined) {
        return null;
    }

    function getLength(varDef) {
        if (!varDef.dynamic) {
            var field;
            if (varDef["type"] === "Array") {
                field = "length";
            }
            else {
                field = "bytes";
            }
            return parseInt(varDef[field]);
        }
        else {
            return Int(grabInt());
        }
    }

    var toSlice;
    
    function grabInt() {
        toSlice = 64;
        return "0x" + x.slice(0,64);
    }
    
    function go(valDef) {
        var result;
        var after = function(x) { return x; };
        switch (valDef["type"]) {
        case "Address":
            result = new Buffer(20);
            result.write(x.slice(24),0,20,"hex"); // 24 = 2*(32 - 20)
            toSlice = 64;
            break;
        case "Bool":
            result = (x.slice(63,64) === '1');
            toSlice = 64;
            break;
        case "String":
            after = function(buf) { return buf.toString("utf8"); };
            // Fall through!
        case "Bytes":
            var length = getLength(valDef);
            var roundLength = 32 * Math.ceil(length/32); // Rounded up

            result = new Buffer(length);
            result.write(x,0,length,"hex");
            toSlice = 2 * roundLength;
            break;
        case "Enum":
            after = valDef.names.get.bind(valDef.names);
            // Fall through!
        case "Int":
            result = util.castInt(valDef, grabInt());
            break;
        case "Array":
            toSlice = 0; // Handled by the entries
            result = [];
            after = function(arr) {
                var entries;
                if ("entries" in valDef) {
                    entries = entriesToList(valDef["entries"]);
                }
                else {
                    entries = [];
                    var entry = valDef["entry"];
                    for (var i = 0; i < length; ++i) {
                        entries.push(entry);
                    }
                }

                var length = getLength(valDef);
                for (var i = 0; i < length; ++i) {
                    arr.push(go(entries[i]));
                }
                return arr;
            }
            break;
        }
        x = x.slice(toSlice);
        toSlice = undefined;
        return after(result);
    }
    return go(valsDef);
}

function entriesToList(entries) {
    var result = [];
    for (var entry in entries) {
        var entryDef = entries[entry];
        result[entryDef["index"]] = entryDef;
    }
    return result;
}

module.exports = solMethod;
module.exports.decodeReturn = decodeReturn;
