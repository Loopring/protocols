const ERC820Registry = artifacts.require("./ERC820Registry.sol")
const NewLRCToken = artifacts.require("./NewLRCToken.sol")

module.exports = function(deployer) {
  deployer.deploy(ERC820Registry).then(() => {
    return deployer.deploy(NewLRCToken,
                           "Loopring",
                           "LRC",
                           1,
                           139507605000000000000000000,
                           ["0xcda84c2ff6c5d8d4572c68c3a43ed63060d55349"],
                           ERC820Registry.address,
                           "0xcda84c2ff6c5d8d4572c68c3a43ed63060d55349");
  });


};
