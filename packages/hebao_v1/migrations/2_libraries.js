var SignedRequest = artifacts.require("SignedRequest");

module.exports = function(deployer) {
  deployer.then(async () => {
    await deployer.deploy(SignedRequest);
  });
};
