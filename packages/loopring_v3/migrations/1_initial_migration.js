var Migrations = artifacts.require("Migrations");

module.exports = function(deployer, network, accounts) {
  deployer.then(async () => {
    await deployer.deploy(Migrations);
  });
};
