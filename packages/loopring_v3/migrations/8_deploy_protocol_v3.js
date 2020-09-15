// Deploy protocol: LoopringV3

const LRCToken = artifacts.require("./test/tokens/LRC.sol");
const ProtocolFeeVault = artifacts.require("ProtocolFeeVault");
const UniversalRegistry = artifacts.require("UniversalRegistry");
const BlockVerifier = artifacts.require("BlockVerifier");
const ExchangeV3 = artifacts.require("ExchangeV3");
const LoopringV3 = artifacts.require("LoopringV3");

module.exports = function(deployer, network, accounts) {
  if (network != "live" && network != "live-fork") {
    deployer.then(async () => {
      await deployer.deploy(
        LoopringV3,
        UniversalRegistry.address,
        LRCToken.address,
        ProtocolFeeVault.address,
        BlockVerifier.address
      );

      const universalRegistry = await UniversalRegistry.deployed();
      universalRegistry.registerProtocol(
        LoopringV3.address,
        ExchangeV3.address
      );
    });
  }
};
