// Deploy all auxiliary contracts used by either Exchange, LoopringV3,
// or UniversalRegistry.

const ProtocolFeeVault = artifacts.require("ProtocolFeeVault");
const UserStakingPool = artifacts.require("UserStakingPool");
const BatchVerifier = artifacts.require("BatchVerifier");
const BlockVerifier = artifacts.require("BlockVerifier");
const LRCToken = artifacts.require("./test/tokens/LRC.sol");
const AgentRegistry = artifacts.require("AgentRegistry");
const FastWithdrawalAgent = artifacts.require("FastWithdrawalAgent");

module.exports = function(deployer, network, accounts) {
  if (network != "live" && network != "live-fork") {
    deployer.then(async () => {
      await deployer.deploy(UserStakingPool, LRCToken.address);
      await deployer.deploy(ProtocolFeeVault, LRCToken.address);

      await deployer.link(BatchVerifier, BlockVerifier);
      await deployer.deploy(BlockVerifier);
      await deployer.deploy(AgentRegistry);
      await deployer.deploy(FastWithdrawalAgent);
    });
  }
};
