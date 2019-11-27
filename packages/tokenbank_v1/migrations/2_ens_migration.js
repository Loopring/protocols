var ENSResolver = artifacts.require("./ArgentENSResolver.sol");
var ENSManager = artifacts.require("./ENSManager.sol");

module.exports = function(deployer, network, accounts) {
  console.log("deploying to network: " + network);
  deployer
    .then(() => {
      return Promise.all([deployer.deploy(ENSResolver)]);
    })
    .then(() => {
      var rootName = "tokenbank.io";
      var rootNode = web3.utils.sha3(rootName);
      var ensResolver = ENSResolver.address;
      //TODO: fix this: deployer.ens.registryAddress;
      var ensRegistry = deployer.ens.ensSettings.registryAddress;
      console.log("deployer:", deployer);

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
