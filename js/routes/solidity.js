var HTTPQuery = require("../HTTPQuery.js");
var Promise = require('bluebird');
var fs = require("fs");
var errors = require("../errors.js")

function streamFile(name, maybeContents) {
    if (!isString(name)) {
        throw errors.tagError("solcCommon", "filename must be a string, not a " +
                              "'" + name.constructor.name + "'");
    }
    switch (typeof maybeContents) {
    case "undefined" :
        return fs.createReadStream(name);
    case "string":
        return {
            value: maybeContents,
            options: {
                filename: name
            }
        }
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
}

function postDataCommon(route, dataObj) {
   return HTTPQuery(route, {"postData" : prepPostData(dataObj)});
}

function solcCommon(route, code, dataObj) {
    if (!("options" in dataObj)) {
        dataObj[options] = {};
    }
    dataObj[options]["src"] = code;
    return Promise.try(postDataCommon.bind(null, route, dataObj)).
        catch.apply(null, addTag("solcCommon"));
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
    return solcCommon("/solc", code, dataObj).
        catch.apply(null, errors.changeTag("solcCommon", "solc"));
}

// extabi(code :: string, {
//   main : { <name> : (undefined | code :: string) ...},
//   import : { <name> : (undefined | code :: string) ...}
// }) = {
//   <contract name> : <solidity-abi response> ...
// }
function extabi(code, dataObj) {
    return solcCommon("/extabi", code, dataObj).
        catch.apply(null, errors.changeTag("solcCommon", "extabi"));
}

module.exports = {
    solc: solc,
    extabi: extabi
};
