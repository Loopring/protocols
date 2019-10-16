import BN = require("bn.js");
import { expectThrow } from "./expectThrow";
import { Constants, Bitstream } from "loopringV3.js";
import { ExchangeTestUtil } from "./testExchangeUtil";
const abi = require("ethereumjs-abi");

contract("Exchange", (accounts: string[]) => {
  let exchangeTestUtil: ExchangeTestUtil;
  let exchange: any;
  let exchangeId: any;

  const setAddressWhitelistChecked = async (newAddressWhitelist: any) => {
    /*
        event AddressWhitelistChanged(
            uint    indexed exchangeId,
            address         oldAddressWhitelist,
            address         newAddressWhitelist
        );
    */
    const result = await exchange.setAddressWhitelist(
      newAddressWhitelist.address,
      { from: exchangeTestUtil.exchangeOwner }
    );
    var eventFromBlock = result.receipt.blockNumber;
    var events = await exchangeTestUtil.getEventsFromContract(
      exchange,
      "AddressWhitelistChanged",
      eventFromBlock
    );
    assert.equal(
      events.length,
      1,
      "A single AddressWhitelistChanged event needs to be emitted"
    );
    const newAddressFromEvent = events[0].args.newAddressWhitelist;
    assert(
      newAddressFromEvent == newAddressWhitelist.address,
      "newAddressWhitelist should be " +
        newAddressWhitelist.address +
        " but get[" +
        newAddressFromEvent +
        "]"
    );
  };

  const createExchange = async (bSetupTestState: boolean = true) => {
    exchangeId = await exchangeTestUtil.createExchange(
      exchangeTestUtil.testContext.stateOwners[0],
      bSetupTestState
    );
    exchange = exchangeTestUtil.exchange;
  };

  before(async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
  });

  describe("AddressWhitelist functionality test", () => {
    it("should be able to set the AddressWhitelist", async () => {
      await createExchange();
      await setAddressWhitelistChecked(exchangeTestUtil.addressWhiteList);
    });

    it("AddressWhitelist works", async () => {
      await createExchange();
      await setAddressWhitelistChecked(exchangeTestUtil.addressWhiteList);
      // fee param
      const fees = await exchange.getFees();
      const accountCreationFee = fees._accountCreationFeeETH;
      const depositFee = fees._depositFeeETH;
      const totalFee = depositFee.add(accountCreationFee);

      // request dis-approved
      const keyPair = exchangeTestUtil.getKeyPairEDDSA();
      const owner1 = exchangeTestUtil.testContext.orderOwners[0];
      await expectThrow(
        exchange.createOrUpdateAccount(
          keyPair.publicKeyX,
          keyPair.publicKeyY,
          Constants.emptyBytes,
          {
            from: owner1,
            value: new BN(totalFee)
          }
        ),
        "ADDRESS_NOT_WHITELISTED"
      );

      // request approved
      const owner2 = exchangeTestUtil.testContext.orderOwners[1];
      const bitstream = new Bitstream();
      var now = Date.now();
      bitstream.addNumber(now, 8);
      // console.log("exchange deployer:", exchangeTestUtil.testContext.deployer);
      // console.log("msg = [LOOPRING_DEX_ACCOUNT_CREATION +" + owner2 + " + " + now + "]");
      const hashMsg =
        "0x" +
        abi
          .soliditySHA3(
            ["string", "address", "uint"],
            ["LOOPRING_DEX_ACCOUNT_CREATION", owner2, now]
          )
          .toString("hex");
      // console.log("hash value:", hashMsg);
      const rsv = await web3.eth.sign(
        hashMsg,
        exchangeTestUtil.testContext.deployer
      );
      bitstream.addHex(rsv);

      // console.log("permission date:", bitstream.getData());
      const permission = web3.utils.hexToBytes(bitstream.getData());
      assert(
        permission.length == 73,
        "permission.length should be 73(t8+sign65)"
      );
      const result = await exchange.createOrUpdateAccount(
        keyPair.publicKeyX,
        keyPair.publicKeyY,
        permission,
        {
          from: owner2,
          value: new BN(totalFee)
        }
      );

      // make sure account is created.
      const eventArr: any = await exchangeTestUtil.getEventsFromContract(
        exchange,
        "AccountCreated",
        result.receipt.blockNumber
      );
      assert(
        eventArr[0].args.owner == owner2,
        (eventArr[0].args.pubKeyX = keyPair.publicKeyX),
        (eventArr[0].args.pubKeyY = keyPair.publicKeyY)
      );
    });
  });
});
