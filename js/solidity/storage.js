var Address = require("../Address.js");
var Int = require("../Int.js");
var util = require("./util.js");

function readStorageVar(varDef, storage) {
    var type = varDef["type"];
    switch(type) {
    case "Address": case "Contract":
        return simpleBuf(varDef, storage).then(Address);
    case "Bool":
        return simpleBuf(varDef, storage).get(0).then(function(x) {return x==1;});
    case "Bytes":
        return readBytes(varDef, storage);
    case "Enum":
        return simpleBuf(varDef, storage).then(varDef.names.get.bind(varDef.names));
    case "Int":
        return simpleBuf(varDef, storage).then(util.castInt.bind(null, varDef));
    case "String":
        return readBytes(varDef, storage).call("toString", "utf8");
    }
}

function readBytes(varDef, storage) {
    if (!varDef.dynamic) {
        return simpleBuf(varDef, storage);
    }
    else {
        return util.dynamicDef(varDef, storage).
            spread(function(realBytesAt, lengthBytes) {
                var lengthMul = lengthBytes[31];
                var length;
                if (lengthMul % 2) {
                    lengthMul = Int(lengthBytes).valueOf();
                    length = (lengthMul - 1)/2;
                    return storage.getRange(realBytesAt, length);
                }
                else {
                    length = lengthMul/2;
                    return lengthBytes.slice(0, length);
                }
            });
    }
}

function simpleBuf(varDef, storage) {
    var start = Int(varDef["atBytes"]);
    var bytesNum = util.objectSize(varDef);
    return storage.getRange(start, bytesNum);
}

module.exports = readStorageVar;
