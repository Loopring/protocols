require("dotenv").config({ path: require("find-config")(".env") });
const ethers = require("ethers");

var Migrations = artifacts.require("./Migrations.sol");
var ENSResolver = artifacts.require("./BaseENSResolver.sol");
var ENSManager = artifacts.require("./WalletENSManager.sol");
var ENSRegistry = artifacts.require("./ENSRegistryImpl.sol");
var ENSReverseRegistrar = artifacts.require("./ENSReverseRegistrarImpl.sol");

var root = "eth";
var subName = "loopring";
var fullName = subName + "." + root;
var rootNode = ethers.utils.namehash(fullName);

var deployerAddress = "0x";

const deployedEnsManagerAddr = process.env.ENSManager || "";

module.exports = function(deployer, network) {
  console.log("deploying to network: " + network);
  console.log("deployer:", deployer.address);

  if (web3.utils.isAddress(deployedEnsManagerAddr.toLowerCase())) {
    console.log("use deployed ensManager:", deployedEnsManagerAddr);
  } else {
    deployer
      .then(() => {
        Migrations.deployed().then(migrations => {
          migrations.owner().then(owner => {
            deployerAddress = owner;
            console.log("migrate owner:", owner);
          });
        });
      })
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
          )
        ]);
      })
      .then(() => {
        var ensResolver = ENSResolver.address;
        //var ensRegistry = deployer.ens.ensSettings.registryAddress;
        var ensRegistry = ENSRegistry.address;
        console.log("ensRegistry: " + ensRegistry);
        console.log(deployerAddress);

        return Promise.all([
          deployer.deploy(
            ENSManager,
            fullName,
            rootNode,
            ensRegistry,
            ensResolver
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
            )
          ]);
        });
      })
      .then(() => {
        ENSRegistry.deployed().then(ensRegistry => {
          return Promise.all([
            ensRegistry.setSubnodeOwner(
              ethers.utils.namehash(root),
              web3.utils.keccak256(subName),
              ENSManager.address
            )
          ]);
        });
      })
      .then(() => {
        ENSRegistry.deployed().then(ensRegistry => {
          return Promise.all([
            ensRegistry.setSubnodeOwner(
              "0x0",
              web3.utils.keccak256("reverse"),
              deployerAddress
            )
          ]);
        });
      })
      .then(() => {
        ENSRegistry.deployed().then(ensRegistry => {
          return Promise.all([
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
      })
      .then(() => {
        console.log(">>>>>>>> contracts deployed by ens_migration:");
        console.log("ENSResolver:", ENSResolver.address);
        console.log("ENSManager:", ENSManager.address);
        console.log("");
      });
  }
};
