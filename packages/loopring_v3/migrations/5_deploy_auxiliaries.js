// // Deploy all auxiliary contracts used by either Exchange, LoopringV3,
// // or ProtocolRegistry.

// var DowntimeCostCalculator = artifacts.require(
//   "./impl/DowntimeCostCalculator.sol"
// );

// var lrcAddress = "0xBBbbCA6A901c926F240b89EacB641d8Aec7AEafD";
// var wethAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
// var protocolFeeValutAddress = "0xa8b6A3EFBcdd578154a913F33dc9949808B7A9f4";
// var userStakingPoolAddress = "undeployed";

// module.exports = function(deployer, network, accounts) {
//   var deployer_ = deployer;

//   if (network != "live" && network != "ropsten") {
//     DowntimeCostCalculator = artifacts.require(
//       "./test/FixPriceDowntimeCostCalculator.sol"
//     );

//     const LRCToken = artifacts.require("./test/tokens/LRC.sol");
//     const WETHToken = artifacts.require("./test/tokens/WETH.sol");

//     deployer_ = deployer_
//       .then(() => {
//         return Promise.all([
//           LRCToken.deployed().then(addr => {
//             lrcAddress = addr;
//           }),
//           WETHToken.deployed().then(addr => {
//             wethAddress = addr;
//           })
//         ]);
//       })
//       .then(() => {
//         const UserStakingPool = artifacts.require("./impl/UserStakingPool");
//         return Promise.all([
//           deployer.deploy(UserStakingPool, lrcAddress).then(addr => {
//             userStakingPoolAddress = addr;
//           })
//         ]);
//       });
//   }

//   // common deployment

//   const BlockVerifier = artifacts.require("./impl/BlockVerifier.sol");
//   const ProtocolFeeVault = artifacts.require("./impl/ProtocolFeeVault");

//   deployer_
//     .then(() => {
//       return Promise.all([
//         deployer.deploy(BlockVerifier),
//         deployer.deploy(DowntimeCostCalculator)
//       ]);
//     })
//     .then(() => {
//       return Promise.all([
//         deployer.deploy(ProtocolFeeVault, lrcAddress, userStakingPoolAddress)
//       ]);
//     })
//     .then(() => {
//       console.log(">>>>>>>> contracts deployed by deploy_aux:");
//       console.log("lrcAddress:", lrcAddress);
//       console.log("wethAddress:", wethAddress);
//       console.log("protocolFeeValutAddress:", protocolFeeValutAddress);
//       console.log("userStakingPoolAddress:", userStakingPoolAddress);
//       console.log("BlockVerifier:", BlockVerifier.address);
//       console.log("DowntimeCostCalculator:", DowntimeCostCalculator.address);
//       console.log("ProtocolFeeVault:", ProtocolFeeVault.address);
//       console.log("");
//     });
// };
