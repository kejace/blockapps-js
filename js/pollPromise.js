var Promise = require('bluebird');

module.exports = pollPromise;

var defaults = {}

module.exports.defaults = defaults;

function pollPromise(promiseFn) {
    function doPoll() {
        return promiseFn().cancellable().
            catch(NotDoneError, function() {
                return Promise.resolve().delay(defaults.pollEveryMS).then(doPoll);
            });
    }
    console.log('delaying MS: ' + 1000) // if I use defaults.pollDelayMS then I get undefined, even though it is defined in profiles.js
    return Promise.resolve().delay(1000).then(doPoll);
}

module.exports.NotDoneError = NotDoneError;
function NotDoneError(s, f, l) {
    this.name = "NotDoneError";
    this.message = s;
    Error.captureStackTrace(this, NotDoneError);
}
NotDoneError.prototype = Object.create(Error.prototype);
NotDoneError.prototype.constructor = NotDoneError;
