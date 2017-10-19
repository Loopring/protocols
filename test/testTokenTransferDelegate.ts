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

  before(async () => {
    [tokenRegistry, tokenTransferDelegate] = await Promise.all([
      TokenRegistry.deployed(),
      TokenTransferDelegate.deployed(),
    ]);

    lrcAddress = await tokenRegistry.getAddressBySymbol("LRC");
  });

  describe('TokenTransferDelegate', () => {

    it('should be able to add loopring protocol version', async () => {
      const addVersionTx = await tokenTransferDelegate.addVersion(loopringProtocolV1, {from: owner});
      const versions = await tokenTransferDelegate.getVersions({from: owner});
      //console.log("versions: ", versions);
      assert(_.includes(versions, loopringProtocolV1), "loopring protocol not added.")

    });

  });

});
