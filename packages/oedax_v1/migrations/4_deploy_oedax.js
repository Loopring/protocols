var Oedax = artifacts.require("./impl/Oedax.sol");

module.exports = function(deployer, network, accounts) {
  
  deployer.deploy(Oedax);    

};