var Address = require("../Address.js");
var Int = require("../Int.js");

function readStorageVar(varDef, storage) {
    var type = varDef["type"];
    switch(type) {
    case "Address":
        return simpleBuf(varDef, storage).then(Address);
    case "Bool":
        return simpleBuf(varDef, storage).get(0).then(function(x) {return x==1;});
    case "Bytes":
        if (!varDef.dynamic) {
            return simpleBuf(varDef, storage);
        }
        else {
            return dynamicRow(varDef, storage).then(function(varDef) {
                var key = Int(varDef["atBytes"]);
                var length = parseInt(varDef["length"]);
                return storage.getRange(key, length);
            });
        }
    case "Int":
        return simpleBuf(varDef, storage).then(castInt.bind(varDef));
    case "String":
        return readSolVar({type: "Bytes", dynamic: true} , storage).
            call("toString", "utf8");
    }
}

function simpleBuf(varDef, storage) {
    var start = Int(varDef["atBytes"]);
    var bytesInt = parseInt(varDef["bytes"]);

    return storage.getRange(start, bytes);
}

module.exports = readStorageVar;
