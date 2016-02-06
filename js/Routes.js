var HTTPQuery = require("./HTTPQuery.js");
var Promise = require('bluebird');
var Address = require("./Address.js");
var pollPromise = require("./pollPromise.js");
var fs = require("fs");

function streamFile(name, maybeContents) {
    switch (typeof maybeContents) {
    case "undefined" :
        return fs.createReadStream(name);
        break;
    case "string":
        return {
            value: maybeContents,
            options: {
                filename: name
            }
        }
        break;
    }
}

function prepPostData (dataObj) {
    dataObjOpts = dataObj[options];
    for (opt in dataObjOpts) {
        postDataObj[opt] = dataObjOpts[opt];
    }
    delete dataObj[options];
    
    for (name in dataObj) {
        postDataNameArr = [];
        dataObjName = dataObj[name];
        for (fname in dataObjName) {
            postDataNameArr.push(streamFile(fname, dataObjName[fname]));
        }
        postDataObj[name] = postDataNameArr;
    }
    return postDataObj;
};

function postDataCommon(route, dataObj) {
   return HTTPQuery(route, {"postData" : prepPostData(dataObj)});
}

function solcCommon(route, code, dataObj) {
    if (!("options" in dataObj)) {
        dataObj[options] = {};
    }
    dataObj[options]["src"] = code;
    return postDataCommon(route, dataObj);
}

// solc(code :: string, {
//   main : { <name> : (undefined | code :: string) ...},
//   import : { <name> : (undefined | code :: string) ...},
//   options : {
//     optimize, add-std, link: flags for "solc" executable
//     optimize-runs, libraries: options with arguments for "solc" executable
//   }
// }) = {
//   <contract name> : {
//     abi : <solidity contract abi>,
//     bin : <hex string>
//   } ...
// }
function solc(code, dataObj) {
    return solcCommon("/solc", code, dataObj);
}

// extabi(code :: string, {
//   main : { <name> : (undefined | code :: string) ...},
//   import : { <name> : (undefined | code :: string) ...}
// }) = {
//   <contract name> : <solidity-abi response> ...
// }
function extabi(code, dataObj) {
    return solcCommon("/extabi", code, dataObj);
}

function faucet(address) {
    var addr = Address(address).toString();
    return HTTPQuery("/faucet", {"post": {"address" : addr}}).then(function() {
        return pollPromise(accountAddress.bind(null,addr))
    }).catch(Promise.TimeoutError, function(e) {
        throw new Error (
            "Faucet not yet run after " +
                pollPromise.defaults.pollTimeoutMS / 1000 + "seconds"
        );
    }).return()
}

// loginObj: email, app, loginpass
function login(loginObj, address) {
    if (typeof loginObj !== "object") {
        throw Promise.OperationalError(
            "must have loginObj = {email, app, loginpass}"
        );
    }
    loginObj.address = Address(address).toString();
    return HTTPQuery("/login", {"post": loginObj});
}

function wallet(loginObj, enckey) {
    if (typeof loginObj !== "object" || typeof enckey !== "string" ||
        !enckey.match(/^[0-9a-fA-F]*$/)) {
        throw Promise.OperationalError(
            "must have loginObj = {email, app, loginpass}, " +
                "enckey = encoded key, as hex string"
        );
    }
    loginObj.enckey = enckey;
    return HTTPQuery("/wallet", {"post": loginObj});
}

function developer(loginObj) {
    if (typeof loginObj !== "object") {
        throw Promise.OperationalError(
            "must have loginObj = {email, app, loginpass}"
        );
    }
    return HTTPQuery("/developer", {"post": loginObj});
}

// appObj: developer, appurl, repourl
function register(loginObj, appObj) {
    if (typeof loginObj !== "object") {
        throw Promise.OperationalError(
            "must have loginObj = {email, app, loginpass}"
        );
    }
    if (typeof appObj !== "object") {
        throw Promise.OperationalError(
            "must have appObj = {developer, appurl, repourl}"
        );
    }
    for (prop in appObj) {
        loginObj[prop] = appObj[prop];
    }
    return HTTPQuery("/register", {"post": loginObj});
}

function block(blockQueryObj) {
    if (typeof blockQueryObj !== "object") {
        throw Promise.OperationalError(
            "blockQueryObj must be a dictionary of query parameters"
        );
    }
    return HTTPQuery("/block", {"get": blockQueryObj}).then(function(blocks) {
        if (blocks.length === 0) {
            throw new pollPromise.NotDoneError("Query did not match any blocks");
        }
        else {
            return blocks;
        }
    });
}

function blockLast(n) {
    n = Math.ceil(n);
    if (n <= 0) {
        throw Promise.OperationalError("n must be positive");
    }
    return HTTPQuery("/block/last/" + n, {"get":{}});
}

function account(accountQueryObj) {
    if (typeof accountQueryObj !== "object") {
        throw Promise.OperationalError(
            "accountQueryObj must be a dictionary of query parameters"
        );
    }
    return HTTPQuery("/account", {"get" : accountQueryObj}).then(function(accts) {
        if (accts.length === 0) {
            throw new pollPromise.NotDoneError("Query did not match any accounts");
        }
        else {
            return accts;
        }
    });
}

function accountAddress(address) {
    return account({"address": Address(address).toString()}).get(0);
}

function submitTransaction(txObj) {
    return HTTPQuery("/transaction", {"data":txObj}).then(function(){
        return pollPromise(transactionResult.bind(null, txObj.partialHash))
    }).catch(Promise.TimeoutError, function() {
        throw new Error(
            "Transaction still incomplete after " +
                pollPromise.defaults.pollTimeoutMS / 1000 + " seconds"
        );
    }).catch(function(txResult) {
        if (!("transactionHash" in txResult)) {
            throw new Error("could not retrieve transactionResult");
        }
        if (txResult.transactionHash.length != 0) {
            var msg = "Transaction failed with transaction result:\n" +
                JSON.stringify(txResult, undefined, "  ") + "\n";
            return transaction({hash: txResult.transactionHash}).
                then(function(tx) {
                    return Promise.reject(msg + "\nTransaction was:\n" +
                                          JSON.stringify(tx, undefined, "  "));
                });
        }
        else {
            return Promise.reject(msg);
        }
    });
}

function transaction(transactionQueryObj) {
    if (typeof transactionQueryObj !== "object") {
        throw Promise.OperationalError(
            "transactionQueryObj must be a dictionary of query parameters"
        );
    }
    return HTTPQuery("/transaction", {"get": transactionQueryObj}).then(
        function(txs) {
        if (txs.length === 0) {
            throw new pollPromise.NotDoneError("Query did not match any transactions");
        }
        else {
            return txs;
        }
    });
}

function transactionLast(n) {
    n = Math.ceil(n);
    if (n <= 0) {
        throw Promise.OperationalError("n must be positive");
    }    
    return HTTPQuery("/transaction/last/" + n, {"get":{}});
}

function transactionResult(txHash) {
    if (typeof txHash !== "string" || !txHash.match(/^[0-9a-fA-F]*$/)) {
        throw Promise.OperationalError("txHash must be a hex string");
    }
    return HTTPQuery("/transactionResult/" + txHash, {"get":{}}).then(
        function(txList) {
            if (txList.length === 0) {
                throw new pollPromise.NotDoneError(
                    "The transaction with this hash has not yet been executed."
                );
            }
            return txList[0];
        }
    ).then(function(txResult){
        if (txResult.message !== "Success!") {
            return Promise.reject(txResult);
        }
        var contractsCreated = txResult.contractsCreated.split(",");
        txResult.contractsCreated = contractsCreated;
        return txResult;
    });
} 

function storage(storageQueryObj) {
    if (typeof storageQueryObj !== "object") {
        throw Promise.OperationalError(
            "storageQueryObj must be a dictionary of query parameters"
        );
    }
    return HTTPQuery("/storage", {"get": storageQueryObj}).then(
        function(stor) {
        if (stor.length === 0) {
            throw new pollPromise.NotDoneError(
                "Query did not match any storage locations"
            );
        }
        else {
            return stor;
        }
    });
}

function storageAddress(address) {
    return storage({"address": Address(address).toString()}).get(0);
}

module.exports = {
    solc: solc,
    extabi: extabi,
    faucet: faucet,
    login: login,
    wallet: wallet,
    developer: developer,
    register: register,
    block: block,
    blockLast: blockLast,
    account: account,
    accountAddress: accountAddress,
    submitTransaction: submitTransaction:
    transaction: transaction
    transactionLast: transactionLast,
    transactionResult: transactionResult,
    storage: storage,
    storageAddress: storageAddress
};
