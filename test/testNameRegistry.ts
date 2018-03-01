import { Artifacts } from "../util/artifacts";

const {
  NameRegistry,
} = new Artifacts(artifacts);

contract("NameRegistry", (accounts: string[]) => {
  const user = accounts[1];

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

  });

});
