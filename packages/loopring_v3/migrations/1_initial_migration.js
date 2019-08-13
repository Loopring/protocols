var Migrations = artifacts.require("./Migrations.sol");

module.exports = function(deployer) {
  console.log("   > deploying to network: " + network);
  deployer.deploy(Migrations);
};
