var HTTPQuery = require("../HTTPQuery.js");
var Promise = require('bluebird');
var Address = require("../Address.js");
var pollPromise = require("./pollPromise.js");
var errors = require("../errors.js")

function faucet(address) {
    var addr;
    function prepare() {
        addr = Address(address).toString();
    }
    return Promise.try(prepare).
        then(HTTPQuery.bind(null, "/faucet", {"post": {"address" : addr}})).
        then(pollPromise.bind(null, accountAddress.bind(null, addr))).
        catch(Promise.TimeoutError, function(e) {
            throw errors.tagError(
                "faucet",
                "waited " + pollPromise.defaults.pollTimeoutMS / 1000 + " seconds"
            );
        }).
        tagExcepts("faucet");
}

function submitTransaction(txObj) {
    return HTTPQuery("/transaction", {"data":txObj}).
        then(pollPromise.bind(
            null,
            transactionResult.bind(null, txObj.partialHash)
        )).
        catch(Promise.TimeoutError, function() {
            throw errors.tagError(
                "submitTransaction",
                "waited " + pollPromise.defaults.pollTimeoutMS / 1000 + " seconds"
            );
        }).
        tagExcepts("submitTransaction");
}

function transaction(transactionQueryObj) {
    function prepare() {
        if (typeof transactionQueryObj !== "object") {
            throw errors.tagError(
                "transaction",
                "transactionQueryObj must be a dictionary of query parameters"
            );
        }
    }
    return Promise.try(prepare).
        then(HTTPQuery.bind(null, "/transaction", {"get": transactionQueryObj})).
        then(function(txs) {
            if (txs.length === 0) {
                throw errors.tagError(
                    "NotDone",
                    "Query did not match any transactions"
                );
            }
            else {
                return txs;
            }
        }).
        tagExcepts("transaction");
}

function transactionLast(n) {
    function prepare() {
        n = Math.ceil(n);
        if (n <= 0) {
            throw errors.tagError("transactionLast", "n must be positive");
        }
    }
    return Promise.try(prepare).
        then(HTTPQuery.bind(null, "/transaction/last/" + n, {"get":{}})).
        tagExcepts("transactionLast");
}

function transactionResult(txHash) {
    function prepare() {
        if (typeof txHash !== "string" || !txHash.match(/^[0-9a-fA-F]*$/)) {
            throw Promise.OperationalError("txHash must be a hex string");
        }
    }
    return Promise.try(prepare).
        then(HTTPQuery.bind(null, "/transactionResult/" + txHash, {"get":{}})).
        then(
            function(txList) {
                if (txList.length === 0) {
                    throw errors.tagError(
                        "NotDone",
                        "The transaction with this hash has not yet been executed."
                    );
                }
                return txList[0];
            }
        ).
        then(function(txResult){
            if (txResult.transactionHash !== txHash) {
                throw errors.tagError(
                    "transactionResult",
                    "could not retrieve transactionResult for hash " + txHash
                );
            }
            if (txResult.message !== "Success!") {
                var msg = "Transaction failed with transaction result:\n"
                    + JSON.stringify(txResult, undefined, "  ") + "\n";
                return transaction({hash: txHash}).
                    then(function(tx) {
                        throw errors.tagError(
                            "transactionResult",
                            msg + "\nTransaction was:\n" +
                                JSON.stringify(tx, undefined, "  "))
                    });
            }
            var contractsCreated = txResult.contractsCreated.split(",");
            txResult.contractsCreated = contractsCreated;
            return txResult;
        }).
        tagExcepts("transactionResult");
} 

module.exports = {
    faucet: faucet,
    submitTransaction: submitTransaction,
    transaction: transaction,
    transactionLast: transactionLast,
    transactionResult: transactionResult
}
