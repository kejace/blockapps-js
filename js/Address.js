var Int = require("./Int.js");
var errors = require("./errors.js");

module.exports = Address;

var addrDescrs = {
    toEthABI: {value: toEthABI, enumerable: true},
    constructor: {value: Address},
    toString: {
        value: function() {
            return Buffer.prototype.toString.bind(this)("hex");
        }
    },
    toJSON: {
        value: function() {
            return this.toString();
        }
    }
};

function Address(x) {
    try {
        if (Address.isInstance(x)) {
            return x;
        }
        if (typeof x === "number" || Int.isInstance(x)) {
            x = x.toString(16);
        }

        var result;
        if (typeof x === "string") {
            result = new Buffer(20);
            result.fill(0);
            if (x.slice(0,2) === "0x") {
                x = x.slice(2);
            }
            if (x.length > 40) {
                x = x.slice(-40);
            }
            if (x.length % 2 != 0) {
                x = "0" + x;
            }
            var byteLength = x.length/2;

            if (!x.match(/^[0-9a-fA-F]*$/)) {
                throw new Error("Address string must be valid hex");
            }
            
            result.write(x, 20 - byteLength, byteLength, "hex");
        }
        else if (Buffer.isBuffer(x)) {
            if (x.length < 20) {
                result = new Buffer(20);
                result.fill(0);
                x.copy(result, 20 - x.length);
            }
            else {
                result = x.slice(-20);
            }
        }
        else {
            throw new Error("x must be a number, a hex string, or a Buffer");
        }
        result.toString = function() {
            return Buffer.prototype.toString.call(this,"hex");
        };
        result.toJSON = result.toString;

        Object.defineProperties(result, addrDescrs);        
        return result;
    }
    catch(e) {
        errors.pushTag("Address")(e);
    }
}

Address.prototype = Object.create(Buffer.prototype,  addrDescrs);

Address.isInstance = function(x) {
    return (Buffer.isBuffer(x) && x.constructor === Address);
}

function toEthABI() {
    var result = this.toString();
    for (var i = 0; i < 12; ++i) {
        result = "00" + result;
    }
    return result;
}
