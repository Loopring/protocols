const ethers = require("ethers");

var BaseENSManager = artifacts.require("BaseENSManager");
var ENSRegistryImpl = artifacts.require("ENSRegistryImpl");
var BaseENSResolver = artifacts.require("BaseENSResolver");
var ENSReverseRegistrarImpl = artifacts.require("ENSReverseRegistrarImpl");

var root = "eth";
var subName = "loopring";
var fullName = subName + "." + root;
var rootNode = ethers.utils.namehash(fullName);

const ensManagerAddr = process.env.ENSManager || "";
const isEnsManagerAddressConfigured = web3.utils.isAddress(
  ensManagerAddr.toLowerCase()
);

module.exports = function(deployer, network, accounts) {
  if (!isEnsManagerAddressConfigured) {
    deployer.then(async () => {
      await deployer.deploy(ENSRegistryImpl);
      await deployer.deploy(BaseENSResolver);
      await deployer.deploy(
        ENSReverseRegistrarImpl,
        ENSRegistryImpl.address,
        BaseENSResolver.address
      );

      await deployer.deploy(
        BaseENSManager,
        fullName,
        rootNode,
        ENSRegistryImpl.address,
        BaseENSResolver.address
      );

      const ensRegistry = await ENSRegistryImpl.deployed();
      const ensResolver = await BaseENSResolver.deployed();

      await ensRegistry.setSubnodeOwner(
        "0x" + "00".repeat(20),
        web3.utils.keccak256(root),
        accounts[0]
      );
      await ensRegistry.setSubnodeOwner(
        ethers.utils.namehash(root),
        web3.utils.keccak256(subName),
        BaseENSManager.address,
        { from: accounts[0] }
      );
      await ensRegistry.setSubnodeOwner(
        "0x" + "00".repeat(20),
        web3.utils.keccak256("reverse"),
        accounts[0]
      );
      await ensRegistry.setSubnodeOwner(
        ethers.utils.namehash("reverse"),
        web3.utils.keccak256("addr"),
        ENSReverseRegistrarImpl.address,
        { from: accounts[0] }
      );
      await ensResolver.addManager(BaseENSManager.address);
    });
  }
};
