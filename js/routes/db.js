var HTTPQuery = require("../HTTPQuery.js");
var Promise = require('bluebird');
var Address = require("../Address.js");
var errors = require("../errors.js");

function block(blockQueryObj) {
    try {
        if (typeof blockQueryObj !== "object") {
            throw new Error(
                "blockQueryObj must be a dictionary of query parameters"
            );
        }
    }
    catch(e) {
        errors.pushTag("block")(e);
    }
    return HTTPQuery("/block", {"get": blockQueryObj}).
        then(function(blocks) {
            if (blocks.length === 0) {
                throw errors.tagError("NotDone", "Query did not match any blocks");
            }
            else {
                return blocks;
            }
        }).
        tagExcepts("block");
}

function blockLast(n) {
    try {
        n = Math.ceil(n);
        if (n <= 0) {
            throw new Error("blockLast", "n must be positive");
        }
    }
    catch(e) {
        errors.pushTag("blockLast")(e);
    }
    return HTTPQuery("/block/last/" + n, {"get":{}}).tagExcepts("blockLast"); 
}

function account(accountQueryObj) {
    try {
        if (typeof accountQueryObj !== "object") {
            throw new Error(
                "accountQueryObj must be a dictionary of query parameters"
            );
        }
    }
    catch(e) {
        errors.pushTag("account")(e);
    }
    return HTTPQuery("/account", {"get" : accountQueryObj}).
        then(function(accts) {
            if (accts.length === 0) {
                throw errors.tagError(
                    "NotDone",
                    "Query did not match any accounts"
                );
            }
            else {
                return accts;
            }
        }).
        tagExcepts("account");
}

function accountAddress(address) {
    return account({"address": Address(address).toString()}).get(0).
        tagExcepts("accountAddress");
}


function storage(storageQueryObj) {
    try {
        if (typeof storageQueryObj !== "object") {
            throw new Error(
                "storageQueryObj must be a dictionary of query parameters"
            );
        }
    }
    catch(e) {
        errors.pushTag("storage")(e);
    }
    return HTTPQuery("/storage", {"get": storageQueryObj}).
        then(function(stor) {
            if (stor.length === 0) {
                throw errors.tagError(
                    "NotDone",
                    "Query did not match any storage locations"
                );
            }
            else {
                return stor;
            }
        }).
        tagExcepts("storage");
}

function storageAddress(address) {
    return storage({"address": Address(address).toString()}).get(0).
        tagExcepts("storageAddress");
}

module.exports = {
    block: block,
    blockLast: blockLast,
    account: account,
    accountAddress: accountAddress,
    storage: storage,
    storageAddress: storageAddress
};
