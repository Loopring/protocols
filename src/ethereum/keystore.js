import {fromEthSale, fromV1, fromV3, fromPrivateKey} from 'ethereumjs-wallet';
import {clearHexPrefix} from '../common/formatter';

/**
 * Returns private key of given keystore
 * @param keystore string
 * @param password string
 * @returns {Buffer}
 */
export function decryptKeystoreToPkey (keystore, password)
{
    let wallet;
    const parsed = JSON.parse(keystore);
    switch (determineKeystoreType(keystore))
    {
        case 'presale':
            wallet = decryptPresaleToPrivKey(keystore, password);
            break;
        case 'v1-unencrypted':
            wallet = Buffer.from(parsed.private, 'hex');
            break;
        case 'v1-encrypted':
            wallet = decryptMewV1ToPrivKey(keystore, password);
            break;
        case 'v2-unencrypted':
            wallet = Buffer.from(parsed.privKey, 'hex');
            break;
        case 'v2-v3-utc':
            wallet = decryptUtcKeystoreToPkey(keystore, password);
            break;
        default:
            throw new Error('unrecognized type of keystore');
    }
    return wallet;
}

/**
 * Returns keystore of a given ethereum private key with password
 * @param privateKey
 * @param password
 * @returns {{version, id, address, crypto}}  keystore
 */
export function pkeyToKeystore (privateKey, password)
{
    return fromPrivateKey(privateKey).toV3(password, {c: 1024, n: 1024});
}

/**
 * Returns ethereum private key of given v3 keystore
 * @param keystore string
 * @param password string
 * @returns {Buffer}
 */
export function decryptUtcKeystoreToPkey (keystore, password)
{
    return fromV3(keystore, password, true).getPrivateKey();
}

/**
 * Returns type of a given keystore
 * @param keystore string
 * @returns {string}
 */
export function determineKeystoreType (keystore)
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
}

/**
 * Returns ethereum  private key of given presale keystore
 * @param keystore string
 * @param password string
 * @returns {Buffer}
 */
export function decryptPresaleToPrivKey (keystore, password)
{
    return fromEthSale(keystore, password).getPrivateKey();
}

/**
 * Returns ethereum  private key of given v1 keystore
 * @param keystore string
 * @param password string
 * @returns {Buffer}
 */
export function decryptMewV1ToPrivKey (keystore, password)
{
    return fromV1(keystore, password).getPrivateKey();
}

/**
 * Checks whether a password is required to decrypt the given keystore
 * @param keystore string
 * @returns {boolean}
 */
export function isKeystorePassRequired (keystore)
{
    switch (determineKeystoreType(keystore))
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
}

/**
 * Returns V3 format fileName
 * @param address
 * @returns {string}
 */
export function getFileName (address)
{
    const ts = new Date();
    return ['UTC--', ts.toJSON().replace(/:/g, '-'), '--', clearHexPrefix(address), '.json'].join('');
}
