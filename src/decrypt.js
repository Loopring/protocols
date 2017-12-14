/*

  MIT License

  Copyright (c) 2016 MyEtherWallet

  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in all
  copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
  SOFTWARE.

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
    function iter (block)
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
