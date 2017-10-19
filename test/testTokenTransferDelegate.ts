import * as _ from 'lodash';
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
      assert(spendable.toNumber(), 5e18, "get wrong spendable amount");

      await lrc.approve(delegateAddr, 0, {from: trader1});
      await lrc.approve(delegateAddr, web3.toWei(15), {from: trader1});
      const spendable2 = await tokenTransferDelegate.getSpendable(lrcAddress, trader1, {from: loopringProtocolV1});
      assert(spendable2.toNumber(), 10e18, "get wrong spendable amount");
    });

  });

});
