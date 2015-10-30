var Int = require("./Int.js");
var Address = require("./Address.js");
var EthWord = require("./Storage.js").Word;
var Transaction = require("./Transaction.js");
var Promise = require('bluebird');

/*
 *  solMethod
 */

module.exports.solMethod = solMethod;
function solMethod(sym, symRow) {
    var fArgs = symRow["functionArgs"];
    var fDomain = symRow["functionDomain"];
    var fRet = symRow["functionReturns"];
    
    return function() {
        var arr;

        if (arguments.length === 1 &&
            arguments[0] instanceof Object &&
            !(Buffer.isBuffer(arguments[0])) &&
            !(Int.isInstance(arguments[0])) &&
            !(arguments[0] instanceof Array))
        { // Whew!
            var argObj = arguments[0];
            arr = fArgs.map(function(arg, i) {
                if (argObj[arg] === undefined) {
                    throw "Solidity function \"" + sym + "\": " +
                        "arguments must include \"" + arg + "\"";
                }
                return readInput(fDomain[i], argObj[arg]);
            });
        }
        else {
            if (arguments.length !== fArgs.length) {
                throw "Solidity function \"" + sym + "\": " +
                    "takes exactly " + fArgs.length + " arguments";
            }
            var params = arguments;
            arr = fArgs.map(function(arg, i) {
                return readInput(fDomain[i], params[i]);
            });
        }

        var result = Transaction({
            "to" : this,
            "data": funcArgs(symRow, arr)
        });
        result.txParams = txParams;
        result.callFrom = callFrom;
        Object.defineProperty(result, "_ret", {value: fRet});
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
    return this.send(from).get("response").then(
        decodeReturn.bind(null, this._ret)
    );
}


function funcArgs(symRow, x) {
    var symRow1 = {
        "jsType" : "Array",
        "arrayElements" : symRow["functionDomain"],
        "arrayLength" : symRow["functionDomain"].length
    };

    return symRow["functionHash"] + funcArg(symRow1, x);
}

module.exports.mapArg = mapArg
function mapArg(symRow, x) {
    switch (symRow["jsType"]) {
    case "Address": case "Bool": case "Int":
        return funcArg(symRow, x);
    case "Bytes":
        if (!isDynamic(symRow)) {
            var result = x.toString("hex");
            while (result.length < 64) { // nibbles
                result = "00" + result;
            }
            return result;
        }
        // Fall through!
    default:
        throw "Solidity mapping: argument cannot have type "+symRow["solidityType"];
    }
}

module.exports.funcArg = funcArg
function funcArg(symRow, y) {
    var type = symRow["jsType"];
    switch (type) {
    case "Address":
        var result = y.toString();
        for (var i = 0; i < 12; ++i) {
            result = "00" + result;
        }
        return result;
    case "Bool":
        var result = y ? "01" : "00";
        for (var i = 0; i < 31; ++i) {
            result = "00" + result;
        }
        return result;
    case "Bytes":
        return encodingBytes(y.toString("hex"), isDynamic(symRow));
    case "Int":
        if (y.geq(0)) {
            var result = y.toString(16);
            if (result.length % 2 != 0) {
                result = "0" + result;
            }
            while (result.length < 64) {
                result = "00" + result;
            }
            return result;
        }
        else {
            return funcArg(symRow, y.plus(Int(2).pow(256)));
        }
    case "String":
        var bytes = new Buffer(y, "utf8")
        return encodingBytes(bytes.toString("hex"), true);
    case "Array":
        var eltRows = symRow["arrayElements"];
        if (eltRows === undefined) {
            eltRows = [];
            for (var i = 0; i < y.length; ++i) {
                eltRows.push(symRow["arrayElement"]);
            }
        }

        var totalHeadLength = 0;
        var head = [];
        var tail = [];
        y.forEach(function(obj, i) {
            var objRow = eltRows[i];
            if (isDynamic(objRow)) {
                totalHeadLength += 32;
                head.push(undefined);
                var a = funcArg(objRow, obj);
                tail.push(a);
            }
            else {
                var enc = funcArg(objRow, obj);
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
                return funcArg({"jsType" : "Int"},
                          Int(totalHeadLength + lastTailLength));
            }
            else {
                return z;
            }
        });

        var enc = head.join("") + tail.join("");
        if (isDynamic(symRow)) {
            len = funcArg({"jsType": "Int"}, Int(y.length));
            enc = len + enc
        }

        return enc;
    default:
        throw "Solidity function call: cannot pass an argument of type " + type;
    }
}

function encodingBytes(hexString, dynamic) {
    var result = hexString;
    while (result.length % 64 != 0) {
        result = result + "00";
    }

    if (dynamic) {
        var len = funcArg({"jsType" : "Int"}, Int(hexString.length/2));
        result = len + result;
    }
    
    return result;
}

module.exports.decodeReturn = decodeReturn;
function decodeReturn(symRow, x) {
    if (symRow === undefined) {
        return null;
    }
    
    function getLength(symRow1) {
        if (!isDynamic(symRow1)) {
            var field;
            if (symRow1["jsType"] === "Array") {
                field = "arrayLength";
            }
            else {
                field = "bytesUsed";
            }
            return parseInt(symRow1[field],16);
        }
        else {
            return go({
                "jsType" : "Int", "solidityType" : "uint256"
            }).valueOf();
        }
    }
    
    function go(symRow1) {
        var type = symRow1["jsType"];
        switch (type) {
        case "Address":
            var result = new Buffer(20);
            result.write(x.slice(24),0,20,"hex");
            x = x.slice(64);
            return result;
        case "Bool":
            var result = (x.slice(63,64) === '1');
            x = x.slice(64);
            return result;
        case "Bytes":
            var length = getLength(symRow1);
            var roundLength = 32 * Math.ceil(length/32); // Rounded up

            var result = new Buffer(length);
            result.write(x,0,length,"hex");
            x = x.slice(2*roundLength);
            return result;
        case "Int":
            var result = twosComplement(symRow1, Int("0x" + x.slice(0,64)));
            x = x.slice(64);
            return result;
        case "String":
            var symRow2 = {};
            for (p in symRow1) {
                symRow2[p] = symRow1[p];
            }
            symRow2.jsType = "Bytes";
            symRow2.solidityType = "bytes";
            return go(symRow2).toString("utf8");
        case "Array":
            var length = getLength(symRow1);
            x = x.slice(length * 64); // drop the "heads"

            var eltRow = symRow1["arrayElement"];
            var result = [];
            for (var i = 0; i < length; ++i) {
                result.push(go(eltRow));
            }
            return result;
        default:
            throw "Solidity function call: return value cannot have type " + type;
            break;
        }
    }
    return go(symRow);
}

module.exports.encodingLength = encodingLength;
function encodingLength(symRow) {
    if (isDynamic(symRow)) {
        return undefined;
    }

    var type = symRow["jsType"]
    switch (type) {
    case "Bytes":
        return 32 * Math.ceil(parseInt(symRow["bytesUsed"], 16)/32);
    case "Array":
        return parseInt(symRow["arrayLength"], 16) *
            encodingLength(symRow["arrayElement"]);
    case "Address" : case "Bool" : case "Int" : return 32;
    default:
        throw "Type " + type + " does not have a fixed encoding length";
    }
}

/*
 *  readInput
 */

module.exports.readInput = readInput;
function readInput(symRow, x) {
    var type = symRow["jsType"];
    switch(type) {
    case "Address":
        return Address(x);
    case "Array":
    case "Bool":
        return x;
    case "Bytes":
        if (typeof x !== "string") {
            throw "Solidity value: type Bytes: takes hex string input";
        }
        if (x.slice(0,2) === "0x") {
            x = x.slice(2);
        }
        if (x.length % 2 != 0) {
            x = "0" + x;
        }

        if (!isDynamic(symRow)) {
            var bytes = parseInt(symRow["bytesUsed"],16);
            if (x.length !== 2 * bytes) {
                throw "Solidity value: type bytes" + bytes + ": " +
                    bytes + " bytes (" + 2*bytes + " hex digits) required";
            }
        }

        return new Buffer(x, "hex");
    case "Enum":
        return x;
    case "Int":
        return Int(x);
    case "String":
        return x;
    case "Struct":
        if (typeof x !== "object") {
            throw "Solidity value: type Struct: takes object input";
        }

        var fields = symRow["structFields"];
        var result = {};
        for (fieldName in x) {
            var fieldRow = fields[fieldName];
            if (fieldRow === undefined) {
                throw "Solidity value: type Struct: " +
                    "does not have a field \"" + fieldName + "\"";
            }
            result[fieldName] = readInput(fieldRow, x[fieldName]);
        }

        for (fieldName in fields) {
            if (!(fieldName in result)) {
                throw "Solidity value: type Struct: " +
                    "missing field \"" + fieldName + "\"";
            }
        }

        return result;
    default:
        throw "Solidity value: cannot read type " + type + " from input";
    }
}

/*
 *  readSolVar
 */

module.exports.readSolVar = readSolVar;
function readSolVar(symRow, storage) {
    var type = symRow["jsType"];
    switch(type) {
    case "Address":
        return simpleBuf(symRow, storage).then(Address);
    case "Bool":
        return simpleBuf(symRow, storage).get(0).then(function(x) {return x==1;});
    case "Bytes":
        if (!isDynamic(symRow)) {
            return simpleBuf(symRow, storage);
        }
        else {
            return dynamicRow(symRow, storage).then(function(symRow) {
                var length = parseInt(symRow["arrayLength"],16);
                var realKey = symRow["atStorageKey"];

                var numSlots = Math.floor((length + 31)/32); // Round up
                return storage.getKeyRange(realKey,numSlots).call("slice",0,length)
            });
        }
    case "Int":
        return simpleBuf(symRow, storage).then(Int).
            then(twosComplement.bind(null,symRow));
    case "String":
        var symRow1 = {}
        for (var name in symRow) {
            symRow1[name] = symRow[name];
        }
        symRow1["jsType"] = "Bytes";
        symRow1.solidityType = "bytes";
        return readSolVar(symRow1, storage).call("toString", "utf8");
    default:
        throw "Solidity contract: cannot read type " + type + " from storage";
    }
}

module.exports.dynamicRow = dynamicRow;
function dynamicRow(symRow, storage) {
    var key = EthWord(symRow["atStorageKey"]).toString();
    var length = storage.getSubKey(key,0,32).call("toString", "hex");
    var realKey = symRow["arrayDataStart"];

    var result = {};
    for (var name in symRow) {
        result[name] = symRow[name];
    }
    result["atStorageKey"] = realKey;
    result["arrayLength"] = length;
    delete result["arrayDataStart"];

    return Promise.props(result);
}

function simpleBuf(symRow, storage) {
    var symKey = symRow["atStorageKey"];
    var symOffset = (symRow["atStorageOffset"] === undefined) ?
        "0" : symRow["atStorageOffset"];
    var intOffset = parseInt(symOffset,16);
    var intBytes = parseInt(symRow["bytesUsed"],16);

    return storage.getSubKey(symKey, intOffset, intBytes);
}

module.exports.isDynamic = isDynamic;
function isDynamic(symRow) {
    switch (symRow["jsType"]) {
    case "String" : return true;
    case "Array" : return symRow["arrayLength"] === undefined;
    case "Bytes" : return symRow["solidityType"] === "bytes";
    default: return false;
    }
}

function twosComplement(symRow, x) {
    if (symRow["solidityType"][0] !== 'u') { // Signed
        var byteLength = parseInt(symRow["bytesUsed"],16);
        var modInt = Int(256).pow(byteLength);
        x = x.mod(modInt);
        
        var topBitInt = modInt.shiftRight(1);
        var hasTopBit = x.and(topBitInt).neq(0);
        if (hasTopBit) {
            return x.minus(modInt);
        }
        else {
            return x;
        }
    }
    else {
        return x;
    }
}
