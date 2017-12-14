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
const scrypt = require('scryptsy');
const ethereumUtil = require('ethereumjs-util');
const uuid = require('uuid/v4');
const decrypt = require('./decrypt.js');
const kdf = 'scrypt';

exports.decryptKeystoreToPkey = (keystore, password) =>
{
    let wallet;
    const parsed = JSON.parse(keystore);
    switch (this.determineKeystoreType(keystore))
    {
        case 'presale':
            wallet = this.decryptPresaleToPrivKey(keystore, password);
            break;
        case 'v1-unencrypted':
            wallet = Buffer.from(parsed.private, 'hex');
            break;
        case 'v1-encrypted':
            wallet = this.decryptMewV1ToPrivKey(keystore, password);
            break;
        case 'v2-unencrypted':
            wallet = Buffer.from(parsed.privKey, 'hex');
            break;
        case 'v2-v3-utc':
            wallet = this.decryptUtcKeystoreToPkey(keystore, password);
            break;
        default:
            return new Error('unrecognized type of keystore');
    }
    return wallet;
};

exports.pkeyToKeystore = (privateKey, password) =>
{
    const salt = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);
    const kdfparams = {
        dklen: 32,
        salt: salt.toString('hex')
    };
    kdfparams.n = 1024;
    kdfparams.r = 8;
    kdfparams.p = 1;
    const derivedKey = scrypt(
        Buffer.from(password),
        salt,
        kdfparams.n,
        kdfparams.r,
        kdfparams.p,
        kdfparams.dklen
    );
    const cipher = crypto.createCipheriv('aes-128-ctr', derivedKey.slice(0, 16), iv);

    if (!cipher)
    {
        throw new Error('Unsupported cipher');
    }
    const ciphertext = Buffer.concat([cipher.update(privateKey), cipher.final()]);
    const mac = ethereumUtil.sha3(
        Buffer.concat([derivedKey.slice(16, 32), Buffer.from(ciphertext, 'hex')])
    );

    const publicKey = ethereumUtil.privateToPublic(privateKey);
    const address = '0x' + ethereumUtil.publicToAddress(publicKey).toString('hex');

    return {
        version: 3,
        id: uuid({
            random: crypto.randomBytes(16)
        }),
        address,
        Crypto: {
            ciphertext: ciphertext.toString('hex'),
            cipherparams: {
                iv: iv.toString('hex')
            },
            cipher: 'aes-128-ctr',
            kdf,
            kdfparams,
            mac: mac.toString('hex')
        }
    };
};

exports.decryptUtcKeystoreToPkey = (keystore, password) =>
{
    const kstore = JSON.parse(keystore.toLowerCase());
    if (kstore.version !== 3)
    {
        throw new Error('Not a V3 wallet');
    }
    let derivedKey, kdfparams;

    if (kstore.crypto.kdf === 'scrypt')
    {
        kdfparams = kstore.crypto.kdfparams;
        derivedKey = scrypt(
            Buffer.from(password),
            Buffer.from(kdfparams.salt, 'hex'),
            kdfparams.n,
            kdfparams.r,
            kdfparams.p,
            kdfparams.dklen
        );
    }
    else if (kstore.crypto.kdf === 'pbkdf2')
    {
        kdfparams = kstore.crypto.kdfparams;
        if (kdfparams.prf !== 'hmac-sha256')
        {
            throw new Error('Unsupported parameters to PBKDF2');
        }
        derivedKey = crypto.pbkdf2Sync(
            Buffer.from(password),
            Buffer.from(kdfparams.salt, 'hex'),
            kdfparams.c,
            kdfparams.dklen,
            'sha256'
        );
    }
    else
    {
        throw new Error('Unsupported key derivation scheme');
    }
    const ciphertext = Buffer.from(kstore.crypto.ciphertext, 'hex');
    const mac = ethereumUtil.sha3(Buffer.concat([derivedKey.slice(16, 32), ciphertext]));
    if (mac.toString('hex') !== kstore.crypto.mac)
    {
        throw new Error('Key derivation failed - possibly wrong passphrase');
    }
    const decipher = crypto.createDecipheriv(
        kstore.crypto.cipher,
        derivedKey.slice(0, 16),
        Buffer.from(kstore.crypto.cipherparams.iv, 'hex')
    );
    let seed = decrypt.decipherBuffer(decipher, ciphertext);
    while (seed.length < 32)
    {
        const nullBuff = Buffer.from([0x00]);
        seed = Buffer.concat([nullBuff, seed]);
    }
    return seed;
};

exports.determineKeystoreType = (keystore) =>
{
    const parsed = JSON.parse(keystore);
    if (parsed.encseed)
    {
        return 'presale';
    }
    else if (parsed.Crypto || parsed.crypto)
    {
        return 'v2-v3-utc';
    }
    else if (parsed.hash && parsed.locked === true)
    {
        return 'v1-encrypted';
    }
    else if (parsed.hash && parsed.locked === false)
    {
        return 'v1-unencrypted';
    }
    else if (parsed.publisher === 'MyEtherWallet')
    {
        return 'v2-unencrypted';
    }
    else
    {
        throw new Error('Invalid keystore');
    }
};

exports.decryptPresaleToPrivKey = (keystore, password) =>
{
    const json = JSON.parse(keystore);
    const encseed = Buffer.from(json.encseed, 'hex');
    const derivedKey = crypto.pbkdf2Sync(
        Buffer.from(password),
        Buffer.from(password),
        2000,
        32,
        'sha256'
    ).slice(0, 16);
    const decipher = crypto.createDecipheriv(
        'aes-128-cbc',
        derivedKey,
        encseed.slice(0, 16)
    );
    const seed = decrypt.decipherBuffer(decipher, encseed.slice(16));
    const privkey = ethereumUtil.sha3(seed);
    const address = ethereumUtil.privateToAddress(privkey);

    if (address.toString('hex') !== json.ethaddr)
    {
        throw new Error('Decoded key mismatch - possibly wrong passphrase');
    }
    return privkey;
};

exports.decryptMewV1ToPrivKey = (keystore, password) =>
{
    const json = JSON.parse(keystore);
    let privkey;

    if (typeof password !== 'string')
    {
        throw new Error('Password required');
    }
    if (password.length < 9)
    {
        throw new Error('Password must be at least 9 characters');
    }
    let cipher = json.encrypted ? json.private.slice(0, 128) : json.private;
    cipher = decrypt.decodeCryptojsSalt(cipher);
    const evp = decrypt.evp_kdf(Buffer.from(password), cipher.salt, {
        keysize: 32,
        ivsize: 16
    });
    const decipher = crypto.createDecipheriv('aes-256-cbc', evp.key, evp.iv);
    privkey = decrypt.decipherBuffer(decipher, Buffer.from(cipher.ciphertext));
    privkey = Buffer.from(privkey.toString(), 'hex');
    const address = '0x' + ethereumUtil.privateToAddress(privkey).toString('hex');

    if (address !== json.address)
    {
        throw new Error('Invalid private key or address');
    }
    return privkey;
};

exports.isKeystorePassRequired = (keystore) =>
{
    switch (this.determineKeystoreType(keystore))
    {
        case 'presale':
            return true;
        case 'v1-unencrypted':
            return false;
        case 'v1-encrypted':
            return true;
        case 'v2-unencrypted':
            return false;
        case 'v2-v3-utc':
            return true;
        default:
            return false;
    }
};
