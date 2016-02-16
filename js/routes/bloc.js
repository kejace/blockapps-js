var HTTPQuery = require("../HTTPQuery.js");
var Promise = require('bluebird');
var Address = require("../Address.js");
var errors = require("../errors.js")

// loginObj: email, app, loginpass
function login(loginObj, address) {
    function prepare() {
        if (typeof loginObj !== "object") {
            throw errors.tagError(
                "login",
                "must have loginObj = {email, app, loginpass}"
            );
        }
        loginObj.address = Address(address).toString();
    }
    return Promise.try(prepare).
        then(HTTPQuery.bind(null, "/login", {"post": loginObj})).
        tagExcepts("login");
}

function wallet(loginObj, enckey) {
    function prepare() {
        if (typeof loginObj !== "object" || typeof enckey !== "string" ||
            !enckey.match(/^[0-9a-fA-F]*$/)) {
            throw errors.tagError(
                "wallet",
                "must have loginObj = {email, app, loginpass}, " +
                    "enckey = encoded key, as hex string"
            );
        }
        loginObj.enckey = enckey;
    }
    return Promise.try(prepare).
        then(HTTPQuery.bind(null,"/wallet", {"post": loginObj})).
        tagExcepts("wallet");
}

function developer(loginObj) {
    function prepare() {
        if (typeof loginObj !== "object") {
            throw errors.tagError(
                "developer",
                "must have loginObj = {email, app, loginpass}"
            );
        }
    }
    return Promise.try(prepare).
        then(HTTPQuery.bind(null, "/developer", {"post": loginObj})).
        tagExcepts("developer");
}

// appObj: developer, appurl, repourl
function register(loginObj, appObj) {
    function prepare() {
        if (typeof loginObj !== "object") {
            throw errors.tagError(
                "register",
                "must have loginObj = {email, app, loginpass}"
            );
        }
        if (typeof appObj !== "object") {
            throw errors.tagError(
                "register",
                "must have appObj = {developer, appurl, repourl}"
            );
        }
        for (prop in appObj) {
            loginObj[prop] = appObj[prop];
        }
    }
    return Promise.try(prepare).
        then(HTTPQuery.bind(null, "/register", {"post": loginObj})).
        tagExcepts("register");
}

module.exports = {
    login: login,
    wallet: wallet,
    developer: developer,
    register: register
};
