const NftContract = artifacts.require("./CounterfactualNFT.sol");
const NFTFactory = artifacts.require("./NFTFactory.sol");

module.exports = async (deployer, network, addresses) => {
  console.log("Deploying to " + network);

  const loopringExchangeAddress = "0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4";

  await deployer.deploy(NftContract, loopringExchangeAddress, {gas: 5000000});
  const nft = await NftContract.deployed();

  await deployer.deploy(NFTFactory, nft.address, {gas: 5000000});
  const factory = await NftContract.deployed();

  console.log("factory address: " + factory.address);
  console.log("implementation address: " + nft.address);
};
