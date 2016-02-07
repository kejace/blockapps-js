var solidity = require("./routes/solidity.js");
var bloc = require("./routes/bloc.js");
var transactions = require("./routes/transactions.js");
var db = require("./routes/db.js");

module.exports = {
    solc: solidity.solc,
    extabi: solidity.extabi,
    faucet: transactions.faucet,
    login: bloc.login,
    wallet: bloc.wallet,
    developer: bloc.developer,
    register: bloc.register,
    block: db.block,
    blockLast: db.blockLast,
    account: db.account,
    accountAddress: db.accountAddress,
    submitTransaction: transactions.submitTransaction,
    transaction: transactions.transaction,
    transactionLast: transactions.transactionLast,
    transactionResult: transactions.transactionResult,
    storage: db.storage,
    storageAddress: db.storageAddress
};
