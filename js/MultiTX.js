var Address = require("./Address.js");
var Account = require("./Account.js");
var Solidiy = require("./Solidity.js");
var encodingLength = require("./solidity/util.js").encodingLength;
var decodeReturn = require("./solidity/functions.js").decodeReturn;
var Transaction = require("./Transaction.js");
var Int = require("./Int.js");

module.exports = MultiTX;

var defaults = {};
module.exports.defaults = defaults;

function MultiTX(txArray) {
    if (arguments.length > 1 || !(arguments[0] instanceof Array) ) {
        throw "MultiTX takes one array as an argument";
    }

    var multiplexer = Solidity.attach({
        "address": defaults.address,
        "code": "",
        "name": "multiplexer",
        "vmCode": "",
        "symTab": {
            "creator" : {
                "solidityType" : "address",
                "jsType" : "Address",
                "atStorageKey" : 0,
                "bytesUsed" : 20
            },
            "fee" : {
                "solidityType" : "uint256",
                "jsType" : "Int",
                "atStorageKey" : 1,
                "bytesUsed" : 20
            }
        }
    });

    var totalValue = Int(0);
    var rets = [];
    var multiTX = Int(txArray.length).toEthABI();
    txArray.forEach(function(tx) {
        totalValue = totalValue.add(Int(tx.value));

        multiTX += Int(tx.value).toEthABI();
        multiTX += Int(tx.data.length).toEthABI() + tx.data.toString("hex");
        if (tx.to.length == 0) {
            multiTX += Address(0).toEthABI();
            rets.push({
                "solidityType" : "address",
                "jsType" : "Address",
                "bytesUsed" : 20
            });
            return;
        }
        else {
            multiTX += Address(tx.to).toEthABI();
        }

        var retLength = 0;
        if (tx._ret !== undefined) {
            retLength = encodingLength(tx._ret);
        }
        multiTX += Int(retLength).toEthABI() + Int(tx.gasLimit).toEthABI();
        
        rets.push(tx._ret);
    });

    var tx = Transaction({
        "data" : multiTX,
        "to" : multiplexer.account.address
    });
    Object.defineProperties(tx, {
        multiValue: { "value" : totalValue },
        multiRets: { "value" : rets },
        multiSend: { "value" : sendMultiTX, enumerable : true},
        txParams: { "value" : txParams, enumerable : true}
    });

    return tx;
}

function txParams(params) {
    var tx = this;
    ["gasPrice", "gasLimit"].forEach(function(param) {
        if (param in params) {
            tx[param] = params[param].toString(16);
        }
    });
    return tx;
}

function sendMultiTX(privkey) {
    var tx = this;
    return multiplexer.state.fee.then(function(fee) {
        tx.value = tx.multiValue.add(fee).toString(16);
        return tx.send(privkey);
    }).get("response").then(function(returns) {
        var retBytes = new Buffer(returns, "hex");
        var noMore = false;
        return tx.multiRets.map(function(retType) {
            if (noMore) {
                return undefined;
            }
            
            var thisReturn;
            if (retType === undefined) {
                thisReturn = new Buffer(0);
            }
            else {
                var retLen = parseInt(retType["bytesUsed"], 16);
                thisReturn = retBytes.slice(0, retLen);
                retBytes = retBytes.slice(retLen);
            }
            
            var retStatus = retBytes[0];
            retBytes = retBytes.slice(1);

            noMore = ((retStatus & 0x10) != 0);
            var success = ((retStatus & 0x01) == 0);

            if (success) {
                return decodeReturn(retType, thisReturn.toString("hex"));
            }
            else {
                return undefined;
            }                            
        });
    });
}
