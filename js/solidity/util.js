var Address = require("../Address.js");
var EthWord = require("../Storage.js").Word;
var Int = require("../Int.js");
var Promise = require('bluebird');
var sha3 = require("../Crypto").sha3;

function readInput(typesDef, varDef, x) {
    switch(varDef["type"]) {
    case "Address":
        return Address(x);
    case "Array":
        return x.map(readInput.bind(null, typesDef, varDef["entry"]));
    case "Bool":
        return Boolean(x);
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

        if (!isDynamic(varDef)) {
            var bytes = parseInt(varDef["bytes"]);
            if (x.length !== 2 * bytes) {
                throw "Solidity value: type bytes" + bytes + ": " +
                    bytes + " bytes (" + 2*bytes + " hex digits) required";
            }
        }

        return new Buffer(x, "hex");
    case "Int":
        return Int(x);
    case "String":
        return x;
    case undefined:
        var typeDef = types[varDef["typedef"]];
        switch (typeDef["type"]) {
        case "Struct":
            if (typeof x !== "object") {
                throw "Solidity value: type Struct: takes object input";
            }

            var fields = typeDef["structFields"];
            var result = {};
            for (name in x) {
                var field = fields[name];
                if (field === undefined) {
                    throw "Solidity value: type Struct: " +
                        "does not have a field \"" + name + "\"";
                }
                result[name] = readInput(field, x[name]);
            }

            for (fieldName in fields) {
                if (!(fieldName in result)) {
                    throw "Solidity value: type Struct: " +
                        "missing field \"" + fieldName + "\"";
                }
            }

            return result;
        case "Enum":
            return x;
        }
    default:
        throw "Solidity value: cannot read type " + type + " from input";
    }
}

function dynamicDef(varDef, storage) {
    var key = EthWord(varDef["atBytes"]).toString();
    var length = storage.getKey(key).call("toString", "hex");
    var realKey = sha3(varDef["atBytes"]);

    var result = {};
    for (var name in varDef) {
        result[name] = varDef[name];
    }
    result["atBytes"] = realKey;
    result["length"] = length;

    return Promise.props(result);
}


function castInt(varDef, x) {
    var cast;
    if (varDef["signed"]) {
        cast = Int.intSized;
    }
    else {
        cast = Int.uintSized;
    }
    return cast(x, parseInt(varDef["bytes"]));
}

module.exports = {
    readInput: readInput,
    dynamicDef : dynamicDef,
    castInt : castInt
}
