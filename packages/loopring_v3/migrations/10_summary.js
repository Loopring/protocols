const LRCToken = artifacts.require("./test/tokens/LRC.sol");
const GTOToken = artifacts.require("./test/tokens/GTO.sol");
const WETHToken = artifacts.require("./test/tokens/WETH.sol");

const Cloneable = artifacts.require("Cloneable");
const ProtocolFeeVault = artifacts.require("ProtocolFeeVault");
const UserStakingPool = artifacts.require("UserStakingPool");
const UniswapTokenSeller = artifacts.require("UniswapTokenSeller");
const BatchVerifier = artifacts.require("BatchVerifier");
const BlockVerifier = artifacts.require("BlockVerifier");

const UniversalRegistry = artifacts.require("UniversalRegistry");

const ExchangeAdmins = artifacts.require("ExchangeAdmins");
const ExchangeBalances = artifacts.require("ExchangeBalances");
const ExchangeBlocks = artifacts.require("ExchangeBlocks");
const ExchangeDeposits = artifacts.require("ExchangeDeposits");
const ExchangeGenesis = artifacts.require("ExchangeGenesis");
const ExchangeTokens = artifacts.require("ExchangeTokens");
const ExchangeWithdrawals = artifacts.require("ExchangeWithdrawals");
const ExchangeV3 = artifacts.require("./impl/ExchangeV3.sol");
const LoopringV3 = artifacts.require("LoopringV3");

const AmmBlockReceiver = artifacts.require("AmmBlockReceiver");
const AmmExchange = artifacts.require("AmmExchange");
const AmmExitRequest = artifacts.require("AmmExitRequest");
const AmmJoinRequest = artifacts.require("AmmJoinRequest");
const AmmPoolToken = artifacts.require("AmmPoolToken");
const AmmStatus = artifacts.require("AmmStatus");
const LoopringAmmPool = artifacts.require("LoopringAmmPool");

module.exports = function(deployer, network, accounts) {
  console.log(">>> deployed to network: " + network);
  console.log("- LRCToken:", LRCToken.address);
  console.log("- GTOToken:", GTOToken.address);
  console.log("- WETHToken:", WETHToken.address);
  console.log("- Cloneable:", Cloneable.address);
  console.log("- ProtocolFeeVault:", ProtocolFeeVault.address);
  console.log("- UserStakingPool:", UserStakingPool.address);
  // console.log("- UniswapTokenSeller:", UniswapTokenSeller.address);
  console.log("- BatchVerifier:", BatchVerifier.address);
  console.log("- BlockVerifier:", BlockVerifier.address);
  console.log("- UniversalRegistry:", UniversalRegistry.address);
  console.log("- ExchangeAdmins:", ExchangeAdmins.address);
  console.log("- ExchangeBalances:", ExchangeBalances.address);
  console.log("- ExchangeBlocks:", ExchangeBlocks.address);
  console.log("- ExchangeDeposits:", ExchangeDeposits.address);
  console.log("- ExchangeGenesis:", ExchangeGenesis.address);
  console.log("- ExchangeTokens:", ExchangeTokens.address);
  console.log("- ExchangeWithdrawals:", ExchangeWithdrawals.address);
  console.log("- ExchangeV3:", ExchangeV3.address);
  console.log("- LoopringV3:", LoopringV3.address);

  console.log("- AmmBlockReceiver:", AmmBlockReceiver.address);
  console.log("- AmmExchange:", AmmExchange.address);
  console.log("- AmmExitRequest:", AmmExitRequest.address);
  console.log("- AmmJoinRequest:", AmmJoinRequest.address);
  console.log("- AmmPoolToken:", AmmPoolToken.address);
  console.log("- AmmStatus:", AmmStatus.address);
  console.log("- LoopringAmmPool:", LoopringAmmPool.address);
};
