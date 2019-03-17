const ERC820Registry = artifacts.require("./ERC820Registry.sol")
const NewLRCToken = artifacts.require("./NewLRCToken.sol")

module.exports = function(deployer) {
  deployer.deploy(ERC820Registry).then(() => {
    return deployer.deploy(NewLRCToken,
                           "Loopring",
                           "LRC",
                           1,
                           139507605000000000000000000,
                           [],
                           ERC820Registry.address);
  });


};
