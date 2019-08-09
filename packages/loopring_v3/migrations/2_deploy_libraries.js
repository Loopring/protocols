// Deploy all libraries that are shared by/linked from other contracts.
// The purpose of deploying these libraries stand-alone is to reduce gas
// usage in deploying other contracts.

var AddressUtil = artifacts.require("./lib/AddressUtil.sol");
var ERC20SafeTransfer = artifacts.require("./lib/ERC20SafeTransfer.sol");
var MathUint = artifacts.require("./lib/MathUint.sol");

module.exports = function(deployer, network, accounts) {
  if (network === "live") {
    // ignore.
  } else {
    deployer
      .then(() => {
        return Promise.all([
          deployer.deploy(AddressUtil),
          deployer.deploy(ERC20SafeTransfer),
          deployer.deploy(MathUint)
        ]);
      })
      .then(() => {
        console.log(">>>>>>>> Deployed contracts addresses (deploy_libs):");
        console.log("AddressUtil:", AddressUtil.address);
        console.log("ERC20SafeTransfer:", ERC20SafeTransfer.address);
        console.log("MathUint:", MathUint.address);
        console.log("");
      });
  }
};
