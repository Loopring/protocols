import { expectThrow } from "./expectThrow";

const Claimable = artifacts.require("Claimable");

contract("Claimable", (accounts: string[]) => {
  const owner1 = accounts[0];
  const owner2 = accounts[1];
  const owner3 = accounts[2];
  const emptyAddr = "0x0000000000000000000000000000000000000000";

  let claimable: any;

  beforeEach(async () => {
    claimable = await Claimable.new({ from: owner1 });
  });

  describe("owner", () => {
    it("should be able to transfer ownership", async () => {
      await claimable.transferOwnership(owner2, { from: owner1 });
      const contractOwner = await claimable.pendingOwner();
      assert.equal(
        contractOwner,
        owner2,
        "Ownership should be pending for the new owner"
      );
    });

    it("should not be able to transfer ownership to an invalid address", async () => {
      await expectThrow(
        claimable.transferOwnership(emptyAddr),
        "INVALID_ADDRESS"
      );
    });

    it("should not be able to transfer ownership to the current owner", async () => {
      await expectThrow(claimable.transferOwnership(owner1), "INVALID_ADDRESS");
    });
  });

  describe("pending owner", () => {
    beforeEach(async () => {
      await claimable.transferOwnership(owner2, { from: owner1 });
    });

    it("should be able to claim ownership", async () => {
      await claimable.claimOwnership({ from: owner2 });
      const contractOwner = await claimable.owner();
      assert.equal(contractOwner, owner2, "Owner should match expected value");
    });
  });

  describe("anyone", () => {
    it("should not be able to transfer ownership", async () => {
      await expectThrow(
        claimable.transferOwnership(owner2, { from: owner2 }),
        "UNAUTHORIZED"
      );
    });

    it("should not be able to claim ownership", async () => {
      await claimable.transferOwnership(owner2, { from: owner1 });
      await expectThrow(
        claimable.claimOwnership({ from: owner3 }),
        "UNAUTHORIZED"
      );
    });
  });
});
