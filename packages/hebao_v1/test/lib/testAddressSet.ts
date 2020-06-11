import BN = require("bn.js");
import { getEventsFromContract, assertEventEmitted } from "../../util/Events";
import { expectThrow } from "../../util/expectThrow";

const AddressSetWrapper = artifacts.require("AddressSetWrapper");

contract("AddressSet", () => {
  describe("addAddressToSet", () => {
    it("should be able to add multiple address to address set ", async () => {
      const addressSetWrapper = await AddressSetWrapper.new();
      const address1 = web3.eth.accounts.create().address;
      const key1 = web3.utils.sha3(address1);
      await addressSetWrapper.add(key1, address1);
      const isInSet1 = await addressSetWrapper.isInSet(key1, address1);
      assert.equal(isInSet1, true, "address not in set after insertion");

      const address2 = web3.eth.accounts.create().address;
      await addressSetWrapper.add(key1, address2);
      const isInSet2 = await addressSetWrapper.isInSet(key1, address2);
      assert.equal(isInSet2, true, "address not in set after insertion");
    });

    it("should not be able to add the same address twice ", async () => {
      const addressSetWrapper = await AddressSetWrapper.new();
      const address1 = web3.eth.accounts.create().address;
      const key1 = web3.utils.sha3(address1);
      await addressSetWrapper.add(key1, address1);
      const isInSet1 = await addressSetWrapper.isInSet(key1, address1);
      assert.equal(isInSet1, true, "address not in set after insertion");
      await expectThrow(
        addressSetWrapper.add(key1, address1),
        "ALREADY_IN_SET"
      );
    });
  });

  describe("removeAddressFromSet", () => {
    it("should be able to remove address in set", async () => {
      const addressSetWrapper = await AddressSetWrapper.new();
      const address1 = web3.eth.accounts.create().address;
      const key1 = web3.utils.sha3(address1);
      await expectThrow(addressSetWrapper.remove(key1, address1), "NOT_IN_SET");

      await addressSetWrapper.add(key1, address1);
      const isInSet1 = await addressSetWrapper.isInSet(key1, address1);
      assert.equal(isInSet1, true, "address not in set after insertion");
      await addressSetWrapper.remove(key1, address1);
      const isInSet2 = await addressSetWrapper.isInSet(key1, address1);
      assert.equal(isInSet2, false, "address still in set after removal");

      const address2 = web3.eth.accounts.create().address;
      await addressSetWrapper.add(key1, address2);
      const isInSet3 = await addressSetWrapper.isInSet(key1, address2);
      assert.equal(isInSet3, true, "address not in set after insertion");
      await addressSetWrapper.remove(key1, address2);
      const isInSet4 = await addressSetWrapper.isInSet(key1, address2);
      assert.equal(isInSet4, false, "address still in set after removal");
    });
  });

  describe("removeSet", () => {
    it("should be able to remove set", async () => {
      const addressSetWrapper = await AddressSetWrapper.new();
      const address1 = web3.eth.accounts.create().address;
      const key1 = web3.utils.sha3(address1);
      await addressSetWrapper.add(key1, address1);
      const numAddressesInSet = await addressSetWrapper.numInSet(key1);
      assert.equal(
        1,
        numAddressesInSet.toNumber(),
        "incorrect address number in set"
      );

      await addressSetWrapper.removeAll(key1);
      const numAddressesInSet2 = await addressSetWrapper.numInSet(key1);
      assert.equal(
        0,
        numAddressesInSet2.toNumber(),
        "incorrect address number in set"
      );
    });
  });
});
