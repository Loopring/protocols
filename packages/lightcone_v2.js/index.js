const loopring = require('./lib/wallet/index');

module.exports = {
    common: loopring.common,
    ethereum: loopring.ethereum,
    relay: loopring.relay,
    // FIXME: failed to import WalletUtils
    // Please see lib/wallet/index.js
    // WalletUtils: loopring.WalletUtils,
    ContractUtils: loopring.ContractUtils,
    EthRpcUtils: loopring.EthRpcUtils,
    RelayRpcUtils: loopring.RelayRpcUtils,
    SocketUtils: loopring.SocketUtils,
    Utils: loopring.Utils
};