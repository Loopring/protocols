const hre = require("hardhat");
const ethers = hre.ethers;

async function main() {
  const txCount = await ethers.provider.getTransactionCount(
    "0x32C03aD6a42b8572bB2c317076ee48f904A580c4"
  );
  console.log("txCount:", txCount);
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
