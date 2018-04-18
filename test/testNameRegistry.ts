import { Artifacts } from "../util/artifacts";

const {
  NameRegistry,
} = new Artifacts(artifacts);

contract("NameRegistry", (accounts: string[]) => {
  const user = accounts[1];
  const user2 = accounts[2];

  let nameRegistry: any;

  before(async () => {
    nameRegistry = await NameRegistry.deployed();
  });

  describe("user", () => {
    it("is able to register a name", async () => {
      const name = "test002";
      await nameRegistry.registerName(name, {from: user});
      const nameOwner = await nameRegistry.getOwner(name);
      // console.log("nameOwner:", nameOwner);
      assert.equal(user, nameOwner);

      const nameRegistried = await nameRegistry.nameMap(user);
      assert.equal(name, nameRegistried);

    });

    it("is able to register a different name", async () => {
      const name = "test003";
      await nameRegistry.registerName(name, {from: user2});
      const nameOwner = await nameRegistry.getOwner(name);
      // console.log("nameOwner:", nameOwner);
      assert.equal(user2, nameOwner);

      const nameRegistried = await nameRegistry.nameMap(user2);
      assert.equal(name, nameRegistried);
    });

    // it("is able to add a address after name had been registeried", async () => {
    //   const name = "test002";
    //   const name2 = "test003";
    //   await nameRegistry.addAddress(user, {from: user});
    //   const pids = await nameRegistry.getParticipantIds(name, 0, 1);
    //   const pid1 = pids[0].toNumber();

    //   await nameRegistry.addAddress(user2, {from: user2});
    //   const pids2 = await nameRegistry.getParticipantIds(name2, 0, 1);
    //   const pid2 = pids2[0].toNumber();

    //   assert.equal(pid1 + 1, pid2, "pid not increased correctly.");
    // });

    // it("is able to unregister a name after name had been registeried", async () => {
    //   const name = "test002";
    //   const tx = await nameRegistry.unregisterName(name, {from: user});
    //   const ownerName = await nameRegistry.getOwner(name);
    //   // console.log("ownerName:", ownerName);
    //   assert.equal("0x0000000000000000000000000000000000000000", ownerName);
    // });

  });

});
