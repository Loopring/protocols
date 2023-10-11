import { ethers } from "hardhat";
import { expect } from "chai";


describe("trade agent test", () => {
  it("mainnet fork test", async () => {
    const KRAKEN_ADDRESS = '0xDA9dfA130Df4dE4673b89022EE50ff26f6EA73Cf'
    const RANDOM_ADDRESS = ethers.Wallet.createRandom().address
    const b = await ethers.provider.getBalance(RANDOM_ADDRESS)
    const impersonatedSigner = await ethers.getImpersonatedSigner(KRAKEN_ADDRESS);
    await (await impersonatedSigner.sendTransaction({
      to: RANDOM_ADDRESS,
      value: ethers.utils.parseEther('1')
    })).wait()
    const b2 = await ethers.provider.getBalance(RANDOM_ADDRESS)
    expect(b2.sub(b)).eq(ethers.utils.parseEther('1'))
  })
  
});

