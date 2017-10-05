/*

  Copyright 2017 Loopring Project Ltd (Loopring Foundation).

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.

*/
import { Artifacts } from '../util/artifacts';

const {
  TokenRegistry,
  DummyToken,
} = new Artifacts(artifacts);

contract('TokenRegistry', (accounts: string[])=>{

  const owner = accounts[0];
  const user = accounts[1];

  let tokenRegistry: any;
  let lrcTokenAddr: string;
  let testTokenAddr: string;

  before(async () => {
    tokenRegistry = await TokenRegistry.deployed();
    testTokenAddr = "0x8d01f9bcca92e63a1b2752b22d16e1962aa3c920";
    //lrcTokenAddr = await tokenRegistry.getAddressBySymbol("LRC");
  });

  describe('owner', () => {

    it('should be able to register a token', async () => {
      await tokenRegistry.registerToken(testTokenAddr, "TEST", {from: owner});
      const isRegistered = await tokenRegistry.isTokenRegistered(testTokenAddr);
      assert.equal(isRegistered, true, 'token should be registered');
    });

    it('should be able to unregister a token', async () => {
      let isRegistered = await tokenRegistry.isTokenRegistered(testTokenAddr);
      let isRegisteredBySymbol = await tokenRegistry.isTokenRegisteredBySymbol("TEST");
      assert.equal(isRegistered, true, 'token should be registered on start');
      assert.equal(isRegisteredBySymbol, true, 'token should be registered on start');

      await tokenRegistry.unregisterToken(testTokenAddr, "TEST", {from: owner});
      isRegistered = await tokenRegistry.isTokenRegistered(testTokenAddr);
      isRegisteredBySymbol = await tokenRegistry.isTokenRegisteredBySymbol("TEST");
      assert.equal(isRegistered, false, 'token should be unregistered');
      assert.equal(isRegisteredBySymbol, false, 'token should be unregistered');
    });

  });

  describe('any user', () => {
    it('should be able to check a token registered or not', async () => {
      const isRegistered = await tokenRegistry.isTokenRegistered(testTokenAddr, {from: user});
      assert.equal(isRegistered, isRegistered, 'any one should be able to check token registered or not ');
    });
  });

})
