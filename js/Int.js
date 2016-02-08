var bigInt = require('big-integer');
var bigNum = require('bignumber.js');
var extendType = require("./extendType.js");
var pushTag = require("./errors.js").pushTag;

function Int(x) {
    try {
        if (Int.isInstance(x)) {
            return x;
        }

        var result;
        if (typeof x === "number") {
            result = bigInt(x);
        }
        else if (typeof x === "string") {
            if (x.slice(0,2) === "0x") {
                x = x.slice(2);
                result = bigInt(x,16);
            }
            else {
                result = bigInt(x,10);
            }
        }
        else if (Buffer.isBuffer(x)) {
            if (x.length == 0) {
                result = bigInt(0);
            }
            else {
                result = bigInt(x.toString("hex"),16);
            }
        }
        else {
            result = bigInt(x.toString(), 10);
        }
        
        var c = result.constructor;
        result = extendType(result, Int.prototype);
        Object.defineProperty(result, "bigIntType", {value: c});
        return result;
    }
    catch(e) {
        throw pushTag("Int")(e);
    }
}

Object.defineProperties(Int.prototype, {
    toEthABI: { value: toEthABI, enumerable: true }
});


Int.isInstance = function(x) {
    if (!(bigInt.isInstance(x) && "bigIntType" in x)) {
        return false;
    }
    function f(){};
    f.prototype = extendType(Int.prototype, x.bigIntType.prototype);
    return (x instanceof f);
}

function toEthABI() {
    var i256 = Int(2).pow(256);
    var x = this.mod(i256);
    if (x.lt(0)) {
        x = x.plus(i256);
    }
    
    var result = x.toString(16);
    if (result.length % 2 != 0) {
        result = "0" + result;
    }
    while (result.length < 64) {
        result = "00" + result;
    }
    return result;
}

Int.intSized = intSized;

function intSized(x, radix) {
    var xInt = uintSized(x, radix);
    var topBitInt = Int(256).pow(radix - 1);
    var hasTopBit = xInt.and(topBitInt).neq(0);
    if (hasTopBit) {
        xInt = xInt.minus(modInt);
    }
    return xInt;
}

Int.uintSized = uintSized;

function uintSized(x, radix) {
    var xInt = Int(x);
    var modInt = Int(256).pow(radix);
    xInt = xInt.mod(modInt);
    if (xInt.lt(0)) {
        xInt = xInt.plus(modInt);
    }

    return xInt;
}

module.exports = Int;
