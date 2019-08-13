// Deploy libraries with public methods that are shared by/linked from other contracts.
// Libraries with only privat eor internal methods should not be deployed independently.
// The purpose of deploying these libraries stand-alone is to reduce gas usage in deploying
/// other contracts.

module.exports = function(deployer, network, accounts) {
  // console.log("deploying to network: " + network);
};
