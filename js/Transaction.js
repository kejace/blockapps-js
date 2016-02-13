var ethTransaction = require('ethereumjs-tx');
var privateToAddress = require('ethereumjs-util').privateToAddress;
var submitTransaction = require("./Routes.js").submitTransaction;
var Account = require("./Account.js");
var Address = require("./Address.js");
var Int = require("./Int.js");
var errors = require("./errors.js");

module.exports = Transaction;
module.exports.defaults = {
    "value": 0
};

// argObj = {
//   data:, value:, gasPrice:, gasLimit:
// }
function Transaction(argObj) {
    try {
        var tx = new ethTransaction();
        if (argObj === undefined) {
            argObj = module.exports.defaults;
        }
        
        tx.gasPrice = "0x" + Int(
            !("gasPrice" in argObj) ? module.exports.defaults.gasPrice : argObj.gasPrice
        ).toString(16);
        tx.gasLimit = "0x" + Int(
            !("gasLimit" in argObj) ? module.exports.defaults.gasLimit : argObj.gasLimit
        ).toString(16);
        tx.value    = "0x" + Int(
            !("value" in argObj) ? module.exports.defaults.value : argObj.value
        ).toString(16);
        tx.data = "0x" + argObj.data;
        
        if (argObj.to !== undefined) {
            tx.to = "0x" + Address(argObj.to).toString();
        }
        
        Object.defineProperty(tx, "partialHash", {
            get : function() {
                return bufToString(this.hash());
            },
            enumerable : true
        });
        
        tx.toJSON = txToJSON;
        tx.send = sendTX;
        return tx;
    }
    catch(e) {
        throw errors.pushTag("Transaction")(e);
    }
}

function sendTX(privKeyFrom, addressTo) {
    var addr;
    try {
        privKeyFrom = new Buffer(privKeyFrom,"hex");
        var fromAddr = Address(privateToAddress(privKeyFrom));
        this.from = Address(fromAddr).toString();
        if (addressTo === null) {
            this.to = "";
        }
        else if (addressTo !== undefined) {
            this.to = "0x" + Address(addressTo).toString();
        }
        addr = fromAddr;
    }
    catch(e) {
        throw errors.pushTag("Transaction")(e);
    }

    return Account(addr).nonce.
        then((function(nonce) {
            this.nonce = "0x" + nonce.toString(16);
            this.sign(privKeyFrom);
            return submitTransaction(this);
        }).bind(this)).
        tagExcepts("Transaction");
}

function txToJSON() {
    var result = {
        "nonce"      : bufToNum(checkZero(this.nonce)),
        "gasPrice"   : bufToNum(checkZero(this.gasPrice)),
        "gasLimit"   : bufToNum(checkZero(this.gasLimit)),
        "value"      : bufToNum(checkZero(this.value)).toString(10),
        "codeOrData" : bufToString(this.data),
        "from"       : bufToString(this.from),
        "to"         : bufToString(this.to),
        "r"          : bufToString(this.r),
        "s"          : bufToString(this.s),
        "v"          : bufToString(this.v),
        "hash"       : this.partialHash
    }
    if (result["to"].length === 0) {
        delete result["to"];
    }
    return result;
}

function bufToNum(buf) {
    return parseInt(bufToString(buf),16);
}

function bufToString(buf) {
    return buf.toString("hex");
}

function checkZero(buf) {
    return (buf.length === 0) ? new Buffer([0]) : buf;
}
