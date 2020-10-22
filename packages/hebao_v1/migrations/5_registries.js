const ModuleRegistryImpl = artifacts.require("ModuleRegistryImpl");

module.exports = function(deployer) {
  deployer.then(() => {
    return Promise.all([deployer.deploy(ModuleRegistryImpl)]);
  });
};
