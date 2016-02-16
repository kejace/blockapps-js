var HTTPQuery = require("../HTTPQuery.js");
var Promise = require('bluebird');
var fs = require("fs");
var errors = require("../errors.js")

function streamFile(name, maybeContents) {
    if (!errors.isString(name)) {
        throw new Error("filename must be a string, not a " +
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
    var postDataObj = {};
    
    dataObjOpts = dataObj.options;
    for (opt in dataObjOpts) {
        postDataObj[opt] = dataObjOpts[opt];
    }
    delete dataObj.options;
    
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

function solcCommon(tag, code, dataObj) {
    if (!dataObj) {
        dataObj = {};
    }
    if (!("options" in dataObj)) {
        dataObj.options = {};
    }
    dataObj.options.src = code;
    var route = "/" + tag;
    return HTTPQuery(route, {"postData" : prepPostData(dataObj)}).tagExcepts(tag);
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

// extabi(code :: string, {
//   main : { <name> : (undefined | code :: string) ...},
//   import : { <name> : (undefined | code :: string) ...}
// }) = {
//   <contract name> : <solidity-abi response> ...
// }

module.exports = {
    solc: solcCommon.bind(null, "solc"),
    extabi: solcCommon.bind(null, "extabi")
};
