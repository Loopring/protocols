const ethers = require("ethers");

var BaseENSManager = artifacts.require("BaseENSManager");
var ENSRegistryImpl = artifacts.require("ENSRegistryImpl");
var BaseENSResolver = artifacts.require("BaseENSResolver");
var ENSReverseRegistrarImpl = artifacts.require("ENSReverseRegistrarImpl");

var root = "eth";
var subName = "loopring";
var fullName = subName + "." + root;
var rootNode = ethers.utils.namehash(fullName);

let ensManagerAddr = process.env.ENSManager || "";

module.exports = function(deployer, network, accounts) {
  if (!web3.utils.isAddress(ensManagerAddr.toLowerCase())) {
    deployer
      .then(() => {
        return Promise.all([
          deployer.deploy(ENSRegistryImpl),
          deployer.deploy(BaseENSResolver)
        ]);
      })
      .then(() => {
        return Promise.all([
          deployer.deploy(
            ENSReverseRegistrarImpl,
            ENSRegistryImpl.address,
            BaseENSResolver.address
          ),
          deployer.deploy(
            BaseENSManager,
            fullName,
            rootNode,
            ENSRegistryImpl.address,
            BaseENSResolver.address
          )
        ]);
      })
      .then(() => {
        return Promise.all([
          BaseENSResolver.deployed().then(ensResolver => {
            return Promise.all([
              ensResolver.addManager(BaseENSManager.address)
            ]);
          })
        ]);
      });
  }
};
