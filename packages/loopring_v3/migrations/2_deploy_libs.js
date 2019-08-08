var AddressUtil = artifacts.require("./lib/LRC.sol");
var ERC20SafeTransfer = artifacts.require("./lib/ERC20SafeTransfer.sol");
var MathUint = artifacts.require("./lib/MathUint.sol");

module.exports = function(deployer, network, accounts) {
  if (network === "live") {
    // ignore.
    // TODO(kongliang): we should deploy on mainnet using scripts written here.
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
