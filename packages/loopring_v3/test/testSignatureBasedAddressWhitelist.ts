import { Bitstream } from "loopringV3.js";
import { ExchangeTestUtil } from "./testExchangeUtil";
const abi = require("ethereumjs-abi");

contract("Exchange", (accounts: string[]) => {
  let exchangeTestUtil: ExchangeTestUtil;
  let newAddressWhitelist: any;

  before(async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
    newAddressWhitelist = await exchangeTestUtil.contracts.AddressWhitelist.new();
    assert(
      newAddressWhitelist.address != 0,
      "newAddressWhitelist.address == 0."
    );
  });

  const generatePermissionBytes = async (
    now: any,
    address: any,
    signer: any
  ) => {
    const bitstream = new Bitstream();

    const hashMsg =
      "0x" +
      abi
        .soliditySHA3(
          ["string", "address", "uint"],
          ["LOOPRING_DEX_ACCOUNT_CREATION", address, now]
        )
        .toString("hex");
    const rsv = await web3.eth.sign(hashMsg, signer);
    bitstream.addHex(rsv);
    bitstream.addNumber(now, 8);

    // console.log("permission data:", bitstream.getData());
    const permission = web3.utils.hexToBytes(bitstream.getData());
    assert(
      permission.length == 73,
      "permission.length should be 73(t8+sign65)"
    );
    return permission;
  };

  describe("AddressWhitelist functionality unit test", () => {
    it("check isAddressWhitelisted basic logic", async () => {
      const deployer = exchangeTestUtil.testContext.deployer;
      const realAccount = exchangeTestUtil.testContext.orderOwners[0];
      const fakeAccount = exchangeTestUtil.testContext.orderOwners[1];
      const now = Math.floor(Date.now() / 1000);
      const permission = await generatePermissionBytes(
        now,
        realAccount,
        deployer
      );

      var ret = await newAddressWhitelist.isAddressWhitelisted(
        realAccount,
        permission
      );
      assert(ret, "isAddressWhitelisted(realOwner, permission) failed.");

      ret = await newAddressWhitelist.isAddressWhitelisted(
        fakeAccount,
        permission
      );
      assert(!ret, "fakeAccount's request should not pass.");
    });

    it("check isAddressWhitelisted fail conditions", async () => {
      const deployer = exchangeTestUtil.testContext.deployer;
      const realAccount = exchangeTestUtil.testContext.orderOwners[0];

      var date = new Date();
      var past = Math.floor(date.setDate(date.getHours() - 25) / 1000);
      var permission = await generatePermissionBytes(
        past,
        realAccount,
        deployer
      );

      var ret = await newAddressWhitelist.isAddressWhitelisted(realAccount, []);
      assert(!ret, "Wrong permission should not pass check.");

      ret = await newAddressWhitelist.isAddressWhitelisted(
        realAccount,
        permission
      );
      assert(!ret, "Requests happened 1 day ago should not pass.");

      permission[7] = 2;
      ret = await newAddressWhitelist.isAddressWhitelisted(
        realAccount,
        permission
      );
      assert(!ret, "v is not in [0, 1] should not pass.");
    });
  });
});
