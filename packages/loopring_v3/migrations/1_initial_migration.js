var Migrations = artifacts.require("./Migrations");

module.exports = function(deployer, network, accounts) {
  console.log("   > deploying to network: " + network);
  deployer
    .then(() => {
      return Promise.all([deploy(Migrations)]);
    })
    .then(() => {
      console.log(">>>>>>>> contracts deployed by deploy_registry:");
      console.log("Migrations:", Migrations.address);
      console.log("");
    });
};
