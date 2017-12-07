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

const crypto = require('crypto');

exports.decryptPrivKey = (encprivkey, password) =>
{
    let cipher = encprivkey.slice(0, 128);
    cipher = crypto.decodeCryptojsSalt(cipher);
    const evp = this.evp_kdf(Buffer.from(password), cipher.salt, {
        keysize: 32,
        ivsize: 16
    });
    const decipher = crypto.createDecipheriv('aes-256-cbc', evp.key, evp.iv);
    const privKey = this.decipherBuffer(decipher, Buffer.from(cipher.ciphertext));

    return Buffer.from(privKey.toString(), 'hex');
};

exports.decodeCryptojsSalt = (input) =>
{
    const ciphertext = Buffer.from(input, 'base64');
    if (ciphertext.slice(0, 8).toString() === 'Salted__')
{
        return {
            salt: ciphertext.slice(8, 16),
            ciphertext: ciphertext.slice(16)
        };
    }
    else
{
        return {
            ciphertext: ciphertext
        };
    }
};

exports.decipherBuffer = (decipher, data) =>
{
    return Buffer.concat([decipher.update(data), decipher.final()]);
};

exports.evp_kdf = (data, salt, opts) =>
{
    function iter(block)
{
        let hash = crypto.createHash(opts.digest || 'md5');
        hash.update(block);
        hash.update(data);
        hash.update(salt);
        block = hash.digest();
        for (let i = 1; i < (opts.count || 1); i++)
{
            hash = crypto.createHash(opts.digest || 'md5');
            hash.update(block);
            block = hash.digest();
        }
        return block;
    }
    const keysize = opts.keysize || 16;
    const ivsize = opts.ivsize || 16;
    const ret = [];
    let i = 0;
    while (Buffer.concat(ret).length < keysize + ivsize)
{
        ret[i] = iter(i === 0 ? Buffer.from(0) : ret[i - 1]);
        i++;
    }
    const tmp = Buffer.concat(ret);
    return {
        key: tmp.slice(0, keysize),
        iv: tmp.slice(keysize, keysize + ivsize)
    };
};
