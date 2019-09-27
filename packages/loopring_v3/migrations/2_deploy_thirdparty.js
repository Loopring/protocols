const Cloneable = artifacts.require("./thirdparty/Cloneable.sol");
const BatchVerifier = artifacts.require("./thirdparty/BatchVerifier.sol");

module.exports = function(deployer, network, accounts) {
  console.log("deploying to network: " + network);
  var deployer_ = deployer;

  // common deployment

  deployer_
    .then(() => {
      return Promise.all([
        deployer.deploy(Cloneable),
        deployer.deploy(BatchVerifier)
      ]);
    })
    .then(() => {
      console.log(">>>>>>>> contracts deployed by deploy_thirdparty:");
      console.log("Cloneable:", Cloneable.address);
      console.log("BatchVerifier:", BatchVerifier.address);
      console.log("");
    });
};
