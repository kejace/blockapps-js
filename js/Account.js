var accountQuery = require("./Routes.js").accountAddress;
var Address = require("./Address.js");
var Int = require("./Int.js");

module.exports = Account;

function Account(address) {
    if (!(this instanceof Account)) {
        return new Account(address);
    }
    this.address = Address(address);
}
Object.defineProperties(Account.prototype, {
    "address" : { value: null, enumerable: true, writable:true },
    "nonce"   : { get : function() { return propQuery(this.address, "nonce"); } },
    "balance" : { get : function() { return propQuery(this.address, "balance"); }},
    "constructor" : Account,
    "toJSON" : function() { return this.address; }
});

function propQuery(address, prop) {
    return accountQuery(address).get(prop).then(Int, Int.bind(null, 0));
}
