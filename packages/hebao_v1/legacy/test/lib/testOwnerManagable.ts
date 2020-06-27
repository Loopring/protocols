import BN = require("bn.js");
import { getEventsFromContract, assertEventEmitted } from "../../util/Events";
import { expectThrow } from "../../util/expectThrow";

const OwnerManagable = artifacts.require("OwnerManagable");

contract("OwnerManagable", (accounts: string[]) => {
  it("should be able to add and delete manager by owner", async () => {
    const ownerManagable = await OwnerManagable.new();
    const owner = accounts[0];
    const address1 = web3.eth.accounts.create().address;
    await ownerManagable.addManager(address1, { from: owner });
    const isManager = await ownerManagable.isManager(address1);
    assert.equal(true, isManager, "add manager failed");

    await ownerManagable.removeManager(address1, { from: owner });
    const isManager2 = await ownerManagable.isManager(address1);
    assert.equal(false, isManager2, "remove manager failed");
  });

  it("should not be able to add or delete manager by any other addresses", async () => {
    const ownerManagable = await OwnerManagable.new();
    const owner = accounts[0];
    const other = accounts[1];
    const address1 = web3.eth.accounts.create().address;
    await expectThrow(
      ownerManagable.addManager(address1, { from: other }),
      "UNAUTHORIZED"
    );
    await ownerManagable.addManager(address1, { from: owner });

    await expectThrow(
      ownerManagable.removeManager(address1, { from: other }),
      "UNAUTHORIZED"
    );
  });
});
