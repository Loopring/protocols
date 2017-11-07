import * as _ from 'lodash';
import { BigNumber } from 'bignumber.js';
import { Artifacts } from '../util/artifacts';

const {
  TokenTransferDelegate,
  TokenRegistry,
  DummyToken,
} = new Artifacts(artifacts);

contract('TokenTransferDelegate', (accounts: string[])=>{
  const owner = accounts[0];
  const loopringProtocolV1 = accounts[1];  // mock loopring protocol v1
  const loopringProtocolV2 = accounts[2];  // mock loopring protocol v2
  const trader1 = accounts[3];
  const trader2 = accounts[4];

  let tokenRegistry: any;
  let tokenTransferDelegate: any;

  let lrc: any;
  let lrcAddress: string;
  let delegateAddr: string;

  const getTokenBalanceAsync = async (token: any, addr: string) => {
    const tokenBalanceStr = await token.balanceOf(addr);
    const balance = new BigNumber(tokenBalanceStr);
    return balance;
  }

  before(async () => {
    [tokenRegistry, tokenTransferDelegate] = await Promise.all([
      TokenRegistry.deployed(),
      TokenTransferDelegate.deployed(),
    ]);

    delegateAddr = TokenTransferDelegate.address;
    lrcAddress = await tokenRegistry.getAddressBySymbol("LRC");
    lrc = await DummyToken.at(lrcAddress);
  });

  describe('TokenTransferDelegate', () => {

    it('should be able to add loopring protocol version', async () => {
      const addVersionTx = await tokenTransferDelegate.addVersion(loopringProtocolV1, {from: owner});

      const versions = await tokenTransferDelegate.getVersions({from: owner});
      assert(_.includes(versions, loopringProtocolV1), "loopring protocol not added successfully.")

      const version = await tokenTransferDelegate.versioned(loopringProtocolV1, {from: owner});
      assert(version > 0, "loopring protocol version value is 0 after added.")
    });

    it('should be able to remove loopring protocol version', async () => {
      const removeVersionTx = await tokenTransferDelegate.removeVersion(loopringProtocolV1, {from: owner});
      const versions = await tokenTransferDelegate.getVersions({from: owner});
      assert(!_.includes(versions, loopringProtocolV1), "loopring protocol not removed successfully.")

      const version = await tokenTransferDelegate.versioned(loopringProtocolV1, {from: owner});
      assert(version == 0, "loopring protocol version value is not 0 after removed.")
    });

    it('should be able to get spendable amount of token for address', async () => {
      await tokenTransferDelegate.addVersion(loopringProtocolV1, {from: owner});

      await lrc.setBalance(trader1, web3.toWei(10), {from: owner});
      await lrc.approve(delegateAddr, web3.toWei(5), {from: trader1});

      const spendable = await tokenTransferDelegate.getSpendable(lrcAddress, trader1, {from: loopringProtocolV1});
      assert.equal(spendable.toNumber(), 5e18, "get wrong spendable amount");

      await lrc.approve(delegateAddr, 0, {from: trader1});
      await lrc.approve(delegateAddr, web3.toWei(15), {from: trader1});
      const spendable2 = await tokenTransferDelegate.getSpendable(lrcAddress, trader1, {from: loopringProtocolV1});
      assert.equal(spendable2.toNumber(), 10e18, "get wrong spendable amount");
    });

    it('should be able to transfer ERC20 token if properly approved.', async () => {
      await lrc.setBalance(trader1, web3.toWei(5), {from: owner});
      await lrc.approve(delegateAddr, web3.toWei(0), {from: trader1});
      await lrc.approve(delegateAddr, web3.toWei(5), {from: trader1});

      const transferTx = await tokenTransferDelegate.transferToken(lrcAddress, trader1, trader2, web3.toWei(2.1), {from: loopringProtocolV1});

      const balanceOfTrader1 = await getTokenBalanceAsync(lrc, trader1);
      const balanceOfTrader2 = await getTokenBalanceAsync(lrc, trader2);
      assert.equal(balanceOfTrader1.toNumber(), 29e17, "transfer wrong number of tokens");
      assert.equal(balanceOfTrader2.toNumber(), 21e17, "transfer wrong number of tokens");

    });

    it('should not be able to transfer ERC20 token if msg.sender not versioned.', async () => {
      try {
        await tokenTransferDelegate.transferToken(lrcAddress, trader1, trader2, web3.toWei(1.1), {from: loopringProtocolV2});
      } catch (err) {
        const errMsg = `${err}`;
        assert(_.includes(errMsg, 'Error: VM Exception while processing transaction: revert'), `Expected contract to throw, got: ${err}`);
      }
    });

  });

});
