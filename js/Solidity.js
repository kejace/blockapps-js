var solc = require("./Routes.js").solc;
var Account = require("./Account.js");
var Address = require("./Address.js");
var Int = require("./Int.js");
var Transaction = require("./Transaction.js");
var Storage = require("./Storage.js");
var EthWord = Storage.Word;
var Promise = require('bluebird');
var nodeEnum = require('enum');

var readStorageVar = require("./solidity/storage.js");
var solUtil = require("./solidity/util.js");
var solMethod = require("./solidity/functions.js");

var errors = require("./errors.js");

module.exports = Solidity;

// string argument as in solc(code, _)
// object argument as in solc(_, dataObj)
// Solidity(x :: string | object) = {
//   <contract name> : {
//     bin : <hex string>,
//     xabi : <solidity-abi response>
//   } :: Solidity
//   ...
// }
// If only one object given as "code", collapses to
// { name : <contract name>, _ :: Solidity }
function Solidity(x) {
    var code = "";
    var dataObj = {};
    switch (typeof x) {
    case "string" :
        code = x;
        break;
    case "object" :
        dataObj = x;
        break;
    }
    return Promise.
        join(solc(code, dataObj), extabi(code, dataObj), function(solcR, xabiR) {
            var result = {};
            var names = Object.keys(xabiR);
            names.map(function(name) {
                var s = Object.create(Solidity.prototype);
                s.bin = solcR[name].bin;
                s.xabi = xabiR[name];
                result[name] = s;
            });
            // Backwards compatibility
            if (code.length > 0 && names.length == 1) {
                name = names[0];
                result = result[name]
                result.name = name;
            }

            return result;
        }).
        catch.apply(null, errors.addTag("Solidity"));
}
Solidity.prototype = {
    "bin" : null,
    "xabi" : null,
    "constructor" : Solidity,
    "newContract" : SolContract,
};

// txParams = {value, gasPrice, gasLimit}
function SolContract(privkey, txParams) {
    var solObj = this;
    if (txParams === undefined) {
        txParams = {};
    }
    txParams.data = this.vmCode;
    return Transaction(txParams).send(privkey, null).
        get("contractsCreated").
        tap(function(addrList){
            if (addrList.length !== 1) {
                throw errors.tagError(
                    "Solidity",
                    "code must create one and only one account"
                );
            }
        }).
        get(0).
        then(Address).
        then(function(newAddr) {
            return makeState(solObj, newAddr);
        }).
        catch.apply(null, errors.addTag("Solidity"));
};

module.exports.attach = attach;
function attach(metadata) {
    var error = errors.tagError(
        "Solidity",
        "Can only attach an Ethereum account to objects {bin, xabi[, address]}"
    );

    if (!(metadata instanceof Object)) {
        throw error;
    }
    
    var solObj = Object.create(Solidity.prototype);
    ["bin", "xabi"].forEach(function(name){
        if (name in metadata) {
            solObj[name] = metadata[name];
        }
        else {
            throw error;
        }
    });

    var numProps = Object.keys(metadata).length;
    if (numProps === 2) {
        return solObj;
    }

    if (!(numProps === 3 && "address" in metadata)) {
        throw error;
    }

    return makeState(solObj, metadata.address);
}

function makeState(solObj, newAddr) {
    var storage = new Storage(newAddr);
    var result = Object.create(solObj);
    result.state = {};
    result.account = new Account(newAddr);

    var types = solObj.xabi.types
    var funcs = solObj.xabi.funcs;
    for (var func in funcs) {
        var funcDef = funcs[func];
        result.state[func] = solMethod(types, funcDef, func).bind(newAddr);
    }

    var svars = solObj.xabi.vars;
    for (var svar in svars) {
        Object.defineProperty(result.state, svar, {
            get : makeSolObject(solObj.xabi.types, svars[svar], storage)
        });
    }

    return result;
}

function makeSolObject(typeDefs, varDef, storage) {
    switch (varDef.type) {
    case "Mapping":
        var mapLoc = EthWord(varDef["atBytes"]).toString();
        var keyType = varDef["key"];
        var valType = varDef["value"];
        
        function doMap(x) {
            var arg = util.readInput(keyType, x);
            var keyBytes;
            switch (keyType["type"]) {
            case "Address":
                keyBytes = Int(x).toEthABI();
                break;
            case "Bool":
                keyBytes = Int(x ? 1 : 0).toEthABI();
            case "Int":
                keyBytes = x.toEthABI();
                break;
            case "Bytes":
                if (!keyType.dynamic) {
                    var result = x.toString("hex");
                    while (result.length < 64) { // nibbles
                        result = "00" + result;
                    }
                    keyBytes = result;
                }
            }

            var atBytes = sha3(keyBytes + mapLoc);
            valType["atBytes"] = atBytes;
            return makeSolObject(typeDefs, keyType, storage)();
        };

        return function() {
            return doMap;
        };
    case "Array":
        return function () {
            var dynamicVarDef;
            if (varDef.dynamic) {
                dynamicVarDef = util.dynamicDef(varDef, storage);
            }
            else {
                dynamicVarDef = Promise.resolve(symRow);
            }

            return dynamicVarDef.then(function(varDef) {
                var numEntries = parseInt(varDef["length"]);

                var entryDef = varDef["entry"];
                var entrySize = parseInt(entryDef["bytes"]);
                var atBytesInt = Int(entryDef["atBytes"]);

                var entryCopy = {}
                for (var p in entryDef) {
                    entryCopy[p] = entryDef[p];
                }

                var result = [];
                while (result.length < numEntries) {
                    entryCopy["atBytes"] = atBytesInt.toString();
                    result.push(makeSolObject(typesDef, entryCopy, storage)());
                    atBytesInt = atBytesInt.plus(entrySize);
                }
                return Promise.all(result);                
            });
        }
    case undefined:
        var userName = varDef["typedef"];
        var typeDef = typeDefs[userName];

        switch (typeDef["type"]) {
        case "Struct":
            var fields = typeDef["fields"];
            var baseKey = Int(varDef["atBytes"]);

            return function () {
                var result = {};
                for (var name in fields) {
                    var field = fields[name];
                    var fieldCopy = {};
                    for (var p in field) {
                        fieldCopy[p] = field[p];
                    }
                    var fieldOffset = Int(field["atBytes"]);
                    fieldCopy["atBytes"] = baseKey.plus(fieldOffset);
                    result[name] = makeSolObject(typeDefs, fieldCopy, storage)();
                }
                return Promise.props(result);
            }

        case "Enum":
            var names = typeDef["names"];
            var enumType = new nodeEnum(names);

            var uintDef = {
                atBytes: varDef["atBytes"],
                bytes: typeDef["bytes"],
                type: "Int",
            };
            return function () {
                return readSolVar(uintDef, storage).then(function(x) {
                    return enumType.get(x.valueOf());
                })
            }
        }
    default:
        return readStorageVar.bind(null, varDef, storage);
    }
}
