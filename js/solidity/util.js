var Address = require("../Address.js");
var EthWord = require("../Storage.js").Word;
var Int = require("../Int.js");
var Promise = require('bluebird');
var sha3 = require("../Crypto").sha3;
var errors = require("../errors.js");

function readInput(typesDef, varDef, x) {
    function prepare() {
        switch(varDef["type"]) {
        case "Address":
            return Address(x);
        case "Array":
            return x.map(readInput.bind(null, typesDef, varDef["entry"]));
        case "Bool":
            return Boolean(x);
        case "Bytes":
            if (typeof x !== "string") {
                throw errors.tagError(
                    "Solidity",
                    "bytes type takes hex string input"
                );
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
                    throw errors.tagError(
                        "Solidity",
                        "bytes" + bytes + "type requires " +
                            bytes + " bytes (" + 2*bytes + " hex digits)"
                    );
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
                    throw errors.tagError(
                        "Solidity",
                        "struct type takes object input"
                    );
                }

                var fields = typeDef["structFields"];
                var result = {};
                for (name in x) {
                    var field = fields[name];
                    if (field === undefined) {
                        throw errors.tagError(
                            "Solidity",
                            "struct type does not have a field \"" + name + "\""
                        );
                    }
                    result[name] = readInput(field, x[name]);
                }

                for (fieldName in fields) {
                    if (!(fieldName in result)) {
                        throw error.tagError(
                            "Solidity",
                            "struct type input missing field \"" + fieldName + "\""
                        );
                    }
                }

                return result;
            case "Enum":
                return x;
            }
        default:
            throw errors.tagError(
                "Solidity",
                "cannot read type " + type + " from input"
            );
        }
    }
    return Promise.try(prepare).
        catch.apply(then, errors.addTag("Solidity")).
        value();
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

function encodingLength(varDef) {
    if (varDef.dynamic) {
        return undefined;
    }

    switch (varDef["type"]) {
    case "Bytes":
        return 32 * Math.ceil(parseInt(varDef["bytes"])/32);
    case "Array":
        return parseInt(varDef["length"]) * encodingLength(varDef["entry"]);
    case "Address" : case "Bool" : case "Int" : return 32;
    }
}

module.exports = {
    readInput: readInput,
    dynamicDef : dynamicDef,
    castInt : castInt,
    encodingLength: encodingLength
}
