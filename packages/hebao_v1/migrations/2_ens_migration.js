const ethers = require("ethers");

var BaseENSManager = artifacts.require("./thirdparty/ens/BaseENSManager.sol");
var ENSRegistry = artifacts.require("./ENSRegistryImpl.sol");
var ENSResolver = artifacts.require("./BaseENSResolver.sol");
var ENSReverseRegistrar = artifacts.require("./ENSReverseRegistrarImpl.sol");

var root = "eth";
var subName = "loopring";
var fullName = subName + "." + root;
var rootNode = ethers.utils.namehash(fullName);

const deployedEnsManagerAddr = process.env.BaseENSManager || "";

module.exports = function(deployer, network, accounts) {
  if (web3.utils.isAddress(deployedEnsManagerAddr.toLowerCase())) {
    console.log("use deployed ensManager:", deployedEnsManagerAddr);
  } else {
    const deployerAddress = accounts[0];

    deployer
      .then(() => {
        return Promise.all([
          deployer.deploy(ENSRegistry),
          deployer.deploy(ENSResolver)
        ]);
      })
      .then(() => {
        return Promise.all([
          deployer.deploy(
            ENSReverseRegistrar,
            ENSRegistry.address,
            ENSResolver.address
          ),
          deployer.deploy(
            BaseENSManager,
            fullName,
            rootNode,
            ENSRegistry.address,
            ENSResolver.address
          )
        ]);
      })
      .then(() => {
        ENSRegistry.deployed().then(ensRegistry => {
          return Promise.all([
            ensRegistry.setSubnodeOwner(
              "0x0",
              web3.utils.keccak256(root),
              deployerAddress
            ),
            ensRegistry.setSubnodeOwner(
              ethers.utils.namehash(root),
              web3.utils.keccak256(subName),
              BaseENSManager.address
            ),
            ensRegistry.setSubnodeOwner(
              "0x0",
              web3.utils.keccak256("reverse"),
              deployerAddress
            ),
            ensRegistry.setSubnodeOwner(
              ethers.utils.namehash("reverse"),
              web3.utils.keccak256("addr"),
              ENSReverseRegistrar.address
            )
          ]);
        });
      })
      .then(() => {
        ENSResolver.deployed().then(ensResolver => {
          return Promise.all([ensResolver.addManager(BaseENSManager.address)]);
        });
      });
  }
};
