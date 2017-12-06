/*

  Copyright 2017 Loopring Project Ltd (Loopring Foundation).

  Licensed under the Apache License, Version 2.0 (the 'License');
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an 'AS IS' BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.

*/

'use strict';

const crypto = require('crypto');
const ethereumUtil = require('ethereumjs-util');
const keystore = require('./keystore.js');

function Wallet() {
    var privateKey;
    var publicKey;
    var address;

    this.generate = function() {
        privateKey = crypto.randomBytes(32);
        publicKey = ethereumUtil.privateToPublic(privateKey);
        address = ethereumUtil.publicToAddress(publicKey);
    };

    this.setPrivateKey = function(key) {
        if (typeof key === 'string') {
            key = ethereumUtil.toBuffer(key)
        }
        privateKey = key;
        publicKey = ethereumUtil.privateToPublic(privateKey);
        address = ethereumUtil.publicToAddress(publicKey);
    };

    this.getAddress = function() {
        return ethereumUtil.toChecksumAddress('0x' + address.toString('hex'));
    };


    this.toKeystore = function(password) {
        return keystore.pkeyToKeystore(privateKey, password)
    }
}

module.exports = Wallet;