// Deploy libraries with public methods that are shared by/linked from other contracts.
// Libraries with only privat eor internal methods should not be deployed independently.
// The purpose of deploying these libraries stand-alone is to reduce gas usage in deploying
/// other contracts.

// var AddressUtil = artifacts.require("./lib/AddressUtil.sol");
// var ERC20SafeTransfer = artifacts.require("./lib/ERC20SafeTransfer.sol");
// var MathUint = artifacts.require("./lib/MathUint.sol");

module.exports = function(deployer, network, accounts) {
  console.log("   > deploying to network: " + network);
  if (network !== "live") {
    // deployer
    //   .then(() => {
    //     return Promise.all([
    //       deployer.deploy(AddressUtil),
    //       deployer.deploy(ERC20SafeTransfer),
    //       deployer.deploy(MathUint)
    //     ]);
    //   })
    //   .then(() => {
    //     console.log(">>>>>>>> contracts deployed by deploy_libs:");
    //     console.log("AddressUtil:", AddressUtil.address);
    //     console.log("ERC20SafeTransfer:", ERC20SafeTransfer.address);
    //     console.log("MathUint:", MathUint.address);
    //     console.log("");
    //   });
  }
};
