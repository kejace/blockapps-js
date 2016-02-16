var Int = require("../Int.js");
var nodeEnum = require('enum');

function Enum(names, enumName) {
    var nameVals = {}
    names.forEach(function(n,i) {
        nameVals[n] = i;
    });
    var opts;
    if (typeof enumName === "string" && enumName.length > 0) {
        opts = {name : enumName};
    }
    var result = new nodeEnum(nameVals, opts);
    result.get = function(x) {
        x = Int(x);
        var item = nodeEnum.prototype.get.call(this, x.valueOf());
        item.toString = function() {
            return {
                key: this.key,
                value: this.value,
                enumType: enumName
            };
        };
        item.toJSON = function() { return this.toString(); };
        return item;
    };
    return result;
}

module.exports = Enum;
