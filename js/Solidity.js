var solc = require("./Routes.js").solc;
var Account = require("./Account.js");
var Address = require("./Address.js");
var Int = require("./Int.js");
var Transaction = require("./Transaction.js");
var Storage = require("./Storage.js");
var EthWord = Storage.Word;
var sha3 = require("./Crypto").sha3;
var Promise = require('bluebird');
var nodeEnum = require('enum');

var solidityType = require("./solidityType.js");
var readSolVar = solidityType.readSolVar;
var readInput = solidityType.readInput;
var solMethod = solidityType.solMethod;
var mapArg = solidityType.mapArg;
var isDynamic = solidityType.isDynamic;
var dynamicRow = solidityType.dynamicRow;

module.exports = Solidity;
function Solidity(code) {
    if (!(this instanceof Solidity)) {
        return new Solidity(code);
    }
    
    return solc(code).then(function(x) {
        var result = Object.create(Solidity.prototype);
        result.code = code;
        result.name = x.name;
        result.vmCode = x.vmCode;
        result.symTab = x.symTab;
        return result;
    }).catch(function(e) {
        throw "Solidity(code): " + e;
    });
}
Solidity.prototype = {
    "code" : "",
    "name" : "",
    "vmCode" : null,
    "symTab" : null,
    "constructor" : Solidity,
    "newContract" : SolContract,
};

// txParams = {value, gasPrice, gasLimit} privkey
function SolContract(privkey, txParams) {
    var solObj = this;
    if (txParams === undefined) {
        txParams = {};
    }
    txParams.data = this.vmCode;
    return Transaction(txParams).send(privkey, null).get("contractsCreated").
        tap(function(addrList){
            if (addrList.length !== 1) {
                throw "code must create one and only one account";
            }
        }).get(0).then(Address).then(function(newAddr) {
            return makeState(solObj, newAddr);
        });
};

module.exports.attach = attach;
function attach(metadata) {
    var error = "Can only attach an Ethereum account to objects " +
        "{code, name, vmCode, symTab, [address]}";

    if (!(metadata instanceof Object)) {
        throw error;
    }
    
    var solObj = Object.create(Solidity.prototype);
    ["code", "name", "vmCode", "symTab"].forEach(function(name){
        if (name in metadata) {
            solObj[name] = metadata[name];
        }
        else {
            throw error;
        }
    });

    var numProps = Object.keys(metadata).length;
    if (numProps === 4) {
        return solObj;
    }

    if (!(numProps === 5 && "address" in metadata)) {
        throw error;
    }

    return makeState(solObj, metadata.address);
}

function makeState(solObj, newAddr) {
    var storage = new Storage(newAddr);
    var result = Object.create(solObj);
    result.state = {};
    result.account = new Account(newAddr);

    var symTab = solObj.symTab;
    for (var sym in symTab) {
        var symRow = symTab[sym];
        if (!("atStorageKey" in symRow)) {
            if (symRow["jsType"] === "Function") {
                result.state[sym] = solMethod(sym, symRow).bind(result.account.address);
            }
            continue;
        }
        
        Object.defineProperty(result.state, sym, {
            get : makeSolObject(symTab, symRow, storage),
            enumerable: true
        });
    }
    return result;
}

function makeSolObject(symTab, symRow, storage) {
    switch (symRow["jsType"]) {
    case "Mapping":
        var mapKey = EthWord(symRow["atStorageKey"]).toString();
        var keyRow = symRow["mappingKey"];
        var valRow = symRow["mappingValue"];
        
        function doMap(x) {
            var keyBytes = mapArg(keyRow, readInput(keyRow, x));
            var key = sha3(keyBytes + mapKey);
            valRow["atStorageKey"] = key;
            return makeSolObject(symTab, valRow, storage)();
        };

        return function() {
            return doMap;
        };
    case "Struct":
        var userName = symRow["solidityType"];
        var structFields = symTab[userName]["structFields"];
        var baseKey = Int("0x" + symRow["atStorageKey"]);

        return function () {
            var result = {};
            for (var field in structFields) {
                var structField = structFields[field];
                var fieldRow = {};
                for (var name in structFields[field]) {
                    fieldRow[name] = structField[name];
                }
                var fieldKey = Int("0x" + fieldRow["atStorageKey"]);
                var realKey = baseKey.plus(fieldKey).toString(16);
                fieldRow["atStorageKey"] = realKey;
                if (isDynamic(fieldRow)) {
                    var realKey32 = EthWord(realKey).toString();
                    fieldRow["arrayDataStart"] = sha3(realKey32);
                }
                result[field] = makeSolObject(symTab, fieldRow, storage)();
            }
            return Promise.props(result);
        }
    case "Enum":
        var userName = symRow["solidityType"];
        var enumNames = symTab[userName]["enumNames"];
        var enumType = new nodeEnum(enumNames);

        var symRow1 = {};
        for (name in symRow) {
            symRow1[name] = symRow[name];
        }
        symRow1["jsType"] = "Int";
        symRow1["solidityType"] = "uint"
        return function () {
            return readSolVar(symRow1, storage).then(function(x) {
                return enumType.get(x.valueOf());
            })
        }
    case "Array":
        return function () {
            var symRow1;
            if (isDynamic(symRow)) {
                symRow1 = dynamicRow(symRow, storage);
            }
            else {
                symRow1 = symRow;
            }
            
            return Promise.join(symRow1, function(symRow) {
                var arrElt = symRow["arrayElement"];
                var eltRow = {};
                for (var name in arrElt) {
                    eltRow[name] = arrElt[name];
                };
                eltRow["atStorageKey"] = symRow["atStorageKey"];
                eltRow["atStorageOffset"] = "0x0";

                var eltSize = parseInt(eltRow["bytesUsed"],16);
                var numElts = parseInt(symRow["arrayLength"],16);

                var arrayCR = parseInt(symRow["arrayNewKeyEach"],16);
                var arrayCRSkip = (eltSize < 32 ? 1 : eltSize / 32);

                var result = [];
                while (result.length < numElts) {
                    result.push(makeSolObject(symTab, eltRow, storage)());
                    
                    if (result.length % arrayCR == 0) {
                        var oldKey = Int("0x" + eltRow["atStorageKey"]);
                        eltRow["atStorageKey"] =
                            oldKey.plus(arrayCRSkip).toString(16);
                        eltRow["atStorageOffset"] = "0x0";
                    }
                    else {
                        var oldOff = parseInt(eltRow["atStorageOffset"],16);
                        eltRow["atStorageOffset"] =
                            (eltSize + oldOff).toString(16);
                    }
                }
                return Promise.all(result);
            });
        }
    default:
        return readSolVar.bind(null, symRow, storage);
    }
}
