var ENSResolver = artifacts.require("./BaseENSResolver.sol");
var ENSManager = artifacts.require("./WalletENSManager.sol");

module.exports = function(deployer, network) {
  console.log("deploying to network: " + network);
  deployer
    .then(() => {
      return Promise.all([deployer.deploy(ENSResolver)]);
    })
    .then(() => {
      var rootName = "hebao.io";
      var rootNode = web3.utils.sha3(rootName);
      var ensResolver = ENSResolver.address;
      var ensRegistry = deployer.ens.ensSettings.registryAddress;

      return Promise.all([
        deployer.deploy(
          ENSManager,
          rootName,
          rootNode,
          ensResolver,
          ensRegistry
        )
      ]);
    })
    .then(() => {
      console.log(">>>>>>>> contracts deployed by ens_migration:");
      console.log("ENSResolver:", ENSResolver.address);
      console.log("ENSManager:", ENSManager.address);
      console.log("");
    });
};
