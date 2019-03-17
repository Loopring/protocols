import { BigNumber } from "bignumber.js";
import BN = require("bn.js");
import abi = require("ethereumjs-abi");
import * as _ from "lodash";
import { Artifacts } from "../util/artifacts";

const {
  TokenTransferDelegate,
  TokenRegistry,
  DummyToken,
} = new Artifacts(artifacts);

contract("TokenTransferDelegate", (accounts: string[]) => {
  const owner = accounts[0];
  const loopringProtocolV1 = accounts[1];  // mock loopring protocol v1
  const loopringProtocolV2 = accounts[2];  // mock loopring protocol v2
  const loopringProtocolV3 = accounts[3];  // mock loopring protocol v3
  const trader1 = accounts[3];
  const trader2 = accounts[4];
  const walletAddr1 = accounts[5];
  const walletAddr2 = accounts[6];

  let tokenRegistry: any;
  let tokenTransferDelegate: any;

  let lrc: any;
  let eos: any;
  let gto: any;

  let lrcAddress: string;
  let eosAddress: string;
  let gtoAddress: string;
  let delegateAddr: string;

  const getTokenBalanceAsync = async (token: any, addr: string) => {
    const tokenBalanceStr = await token.balanceOf(addr);
    const balance = new BigNumber(tokenBalanceStr);
    return balance;
  };

  const numberToBytes32Str = (n: number) => {
    const encoded = abi.rawEncode(["uint256"], [new BN(n.toString(10), 10)]);
    return "0x" + encoded.toString("hex");
  };

  const addressToBytes32Str = (addr: string) => {
    const encoded = abi.rawEncode(["address"], [addr]);
    return "0x" + encoded.toString("hex");
  };

  before(async () => {
    [tokenRegistry, tokenTransferDelegate] = await Promise.all([
      TokenRegistry.deployed(),
      TokenTransferDelegate.deployed(),
    ]);

    delegateAddr = TokenTransferDelegate.address;
    lrcAddress = await tokenRegistry.getAddressBySymbol("LRC");
    eosAddress = await tokenRegistry.getAddressBySymbol("EOS");
    gtoAddress = await tokenRegistry.getAddressBySymbol("GTO");
    lrc = await DummyToken.at(lrcAddress);
    eos = await DummyToken.at(eosAddress);
    gto = await DummyToken.at(gtoAddress);
  });

  describe("TokenTransferDelegate", () => {
    it("should be able to authorize loopring protocol contract", async () => {
      await tokenTransferDelegate.authorizeAddress(loopringProtocolV1, {from: owner});
      const authorized = await tokenTransferDelegate.isAddressAuthorized(loopringProtocolV1);
      assert(authorized, "loopring protocol is not authorized.");
    });

    it("should be able to deauthorize loopring protocol contract", async () => {
      await tokenTransferDelegate.authorizeAddress(loopringProtocolV1, {from: owner});
      await tokenTransferDelegate.deauthorizeAddress(loopringProtocolV1, {from: owner});
      const authorized = await tokenTransferDelegate.isAddressAuthorized(loopringProtocolV1);
      assert(authorized === false, "loopring protocol is authorized after deauthorize it.");
    });

    it("should be able to transfer ERC20 token if properly approved.", async () => {
      await tokenTransferDelegate.authorizeAddress(loopringProtocolV1, {from: owner});

      await lrc.setBalance(trader1, web3.toWei(5), {from: owner});
      await lrc.approve(delegateAddr, web3.toWei(0), {from: trader1});
      await lrc.approve(delegateAddr, web3.toWei(5), {from: trader1});

      await tokenTransferDelegate.transferToken(lrcAddress, trader1, trader2, web3.toWei(2.1),
                                                {from: loopringProtocolV1});

      const balanceOfTrader1 = await getTokenBalanceAsync(lrc, trader1);
      const balanceOfTrader2 = await getTokenBalanceAsync(lrc, trader2);
      assert.equal(balanceOfTrader1.toNumber(), 29e17, "transfer wrong number of tokens");
      assert.equal(balanceOfTrader2.toNumber(), 21e17, "transfer wrong number of tokens");

    });

    it("should not be able to transfer ERC20 token if msg.sender not authorized.", async () => {
      try {
        await tokenTransferDelegate.transferToken(lrcAddress, trader1, trader2, web3.toWei(1.1),
                                                  {from: loopringProtocolV2});
      } catch (err) {
        const errMsg = `${err}`;
        assert(_.includes(errMsg, "Error: VM Exception while processing transaction: revert"),
               `Expected contract to throw, got: ${err}`);
      }
    });

    it("should be able to transfer ERC20 token in batch.", async () => {
      await tokenTransferDelegate.authorizeAddress(loopringProtocolV1, {from: owner});

      await lrc.setBalance(owner, 0, {from: owner});
      await lrc.setBalance(trader1, web3.toWei(5), {from: owner});
      await lrc.setBalance(trader2, web3.toWei(5), {from: owner});
      await lrc.approve(delegateAddr, web3.toWei(0), {from: trader1});
      await lrc.approve(delegateAddr, web3.toWei(5), {from: trader1});
      await lrc.approve(delegateAddr, web3.toWei(0), {from: trader2});
      await lrc.approve(delegateAddr, web3.toWei(5), {from: trader2});

      await eos.setBalance(trader1, web3.toWei(100), {from: owner});
      await eos.approve(delegateAddr, web3.toWei(0), {from: trader1});
      await eos.approve(delegateAddr, web3.toWei(100), {from: trader1});

      await gto.setBalance(trader2, web3.toWei(10), {from: owner});
      await gto.approve(delegateAddr, web3.toWei(0), {from: trader2});
      await gto.approve(delegateAddr, web3.toWei(10), {from: trader2});

      const batch: string[] = [];
      batch.push(addressToBytes32Str(trader1));
      batch.push(addressToBytes32Str(eosAddress));
      batch.push(numberToBytes32Str(100e18));
      batch.push(numberToBytes32Str(0));
      batch.push(numberToBytes32Str(0));
      batch.push(numberToBytes32Str(5e18));
      batch.push(walletAddr1);
      batch.push(numberToBytes32Str(0));
      batch.push(numberToBytes32Str(0));
      batch.push(numberToBytes32Str(1));

      batch.push(addressToBytes32Str(trader2));
      batch.push(addressToBytes32Str(gtoAddress));
      batch.push(numberToBytes32Str(10e18));
      batch.push(numberToBytes32Str(0));
      batch.push(numberToBytes32Str(0));
      batch.push(numberToBytes32Str(5e18));
      batch.push(walletAddr2);
      batch.push(numberToBytes32Str(0));
      batch.push(numberToBytes32Str(0));
      batch.push(numberToBytes32Str(1));

      const tx = await tokenTransferDelegate.batchUpdateHistoryAndTransferTokens(
          lrcAddress, loopringProtocolV1, owner, 20, batch,
          {from: loopringProtocolV1});

      const trader1GtoBalance = await getTokenBalanceAsync(gto, trader1);
      const trader2EosBalance = await getTokenBalanceAsync(eos, trader2);
      const ownerLrcBalance = await getTokenBalanceAsync(lrc, owner);

      assert.equal(trader1GtoBalance.toNumber(), 10e18, "trade amount incorrect");
      assert.equal(trader2EosBalance.toNumber(), 100e18, "trade amount incorrect");
      assert.equal(ownerLrcBalance.toNumber(), 8e18, "lrc fee amount incorrect");
    });

    it("should not be able to transfer token in batch if msg.sender not authorized", async () => {
      try {
        await lrc.setBalance(owner, 0, {from: owner});
        await lrc.setBalance(trader1, web3.toWei(5), {from: owner});
        await lrc.setBalance(trader2, web3.toWei(5), {from: owner});
        await lrc.approve(delegateAddr, web3.toWei(0), {from: trader1});
        await lrc.approve(delegateAddr, web3.toWei(5), {from: trader1});
        await lrc.approve(delegateAddr, web3.toWei(0), {from: trader2});
        await lrc.approve(delegateAddr, web3.toWei(5), {from: trader2});

        await eos.setBalance(trader1, web3.toWei(100), {from: owner});
        await eos.approve(delegateAddr, web3.toWei(0), {from: trader1});
        await eos.approve(delegateAddr, web3.toWei(100), {from: trader1});

        await gto.setBalance(trader2, web3.toWei(10), {from: owner});
        await gto.approve(delegateAddr, web3.toWei(0), {from: trader2});
        await gto.approve(delegateAddr, web3.toWei(10), {from: trader2});

        const batch: string[] = [];
        batch.push(addressToBytes32Str(trader1));
        batch.push(addressToBytes32Str(eosAddress));
        batch.push(numberToBytes32Str(100e18));
        batch.push(numberToBytes32Str(0));
        batch.push(numberToBytes32Str(0));
        batch.push(numberToBytes32Str(5e18));
        batch.push(walletAddr1);
        batch.push(numberToBytes32Str(0));
        batch.push(numberToBytes32Str(0));
        batch.push(numberToBytes32Str(1));

        batch.push(addressToBytes32Str(trader2));
        batch.push(addressToBytes32Str(gtoAddress));
        batch.push(numberToBytes32Str(10e18));
        batch.push(numberToBytes32Str(0));
        batch.push(numberToBytes32Str(0));
        batch.push(numberToBytes32Str(5e18));
        batch.push(walletAddr2);
        batch.push(numberToBytes32Str(0));
        batch.push(numberToBytes32Str(0));
        batch.push(numberToBytes32Str(1));

        const tx = await tokenTransferDelegate.batchUpdateHistoryAndTransferTokens(
            lrcAddress, loopringProtocolV2, owner, 20, batch,
            {from: loopringProtocolV2});
      } catch (err) {
        const errMsg = `${err}`;
        assert(_.includes(errMsg, "Error: VM Exception while processing transaction: revert"),
               `Expected contract to throw, got: ${err}`);
      }
    });

    it("should be able to get latest authorized addresses.", async () => {
      await tokenTransferDelegate.authorizeAddress(loopringProtocolV1, {from: owner});
      await tokenTransferDelegate.authorizeAddress(loopringProtocolV2, {from: owner});
      await tokenTransferDelegate.authorizeAddress(loopringProtocolV3, {from: owner});

      const addresses = await tokenTransferDelegate.getLatestAuthorizedAddresses(3);
      const expectedResult = [loopringProtocolV1, loopringProtocolV2, loopringProtocolV3];
      assert.sameMembers(addresses, expectedResult, "latest authorized addresses not equal to expected value");
    });

  });

});
