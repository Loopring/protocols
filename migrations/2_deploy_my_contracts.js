// var LoopringToken = artifacts.require("./LoopringToken.sol")
var TestToken = artifacts.require("./TestToken.sol")
var MidTerm = artifacts.require("incentive_programs/LRCMidTermHoldingContract.sol")
var LongTerm = artifacts.require("incentive_programs/LRCLongTermHoldingContract.sol")

module.exports = function(deployer, network, accounts) {
	console.log("network: " + network);
	
    if (network == "live") {
    	var lrcAddress = "0xEF68e7C694F40c8202821eDF525dE3782458639f";
        deployer.deploy(MidTerm, lrcAddress, "0x9167E8B2EeD2418Fa520C8C036d73ceE6b88aFE9"); // Change this address
        deployer.deploy(LongTerm, lrcAddress); // Change this address

    } else {
    	deployer.deploy(TestToken)
    	.then(function() {
		  	return deployer.deploy(
		  		MidTerm, 
		  		TestToken.address, 
		  		accounts[0]);
		})
		.then(function(){
			return deployer.deploy(
				LongTerm, 
				TestToken.address);
		});
    }
};