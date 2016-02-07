var HTTPQuery = require("./HTTPQuery.js");
var Promise = require('bluebird');
var Address = require("./Address.js");
var errors = require("./errors.js")

function block(blockQueryObj) {
    function prepare() {
        if (typeof blockQueryObj !== "object") {
            throw errors.tagError(
                "block",
                "blockQueryObj must be a dictionary of query parameters"
            );
        }
    }
    return Promise.try(prepare).
        then(HTTPQuery.bind(null, "/block", {"get": blockQueryObj})).
        then(function(blocks) {
            if (blocks.length === 0) {
                throw errors.tagError("NotDone", "Query did not match any blocks");
            }
            else {
                return blocks;
            }
        }).
        catch.apply(null, errors.addTag("block"));
}

function blockLast(n) {
    function prepare() {
        n = Math.ceil(n);
        if (n <= 0) {
            throw errors.tagError("blockLast", "n must be positive");
        }
    }
    return Promise.try(prepare).
        then(HTTPQuery.bind(null, "/block/last/" + n, {"get":{}})).
        catch.apply(null, errors.addTag("blockLast"));    
}

function account(accountQueryObj) {
    function prepare() {
        if (typeof accountQueryObj !== "object") {
            throw errors.tagError(
                "account",
                "accountQueryObj must be a dictionary of query parameters"
            );
        }
    }
    return Promise.try(prepare).
        then(HTTPQuery.bind(null, "/account", {"get" : accountQueryObj})).
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
        catch.apply(null, errors.addTag("account"));
}

function accountAddress(address) {
    return account({"address": Address(address).toString()}).get(0).
        catch.apply(null, changeTag("account", "accountAddress"));
}


function storage(storageQueryObj) {
    function prepare() {
        if (typeof storageQueryObj !== "object") {
            throw errors.tagError(
                "storage",
                "storageQueryObj must be a dictionary of query parameters"
            );
        }
    }
    return Promise.try(prepare).
        then(HTTPQuery.bind(null, "/storage", {"get": storageQueryObj})).
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
        catch.apply(null, addTag("storage"));
}

function storageAddress(address) {
    return storage({"address": Address(address).toString()}).get(0).
        catch.apply(null, changeTag("storage", "storageAddress"));
}

module.exports = {
    block: block,
    blockLast: blockLast,
    account: account,
    accountAddress: accountAddress,
    storage: storage,
    storageAddress: storageAddress
};
