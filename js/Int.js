var bigInt = require('big-integer');
var bigNum = require('bignumber.js');
var extendType = require("./types.js").extendType;
var errors = require("./errors.js");

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
                try {
                    result = bigInt(x,16);
                }
                catch(e) {
                    throw new Error("Invalid hex integer: " + x);
                }
            }
            else {
                try {
                    result = bigInt(x,10);
                }
                catch(e) {
                    throw new Error("Invalid decimal integer: " + x);
                }
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
        errors.pushTag("Int")(e);
    }
}

Object.defineProperties(Int.prototype, {
    toEthABI: { value: toEthABI, enumerable: true },
    toString: {
        value: function(n) {
            if (!n) {
                n = 10;
            }
            return this.bigIntType.prototype.toString.call(this, n);
        }
    },
    toJSON: {
        value: function() {
            return this.toString();
        }
    }
});


Int.isInstance = function(x) {
    if (!(bigInt.isInstance(x) && "bigIntType" in x)) {
        return false;
    }
    return (Object.getPrototypeOf(Object.getPrototypeOf(x)) ===
            x.bigIntType.prototype);
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
    var modInt = Int(256).pow(radix);
    var xInt = _uintSized(x, modInt);
    var hasTopBit = xInt.shiftRight(radix - 1).and(1) == 1;
    if (hasTopBit) {
        xInt = xInt.minus(modInt);
    }
    return Int(xInt);
}

Int.uintSized = uintSized;

function uintSized(x, radix) {
    var modInt = Int(256).pow(radix);
    return _uintSized(x, modInt);
}

function _uintSized(x, modInt) {
    var xInt = Int(x).mod(modInt);
    if (xInt.lt(0)) {
        xInt = xInt.plus(modInt);
    }
    return Int(xInt);
}

module.exports = Int;
