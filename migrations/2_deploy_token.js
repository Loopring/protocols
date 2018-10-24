const NewLRCToken = artifacts.require("./NewLRCToken.sol")

module.exports = function(deployer) {
	deployer.deploy(NewLRCToken, "Loopring", "NLRC", 1, 139507605000000000000000000, ["0xcda84c2ff6c5d8d4572c68c3a43ed63060d55349"], "0xcda84c2ff6c5d8d4572c68c3a43ed63060d55349");
};
