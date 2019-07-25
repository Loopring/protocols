import common from "./common";
import ethereum from "./ethereum";
// Looks like we don't need WalletUtils
// It also causes an error
// "export 'default' (reexported as 'WalletUtils')
// was not found in './WalletUtils'
// import WalletUtils from './WalletUtils';
import ContractUtils from "./ethereum/contracts/Contracts";
import EthRpcUtils from "./ethereum/eth";
import Utils from "./common/utils";

export {
  common,
  ethereum,
  // WalletUtils,
  ContractUtils,
  EthRpcUtils,
  Utils
};
