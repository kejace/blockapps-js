var Promise = require('bluebird');
var errors = require("../errors.js");

module.exports = pollPromise;

var defaults = {}

module.exports.defaults = defaults;

function pollPromise(promiseFn) {
    function doPoll() {
        return promiseFn().cancellable().
            catch(errors.matchTag("NotDone"), function() {
                return Promise.resolve().delay(defaults.pollEveryMS).then(doPoll);
            });
    }
    
    return doPoll().timeout(defaults.pollTimeoutMS);
}
