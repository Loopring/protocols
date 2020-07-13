var SignedRequest = artifacts.require("SignedRequest");

module.exports = function(deployer) {
  deployer.then(() => {
    return Promise.all([deployer.deploy(SignedRequest)]);
  });
};
