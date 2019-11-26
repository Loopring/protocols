var LoopringENSResolver = artifacts.require("./LoopringENSResolver.sol");
var ENSManager = artifacts.require("./ENSManager.sol");

module.exports = function(deployer, network, accounts) {
  console.log("deploying to network: " + network);
  deployer
    .then(() => {
      return Promise.all([deployer.deploy(LoopringENSResolver)]);
    })
    .then(resolver => {
      var rootName = "tokenbank.io";
      var rootNode = web3.utils.sha3(rootName);
      var ensResolver = resolver.address;
      var ensRegistry = deployer.ens.registryAddress;
      console.log("ensRegistry");

      return deployer.deploy(
        ENSManager,
        rootName,
        rootNode,
        ensResolver,
        ensRegistry
      );
    })
    .then(ensManager => {
      console.log(">>>>>>>> contracts deployed by ens_migration:");
      console.log("LoopringENSResolver:", LoopringENSResolver.address);
      console.log("ENSManager:", ensManager.address);
      console.log("");
    });
};
