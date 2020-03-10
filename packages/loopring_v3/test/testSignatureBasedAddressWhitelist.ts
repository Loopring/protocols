import { Bitstream } from "loopringV3.js";
import { ExchangeTestUtil } from "./testExchangeUtil";
import BN = require("bn.js");
import Contract from "web3/eth/contract";
const fs = require("fs");
const abi = require("ethereumjs-abi");

contract("Exchange", (accounts: string[]) => {
  let exchangeTestUtil: ExchangeTestUtil;
  let newAddressWhitelist: any;
  let addressWhiteListABI: any;
  let addressWhiteListContract: Contract;

  before(async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
    newAddressWhitelist = await exchangeTestUtil.contracts.AddressWhitelist.new();
    assert(
      newAddressWhitelist.address != 0,
      "newAddressWhitelist.address == 0."
    );

    const ABIPath = "ABI/version30/";
    addressWhiteListABI = fs.readFileSync(
      ABIPath + "IAddressWhitelist.abi",
      "ascii"
    );
    addressWhiteListContract = new web3.eth.Contract(
      JSON.parse(addressWhiteListABI),
      newAddressWhitelist.address
    );
  });

  after(async () => {
    await exchangeTestUtil.stop();
  });

  const generatePermissionBytes = async (
    now: any,
    address: any,
    signer: any
  ) => {
    const bitstream = new Bitstream();
    bitstream.addNumber(now, 8);
    const hashMsg =
      "0x" +
      abi
        .soliditySHA3(
          ["string", "address", "uint"],
          ["LOOPRING_DEX_ACCOUNT_CREATION", address, now]
        )
        .toString("hex");
    // console.log('hashMsg :', hashMsg);
    const rsv = await web3.eth.sign(hashMsg, signer);
    bitstream.addHex(rsv);

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

      addressWhiteListContract.methods
        .isAddressWhitelisted(realAccount, permission)
        .call()
        .then((ret: any) => {
          assert(ret, "Corrent whitelist signature should pass");
        });

      addressWhiteListContract.methods
        .isAddressWhitelisted(fakeAccount, permission)
        .call()
        .then((ret: any) => {
          assert(!ret, "Corrent whitelist signature should not pass");
        });
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

      addressWhiteListContract.methods
        .isAddressWhitelisted(realAccount, [])
        .call()
        .then((ret: any) => {
          assert(!ret, "Wrong permission should not pass check.");
        });

      addressWhiteListContract.methods
        .isAddressWhitelisted(realAccount, permission)
        .call()
        .then((ret: any) => {
          assert(!ret, "Requests happened 1 day ago should not pass.");
        });

      var now = Math.floor(Date.now() / 1000);
      var permission = await generatePermissionBytes(
        now,
        realAccount,
        deployer
      );
      permission[72] = 2;

      addressWhiteListContract.methods
        .isAddressWhitelisted(realAccount, permission)
        .call()
        .then((ret: any) => {
          assert(!ret, "v is not in [0, 1] should not pass.");
        });
    });

    it("check malicious permission", async () => {
      const deployer = exchangeTestUtil.testContext.deployer;
      const realAccount = exchangeTestUtil.testContext.orderOwners[0];
      var now = Math.floor(Date.now() / 1000);
      var permission = await generatePermissionBytes(
        now,
        realAccount,
        deployer
      );

      var permStr = await web3.utils.bytesToHex(permission);
      var t = permStr.slice(2, 18);
      var r = permStr.slice(18, 82);
      var s = permStr.slice(82, 146);
      var v = permStr.slice(146);

      var curveN = new BN(
        "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141",
        16
      );
      var maliciousS = curveN.sub(new BN(s, 16));
      var maliciousV = new BN(v, 16).add(new BN(1)).mod(new BN(2));

      const bitstream = new Bitstream();
      bitstream.addBN(new BN(t, 16), 8);
      bitstream.addBN(new BN(r, 16), 32);
      bitstream.addBN(maliciousS, 32);
      bitstream.addBN(maliciousV, 1);

      var maliciousPermission = bitstream.getData();

      var maliciousPermBytes = await web3.utils.hexToBytes(maliciousPermission);
      addressWhiteListContract.methods
        .isAddressWhitelisted(realAccount, maliciousPermBytes)
        .call()
        .then((ret: any) => {
          assert(!ret, "malicious permission should not pass");
        });
    });
  });
});
