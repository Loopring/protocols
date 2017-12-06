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

'use strict'

const ethereumUtil = require('ethereumjs-util')
const ens = require('./ens')

function validator () {
  this.isValidPrivateKey = (privateKey) => {
    if (typeof privateKey === 'string') {
      return privateKey.length === 64
    } else if (privateKey instanceof Buffer) {
      return privateKey.length === 32
    } else {
      return false
    }
  }

  this.isValidETHAddress = (address) => {
    if (!address) {
      return false
    }
    return ethereumUtil.isValidAddress(address)
  }

  this.isValidHex = (str) => {
    if (typeof str !== 'string') {
      return false
    }
    if (str === '') {
      return true
    }
    str = str.substring(0, 2) === '0x'
            ? str.substring(2).toUpperCase()
            : str.toUpperCase()

    const re = /^[0-9A-F]+$/g
    return re.test(str)
  }

  this.isValidENSorEtherAddress = (address) => {
    return this.isValidETHAddress(address) || this.isValidENSAddress(address)
  }

  this.isValidENSAddress = (address) => {
    try {
      const normalized = ens.normalise(address)
      const tld = normalized.substr(normalized.lastIndexOf('.') + 1)
      const validTLDs = {
        eth: true,
        test: true,
        reverse: true
      }
      if (validTLDs[tld]) {
        return true
      }
    } catch (e) {
      return false
    }
    return false
  }

  this.isValidENSName = (str) => {
    try {
      return (
                str.length > 6 && ens.normalise(str) !== '' && str.substring(0, 2) !== '0x'
      )
    } catch (e) {
      return false
    }
  }
}

module.exports = validator
