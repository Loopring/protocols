import { ethers } from "hardhat";

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  // stakingBridge on mainnet:
  const stakingBridgeAddress = "0x199CA6e284F344210F9A3090d1eaf7D3B88Ca079";
  const stakingBridge = await ethers.getContractAt(
    "StakingBridge",
    stakingBridgeAddress
  );

  /*
      0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4
      0xb1a417f4

      lido stake：
      0xae7ab96520de3a18e5e111b5eaab095312d7fe84
      0xa1903eab
      0x095ea7b3

      lido wrap/unwrap:
      0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0
      0xea598cb0
      0xde0e9a3e
      0x095ea7b3

      curve swap：
      0xdc24316b9ae028f1497c275eb9192a3ea0f67022
      0x3df02124

    */
  const methods = [
    // ["0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4", "0xb1a417f4"],
    // ["0xae7ab96520de3a18e5e111b5eaab095312d7fe84", "0xa1903eab"],
    ["0xae7ab96520de3a18e5e111b5eaab095312d7fe84", "0x095ea7b3"],
    ["0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0", "0xea598cb0"],
    ["0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0", "0xde0e9a3e"],
    ["0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0", "0x095ea7b3"],
    ["0xdc24316b9ae028f1497c275eb9192a3ea0f67022", "0x3df02124"]
  ];

  for (const [target, method] of methods) {
    console.log(target, method);
    const tx = await stakingBridge.authorizeCall(
      target,
      method /*, { nonce: 2395, gasPrice: 10e9 }*/
    );
    await tx.wait();
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
