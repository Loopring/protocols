import { expectThrow } from "./expectThrow";

const Ownable = artifacts.require("Ownable");

contract("Ownable", (accounts: string[]) => {
  const owner1 = accounts[0];
  const owner2 = accounts[1];
  const emptyAddr = "0x0000000000000000000000000000000000000000";

  let ownable: any;

  beforeEach(async () => {
    ownable = await Ownable.new({ from: owner1 });
  });

  describe("owner", () => {
    it("should be able to transfer ownership", async () => {
      await ownable.transferOwnership(owner2, { from: owner1 });
      const contractOwner = await ownable.owner();
      assert.equal(contractOwner, owner2, "Owner should new owner");
    });

    it("should not be able to transfer ownership to an invalid address", async () => {
      await expectThrow(ownable.transferOwnership(emptyAddr), "ZERO_ADDRESS");
    });
  });

  describe("anyone", () => {
    it("should be able to get the owner", async () => {
      const contractOwner = await ownable.owner();
      assert.equal(contractOwner, owner1, "Owner should match expected value");
    });

    it("should not be able to transfer ownership", async () => {
      await expectThrow(
        ownable.transferOwnership(owner2, { from: owner2 }),
        "UNAUTHORIZED"
      );
    });
  });
});
