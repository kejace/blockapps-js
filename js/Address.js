var Int = require("./Int.js");
var errors = require("./errors.js");
var extendType = require("./extendType.js");
var pushTag = require("./errors.js").pushTag;

module.exports = Address;

function Address(x) {
    try {
        if (x.isAddress) {
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
                throw errors.tagError(
                    "Address",
                    "Address string must be valid hex"
                );
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
            throw tagError(
                "Address",
                "x must be a number, a hex string, or a Buffer"
            );
        }
        result.toString = function() {
            return Buffer.prototype.toString.call(this,"hex");
        };
        result.isAddress = true;

        return extendType(result, Address.prototype);
    }
    catch(e) {
        throw pushTag("Address")(e);
    }
}

Address.prototype = Object.create(Buffer.prototype, {
    toEthABI: {value: toEthABI, enumerable: true},
    constructor: {value: Address}
});

Address.isInstance = function(x) {
    return x instanceof Address;
}

function toEthABI() {
    var result = this.toString();
    for (var i = 0; i < 12; ++i) {
        result = "00" + result;
    }
    return result;
}
