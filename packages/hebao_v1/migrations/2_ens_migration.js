const ethers = require("ethers");

var ENSManager = artifacts.require("./thirdparty/ens/BaseENSManager.sol");
var ENSRegistry = artifacts.require("./thirdparty/ens/ENSRegistryImpl.sol");
var ENSResolver = artifacts.require("./thirdparty/ens/BaseENSResolver.sol");
var ENSReverseRegistrar = artifacts.require(
  "./thirdparty/ens/ENSReverseRegistrarImpl.sol"
);

var root = "eth";
var subName = "loopring";
var fullName = subName + "." + root;
var rootNode = ethers.utils.namehash(fullName);

const ensManagerAddr = process.env.ENSManager || "";

module.exports = function(deployer, network, accounts) {
  if (web3.utils.isAddress(ensManagerAddr.toLowerCase())) {
    console.log("use deployed ensManager:", ensManagerAddr);
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
            ENSManager,
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
              ENSManager.address
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
          return Promise.all([ensResolver.addManager(ENSManager.address)]);
        });
      });
  }
};
