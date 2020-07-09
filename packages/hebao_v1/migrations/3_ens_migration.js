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
        ENSRegistryImpl.deployed().then(ensRegistry => {
          return Promise.all([
            ensRegistry.setSubnodeOwner(
              "0x0",
              web3.utils.keccak256(root),
              accounts[0]
            ),
            ensRegistry.setSubnodeOwner(
              ethers.utils.namehash(root),
              web3.utils.keccak256(subName),
              BaseENSManager.address
            ),
            ensRegistry.setSubnodeOwner(
              "0x0",
              web3.utils.keccak256("reverse"),
              accounts[0]
            ),
            ensRegistry.setSubnodeOwner(
              ethers.utils.namehash("reverse"),
              web3.utils.keccak256("addr"),
              ENSReverseRegistrarImpl.address
            )
          ]);
        });
      })
      .then(() => {
        BaseENSResolver.deployed().then(ensResolver => {
          return Promise.all([ensResolver.addManager(BaseENSManager.address)]);
        });
      });
  }
};
