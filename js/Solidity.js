var routes = require("./Routes.js");
var solc = routes.solc;
var extabi = routes.extabi;
var Account = require("./Account.js");
var Address = require("./Address.js");
var Int = require("./Int.js");
var Storage = require("./Storage.js");
var Promise = require('bluebird');
var Enum = require('./solidity/enum');

var readStorageVar = require("./solidity/storage.js");
var util = require("./solidity/util.js");
var solMethod = require("./solidity/functions.js");

var assignType = require("./types.js").assignType;
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
            var files = {};
            for (file in solcR) {
                var contracts = {};
                for (contract in solcR[file]) {
                    var xabi = xabiR[file][contract];
                    var bin = solcR[file][contract].bin;
                                        
                    var typesDef = xabi.types;
                    for (typeName in typesDef) {
                        var typeDef = typesDef[typeName];
                        if (typeDef.type === "Enum") {
                            typeDef.names = Enum(typeDef.names, typeName);
                        }
                    }

                    util.setTypedefs(typesDef, xabi.vars);

                    contracts[contract] = assignType(Solidity,
                        {
                            "bin": bin,
                            "xabi": xabi,
                            "name": contract
                        }
                    );
                }
                files[file] = contracts;
            };
            // Backwards compatibility
            if (Object.keys(files).length === 1 &&
                Object.keys(files)[0] === "src" &&
                Object.keys(files.src).length == 1)
            {
                contract = Object.keys(files.src)[0];
                files = files.src[contract];
                files.name = contract;
            }
            return files;
        }).
        tagExcepts("Solidity");
}
Solidity.prototype = {
    "bin" : null,
    "xabi" : null,
    "account" : null,
    "constructor" : Solidity,
    "construct": function() {
        var constrDef = {
            "selector" : this.bin,
            "args": this.xabi.constr,
            "vals": {}
        };
        var tx = solMethod.
            call(this, this.xabi.types, constrDef, this.name).
            apply(Address(0), arguments);
        tx.callFrom = constrFrom;
        return tx;
    },
    "newContract" : function (privkey, txParams) { // Backwards-compatibility
        return this.construct().txParams(txParams).callFrom(privkey);
    },
    "attach": function() {
        return Solidity.attach.bind(null, this);
    },
    "toJSON": function() {
        var copy = {};
        var orig = this;
        ["bin", "xabi", "account"].forEach(function(p) {
            copy[p] = orig[p];
        });
        return copy;
    }
};
Solidity.attach = attach;
Solidity.fromJSON = function(x) {
    return assignType(Solidity, JSON.parse(x));
};

function constrFrom(privkey) {
    return this.send(privkey).
        get("contractsCreated").
        tap(function(addrList){
            if (addrList.length !== 1) {
                throw new Error("constructor must create a single account");
            }
        }).
        get(0).
        then(Address).
        bind(this).
        then(function(addr) {
            var contract = this._solObj;
            contract.account = new Account(addr);
            return contract;
        }).
        then(attach).
        tagExcepts("Solidity");
}

function attach(solObj) {
    var state = {};
    var xabi = solObj.xabi;
    var types = xabi.types;

    var addr = solObj.account.address;
    var funcs = xabi.funcs;
    for (var func in funcs) {
        Object.defineProperty(state, func, {
            value: solMethod(types, funcs[func], func).bind(addr),
            enumerable: true
        });
    }

    var storage = new Storage(addr);
    var svars = xabi.vars;
    for (var svar in svars) {
        Object.defineProperty(state, svar, {
            get : function() {
                try {
                    return makeSolObject(types, svars[svar], storage);
                }
                catch(e) {
                    errors.pushTag(svars[svar].type)(e);
                }
            },
            enumerable: true
        });
    }

    return assignType(solObj, {"state" : state});
}

function makeSolObject(typeDefs, varDef, storage) {
    switch (varDef.type) {
    case "Mapping":
        var mapLoc = Int(Int(varDef["atBytes"]).over(32)).toEthABI();
        var keyType = varDef["key"];
        var valType = varDef["value"];
        
        return function(x) {
            try {
                var arg = util.readInput(typeDefs, keyType, x);
                var keyBytes;
                switch (keyType["type"]) {
                case "Address":
                    keyBytes = arg.toEthABI();
                    break;
                case "Bool":
                    keyBytes = Int(arg ? 1 : 0).toEthABI();
                case "Int":
                    keyBytes = arg.toEthABI();
                    break;
                case "Bytes":
                    if (!keyType.dynamic) {
                        var result = arg.toString("hex");
                        while (result.length < 64) { // nibbles
                            result = "00" + result;
                        }
                        keyBytes = result;
                    }
                }

                var valueCopy = {}
                for (var p in valType) {
                    valueCopy[p] = valType[p];
                }
                valueCopy["atBytes"] = util.dynamicLoc(keyBytes + mapLoc);
                return makeSolObject(typeDefs, valueCopy, storage);
            }
            catch(e) {
                errors.pushTag("Mapping")(e);
            }
        };
    case "Array":
        return Promise.try(function() {
            if (varDef.dynamic) {
                return util.dynamicDef(varDef,storage);
            }
            else {
                return [Int(varDef.atBytes), varDef.length];
            }                        
        }).spread(function(atBytes, lengthBytes) {
            var numEntries = Int(lengthBytes).valueOf();
            var entryDef = varDef["entry"];
            var entrySize = util.objectSize(entryDef, typeDefs);

            var entryCopy = {}
            for (var p in entryDef) {
                entryCopy[p] = entryDef[p];
            }

            var result = [];
            atBytes = util.fitObjectStart(atBytes, 32); // Artificially align
            while (result.length < numEntries) {
                entryCopy["atBytes"] = util.fitObjectStart(atBytes, entrySize);
                result.push(makeSolObject(typeDefs, entryCopy, storage));
                atBytes = entryCopy["atBytes"].plus(entrySize);
            }
            return Promise.all(result);                
        });
    case "Struct":
        var userName = varDef["typedef"];
        var typeDef = typeDefs[userName];
        var fields = typeDef["fields"];
        // Artificially align
        var baseKey = util.fitObjectStart(varDef["atBytes"], 32);

        var result = {};
        for (var name in fields) {
            var field = fields[name];
            var fieldCopy = {};
            for (var p in field) {
                fieldCopy[p] = field[p];
            }
            var fieldOffset = Int(field["atBytes"]);
            fieldCopy["atBytes"] = baseKey.plus(fieldOffset);
            result[name] = makeSolObject(typeDefs, fieldCopy, storage);
        }
        return Promise.props(result);
    default:
        return readStorageVar(varDef, storage);
    }
}
