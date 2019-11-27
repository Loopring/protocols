var Migrations = artifacts.require("./Migrations.sol");

module.exports = function(deployer, network, accounts) {
  console.log("deploying to network: " + network);
  deployer
    .then(() => {
      return Promise.all([deployer.deploy(Migrations)]);
    })
    .then(() => {
      console.log(">>>>>>>> contracts deployed by initial_migration:");
      console.log("Migrations:", Migrations.address);
      console.log("");
    });
};
