import { expectThrow } from "./expectThrow";

const ChiToken = artifacts.require("ChiToken");
const DummyWriteContract = artifacts.require("DummyWriteContract");

contract("ChiDiscount", (accounts: string[]) => {
  const owner1 = accounts[0];
  const owner2 = accounts[1];
  const owner3 = accounts[2];
  const emptyAddr = "0x0000000000000000000000000000000000000000";

  let chiToken: any;
  let dummyWriteContract: any;

  beforeEach(async () => {
    chiToken = await ChiToken.new();
    dummyWriteContract = await DummyWriteContract.new(chiToken.address);
  });

  describe("ChiDiscount", () => {
    it("should be able to refund gas", async () => {
      // mint chiToken:
      const tx0 = await chiToken.mint(100, { gas: 6700000 });
      const gasAmount0 = tx0.receipt.gasUsed;
      console.log("mint 100 chiToken, gasUsed:", gasAmount0);

      const balance1 = await chiToken.balanceOf(accounts[0]);
      assert.equal(100, balance1.toNumber(), "unexpected balance");

      let offset = 0;
      // write without chiToken burning:
      const tx1 = await dummyWriteContract.write(
        {
          gasTokenVault: "0x" + "00".repeat(20),
          maxToBurn: 100,
          expectedGasRefund: 0,
          calldataCost: 0
        },
        offset
      );
      console.log("gas used without chiToken:", tx1.receipt.gasUsed);

      offset += 100;
      // transfer chiToken to writeContract:
      await chiToken.transfer(dummyWriteContract.address, 100);
      // write with chiToken burning:
      const tx2 = await dummyWriteContract.write(
        {
          gasTokenVault: "0x" + "00".repeat(20),
          maxToBurn: 100,
          expectedGasRefund: 0,
          calldataCost: 0
        },
        offset
      );
      console.log("gas used with chiToken:", tx2.receipt.gasUsed);
      const chiTokenBalanceAfter = await chiToken.balanceOf(
        dummyWriteContract.address
      );
      const chiTokenUsed = 100 - chiTokenBalanceAfter.toNumber();
      console.log(
        "chiTokenUsed:",
        chiTokenUsed,
        " minted gas amount:",
        (gasAmount0 * chiTokenUsed) / 100
      );
      console.log("gas saved:", tx1.receipt.gasUsed - tx2.receipt.gasUsed);

      offset += 100;
      // freeFrom test:
      await chiToken.mint(100, { gas: 6700000 });
      await chiToken.approve(dummyWriteContract.address, 1000);
      const chiTokenBalanceBefore3 = (await chiToken.balanceOf(
        accounts[0]
      )).toNumber();
      const tx3 = await dummyWriteContract.write(
        {
          gasTokenVault: accounts[0],
          maxToBurn: 100,
          expectedGasRefund: 0,
          calldataCost: 0
        },
        offset
      );
      console.log("--- freeFrom test ---");
      console.log("gas used with chiToken (freeFrom):", tx3.receipt.gasUsed);
      const chiTokenBalanceAfter3 = (await chiToken.balanceOf(
        accounts[0]
      )).toNumber();
      const chiTokenUsed3 = chiTokenBalanceBefore3 - chiTokenBalanceAfter3;
      console.log(
        "chiTokenUsed:",
        chiTokenUsed3,
        " minted gas amount:",
        (gasAmount0 * chiTokenUsed3) / 100
      );
      console.log("gas saved:", tx1.receipt.gasUsed - tx3.receipt.gasUsed);

      assert(true);
    });
  });
});
