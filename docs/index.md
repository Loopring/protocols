## Documents in Other Languages

- [中文文档（Chinese）](chinese)

## About
This developer documentation introduces the use of loopring.js to access Loopring’s Protocol. The Document consists of two sections: Ethereum and the Relay.

The Ethereum section focuses on the functionality of the wallet. The wallet functions include: the creation of Ethereum accounts, unlocking of private keys, unlocking and generation of mnemonics, unlocking and generation of keystores, access to MetaMask, and access to hardware wallets such as Trezor and Ledger. Signatures of Ethereum transactions can be realized. In the creation of Ethereum contracts, the following functions are done: the signing of the information, the signing of Loopring orders, and an analyses of the abi function and abi information. Also, this section includes some Ethereum JSON-RPC interfaces, including eth_getTransactionCount，eth_sendRawTransaction, eth_gasPrice, eth_estimateGas, eth_getBalance，eth_getTransactionByHash, eth_call. 

The Relay section focuses on the access of the Loopring Relay interfaces, including the JSON-RPC and SocketIO interfaces. See the [Loopring Relay](https://github.com/Loopring/relay/blob/wallet_v2/LOOPRING_RELAY_API_SPEC_V2.md) access documentation for details on the specific interfaces. 

## Browser Usage

loopring.js ships as both a [UMD](https://github.com/umdjs/umd) module and a [CommonJS](https://en.wikipedia.org/wiki/CommonJS) package.

## UMD Package

Include the following script tag in your HTML:

```javascript
<script src="../node_modules/loopring/dist/loopring.min.js"></script>
```

 Get each component like so:

```javascript
window.loopring.common
window.loopring.ethereum
window.loopring.relay
```

## CommonJS  Package   (babel-polyfill is required)

```javascript
import loopring from 'loopring.js';
or
import {relay} from 'loopring.js';
or
const loopring = require('loopring.js');
```

## Ethereum

### Account

##### path

path is constant used in Loopring wallet,（m/44'/60'/0'/0）

#### privateKeytoAddress(privatekey)

Get the address using the private key

##### Parameters

- privatekey   hex string  or Buffer

#####  Returns

-  address

#####  Example

```javascript
const pKey = "07ae9ee56203d29171ce3de536d7742e0af4df5b7f62d298a0445d11e466bf9e";
privateKeytoAddress(pkey); //address:0x48ff2269e58a373120FFdBBdEE3FBceA854AC30A
```

#### publicKeytoAddress （publicKey, sanitize)

Get the address using the public key

##### Parameters

- publicKey  	hex string  or  Buffer
  - sanitize    bool, the default is false

##### Returns

- address

#####  Example

```javascript
const publicKey = "0895b915149d15148ac4171f453060d6b53a9ebb694689351df8e3a49c109c7a65374b5c196ce8cc35ff79cb3ce54ea1695704dd5b3cfc6864bd110b62cfd509";
publicKeytoAddress(publicKey)//address:0x48ff2269e58a373120FFdBBdEE3FBceA854AC30A
```

#### privateKeytoPublic(privatekey)

Get public key using the private key

##### Parameters

- privateKey  hex string  or  Buffer

##### Returns

- publickey  hex string, without prefix

##### Example

```javascript
const privateKey = '07ae9ee56203d29171ce3de536d7742e0af4df5b7f62d298a0445d11e466bf9e';
 const publicKey = privateKeytoPublic(privateKey);
 //publicKey:"0895b915149d15148ac4171f453060d6b53a9ebb694689351df8e3a49c109c7a65374b5c196ce8cc35ff79cb3ce54ea1695704dd5b3cfc6864bd110b62cfd509"
```

#### fromMnemonic(mnemonic, dpath, password)

An example account is generated using mnemonics, dpath, and passwords. 

##### Parameters

-  mnemonic  string
- dpath   string
- password  string - can be empty

##### Returns

- account KeyAccount example

##### Example

```javascript
const mnemonic = "seven museum glove patrol gain dumb dawn bridge task alone lion check interest hair scare cash sentence diary better kingdom remember nerve sunset move";
 const dpath = "m/44'/60'/0'/0/0";
 const password = "1111111";
 const account =  fromMnemonic(mnemonic,dpath,password);
```

#### fromKeystore(keystone,password)

Get keyAccount using the keystore and password

##### Parameters

-  keystore  string
- password  string - can be empty, depending on whether the keystore requires a password to unlock it.

##### Returns

- KeyAccount   account 

##### Example

```javascript
const keystore = "{"version":3,"id":"e603b01d-9aa9-4ddf-a165-1b21630237a5","address":"2131b0816b3ef8fe2d120e32b20d15c866e6b4c1","Crypto":{"ciphertext":"7e0c30a985cf29493486acaf86259a2cb0eb45befb367ab59a0baa7738adf49e","cipherparams":{"iv":"54bbb6e77719a13c3fc2072bb88a708c"},"cipher":"aes-128-ctr","kdf":"scrypt","kdfparams":{"dklen":32,"salt":"50c31e2a99f231b09201494cac1cf0943246edcc6864a91cc931563cd11eb0ce","n":1024,"r":8,"p":1},"mac":"13d3566174d20d93d2fb447167c21a127190d4b9b4843fe7cbebeb6054639a4f"}}";
 const password = "1111111";
 const account =  fromKeystore(keystore,password);
```

#### fromPrivateKey(privateKey)

Get the keyAccount using the privateKey

##### Parameters

-  privateKey  hex string or  Buffer

##### Returns

- KeyAccount   account

##### Example

```javascript
const privateKey = "07ae9ee56203d29171ce3de536d7742e0af4df5b7f62d298a0445d11e466bf9e";
 const account = fromPrivateKey(privateKey);
```

#### createMnemonic()

Generate a set of 24 English word mnemonics

##### Returns

- mnemonic string

##### Example

```javascript
const mnemonic = createMnemonic();
 // mnemonic: "seven museum glove patrol gain dumb dawn bridge task alone lion check interest hair scare cash sentence diary better kingdom remember nerve sunset move"
```

#### getAddresses({publicKey, chainCode, pageSize, pageNum})

Get the specified address using the publicKey, chainCode, and pageSize number.

##### Parameters

- publicKey   hex string or Buffer
- chainCode  hex string or Buffer
- pageSize    number
- pageNum  number

##### Returns

- Address[pageSize]

##### Example

```javascript
const publicKey = "029a29b250b48fb317b81717d405f8fcf54a6bcd25d5a4f9e446db01d14c84bf9d";
 const chainCode = "9bc5b6e72a92ba96f97f7b16296268c1c5b06a1ddaa22a4d821986a06b2ae16e";
 const pageSize = 5;
 const pageNum=0;
 const addresses = getAddresses({publicKey, chainCode, pageSize, pageNum});
 //addresses:["0xc57bb1cd690e7483ee2d2b4ecee060145a33fa3c","0x7d0749db3013f6e4c949d7810630aebe0e2e8756","0x7a9bbf63e8cc2bd7dba83884b6ed2d1e2e764409","0xef803e1d485fe9ae9ea6308d5c5d874cc011ac9a","0xfdffa0f9d72f7766b204bb8d6166990548419d96"]
```

#### Account

This account type implements the sendTransaction method.

#### sendTransaction（host，{signTx})

Send Ethereum transactions

##### Parameters

- host url
- signTx, which is the serialized signature on an Ethereum transaction

##### Returns

- txHash

##### Example

```javascript
const host = 'localhost:8545';
 const signTx="0xd46e8dd67c5d32be8d46e8dd67c5d32be8058bb8eb970870f072445675058bb8eb970870f072445675";
 const response = await sendTransaction(host,{signTx});
 //response 
 {
   "id":1,
   "jsonrpc": "2.0",
   "result": "0xe670ec64341771606e55d6b4ca35a1a6b75ee3d5145a99d05921026d1527331"
 }
```

#### KeyAccount

The class, which extends the Account class, implements the toV3Keystore, getPublicKey, getAddress, sign, signMessage, signEthereumTx, and signOrder methods based on the Account.

#### Creation Method

##### Parameters

- privateKey    hex string or Buffer

##### Example

```javascript
const privateKey = '07ae9ee56203d29171ce3de536d7742e0af4df5b7f62d298a0445d11e466bf9e';
 const account = new KeyAccount(privateKey);
```

##### getAddress()

Get the address of the account

##### Returns

- address

##### Example

```javascript
account.getAddress();//address:0x48ff2269e58a373120FFdBBdEE3FBceA854AC30A
```

##### getPublicKey()

Get the publicKey of the account

##### Returns

- publicKey hex string

##### Example

```javascript
const publicKey = account.getPublicKey();
 //publicKey:"0895b915149d15148ac4171f453060d6b53a9ebb694689351df8e3a49c109c7a65374b5c196ce8cc35ff79cb3ce54ea1695704dd5b3cfc6864bd110b62cfd509"
```

#### toV3Keystore(password)

The Json Keystore is converted to v3

##### Parameters

- password string

##### Returns

- keystore  object

##### Example

```javascript
const keystore = account.toV3Keystore('123456789');
 //keystore:{ version: 3,
   id: '2f76ed18-76dd-4186-90c6-c95c71fcff09',
   address: '48ff2269e58a373120ffdbbdee3fbcea854ac30a',
   crypto: 
    { ciphertext: 'ad086c4b4bed193ae4ed2103160829c5c64027b2258110bae86d78be18905463',
      cipherparams: { iv: '32dd303feab25da5e612ffa3676c946f' },
      cipher: 'aes-128-ctr',
      kdf: 'scrypt',
      kdfparams: 
       { dklen: 32,
         salt: '765aa6c750c0a511da0184e9914484a7293a63f5e5817b57ce9bef8ef559b8df',
         n: 262144,
         r: 8,
         p: 1 },
      mac: '33fb274ba8eb91674f0e5957e86784358cf65d9593c4b1e55333299a94249565' } }
```

#### sign(hash)

Sign the hash

##### Parameters

- hash  Buffer

##### Returns

- sig {r, s, v}
  -  r   hex string
  - s   hex string
  -  v  number

##### Example

```javascript
const hash = toBuffer('loopring');
 const sig = account.sign(hash);
 /sig :{ r: '0x87b7472c6116f5fd931b05f7b57c8b87192eb006f0e1376d997e68629d66bde7',
   s: '0x501f9eb08cde1a241595afd91e14d53568365d0124b72cc18fefd2b8ea1223ac',
   v: 28 }
```

#### signMessage(message)

Signing the Message automatically adds Ethereum-defined prefix information: ("\x19Ethereum Signed Message:\n" + len(keccak256(message)).

##### Parameters

- Message   string or Buffer

##### Returns

- sig {r, s, v}
  -  r    hex string
  - s    hex string
  -  v    number

##### Example

```javascript
const message = 'loopring';
 const sig = account.signMessage(messsage);
 //sig : { r: '0x83a812a468e90106038ba4f409b2702d14e373c40ad377c92935c61d09f12e53',
   s: '0x666425e6e769c3bf4378408488cd920aeda964d7995dac748529dab396cbaca4',
   v: 28 }
```

#### signEthereumTx(rawTx)

Sign the Ethereum transaction to obtain Tx in the form of serialized hexadecimal characters.

##### Parameters

-  rawTx 
  - chainId   number - For example, the chainId of Ethereum is 1 
  - nonce  hex string or Buffer
  - value   hex string or Buffer
  - data  hex string or Buffer
  - gasPrice  hex string or Buffer
  - gasLimit   hex string or Buffer
  - to  address  Buffer

##### Returns

- tx  hex string, serialized tx

##### Example

```javascript
const rawTx = {
   "gasPrice": "0x4e3b29200",
   "gasLimit": "0x15f90",
   "to": "0x88699e7fee2da0462981a08a15a3b940304cc516",
   "value": "0x56bc75e2d63100000",
   "data": "",
   "chainId": 1,
   "nonce": "0x9b"
 };
 const tx = account.signEthereumTx(rawTx)
 //tx:0xf86f819b8504e3b2920083015f909488699e7fee2da0462981a08a15a3b940304cc51689056bc75e2d631000008025a0d75c34cf2236bf632126f10d9ee8e963bf94623f8ec2dedb59c6d13342dbe3bea0644afdfa9812f494eee21adafc1b268c5b88bc47905880577876a8a293bd9c66
```

#### signOrder(order)

Sign the Loopring order, and return the signed order back

##### Parameter

- order
  -  protocol   address, here is an example version 1.5.1 protocol address: 0x8d8812b72d1e4ffCeC158D25f56748b7d67c1e78
  -  delegate  address, the Loopring protocol authorization address, here is an example version 1.5.1 address: 0x17233e07c67d086464fD408148c3ABB56245FA64
  -  owner  address, the address of the ordering user
  -  tokenS  address, the contract address that is selling currency 
  -  tokenB  address, the contract address that is buying currency 
  -  authAddr  address, randomly generated account address
  -  authPriavteKey  privatekey, randomly generated privatekey corresponding to the account
  -  validSince  hex string, the order effective time, timestamp in seconds
  -  validUntil  hex string, the order expiration time, timestamp in seconds
  -  amountB  hex string, the amount of tokenB to buy (here in units of the smallest unit)
  -  amountS  hex string, the amount of tokenS to sell (here in units of the smallest unit)
  -  walletAddress  address, address of the wallet that receives the tokens from an order
  -  buyNoMoreThanAmountB  bool, true if amountB is greater than tokenB
  -  lrcFee  hex string, orders fully match the maximum amount of fees that need to be paid.(Here the unit of LRC is the smallest unit)
  -  marginSplitPercentage  number(0–100), the proportion of funds used to pay for the reconciliation

##### Returns

- signedOrder, add the order signature r, s, v to the original order

##### Example

```javascript
const order = {
   "delegateAddress": "0x17233e07c67d086464fD408148c3ABB56245FA64",
   "protocol": "0x8d8812b72d1e4ffCeC158D25f56748b7d67c1e78",
   "owner": "0xb94065482ad64d4c2b9252358d746b39e820a582",
   "tokenB": "0xEF68e7C694F40c8202821eDF525dE3782458639f",
   "tokenS": "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
   "amountB": "0x15af1d78b58c400000",
   "amountS": "0x4fefa17b7240000",
   "lrcFee": "0xa8c0ff92d4c0000",
   "validSince": "0x5af6ce85",
   "validUntil": "0x5af82005",
   "marginSplitPercentage": 50,
   "buyNoMoreThanAmountB": true,
   "walletAddress": "0xb94065482ad64d4c2b9252358d746b39e820a582",
   "authAddr": "0xf65bf0b63cf812ab1a979a8e54c070674a849344",
   "authPrivateKey": "95f373ce0c34872db600017d506b90f7fbbb6433496640228cc7a8e00f27b23e"
 };
 const signedOrder = account.signOrder(order);
 //signedOrder:{
   "delegateAddress": "0x17233e07c67d086464fD408148c3ABB56245FA64",
   "protocol": "0x8d8812b72d1e4ffCeC158D25f56748b7d67c1e78",
   "owner": "0xb94065482ad64d4c2b9252358d746b39e820a582",
   "tokenB": "0xEF68e7C694F40c8202821eDF525dE3782458639f",
   "tokenS": "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
   "amountB": "0x15af1d78b58c400000",
   "amountS": "0x4fefa17b7240000",
   "lrcFee": "0xa8c0ff92d4c0000",
   "validSince": "0x5af6ce85",
   "validUntil": "0x5af82005",
   "marginSplitPercentage": 50,
   "buyNoMoreThanAmountB": true,
   "walletAddress": "0xb94065482ad64d4c2b9252358d746b39e820a582",
   "authAddr": "0xf65bf0b63cf812ab1a979a8e54c070674a849344",
   "authPrivateKey": "95f373ce0c34872db600017d506b90f7fbbb6433496640228cc7a8e00f27b23e",
   "v": 27,
   "r": "0xb657f82ee339555e622fc60fefd4089c40057bdb6d4976b19de2a88177129ed4",
   "s": "0x0d4ac4e1fbc05421f59b365f53c229a4b3cb9d75b4e53b7f3f0ffe3cdb85dfde"
 }
```

#### TrezorAccount

The class, connecting to the TREZOR account, extends the Account class, and implements getAddress, signMessage, and signEthereumTx. TREZOR's signMessage method is different from other account signatures and can only be verified by TREZOR itself. Therefore, TREZOR does not support the signing of a Loopring order, which results in TREZOR users being unable to place orders through TREZOR unless they were unlocked in Loopr by TREZOR mnemonics and placed orders.

#### Creation Method

##### Parameters

- dpath  string

##### Returns

- TrezorAccount  account

##### Example

```javascript
const dpath = "m/44'/60'/0'/0/0";
const account = new TrezorAccount(dpath);
```

##### getAddress()

Get account address

##### Returns

- address  address

##### Example

```javascript
const address = await account.getAddress();
 //address:0x48ff2269e58a373120FFdBBdEE3FBceA854AC30A
```

#### signMessage(message)

Signing messages can only be verified by TREZOR

##### Parameters

- message  string

##### Returns

- sig
  - r  hex string
  - s  hex string
  - v  number

##### Example

```javascript
const message = 'loopring';
const sig = account.signMessage(message);
//sig:{
     r:"0xcd2d7bb6ca215d4f7faf637da0db43d2ff6d2be095db0961c94b1e5f364dedc4",
     s:"0x42d5d8a55dc56e06dee07fbea65949092dd4b98a928de426d60c55d16e045141",
     v:28
     }
```

#### signEthereumTx(rawTx)

See KeyAccount.signEthereumTx

##### Parameters

See KeyAccount.signEthereumTx

##### Returns

See KeyAccount.signEthereumTx

##### Example

See KeyAccount.signEthereumTx

#### LedgerAccount

The class connects the Ledger to the account. The account is expanded to implement the getAddress, signMessage, signEthereumTx, and signOrder. 

#### Creation Method

##### Parameters

- ledger  Ledger, connection example
- dpath  string

##### Returns

- LedgerAccount  account

##### getAddress()

Get the account address

##### Returns

- address

##### Example

```javascript
const address = await account.getAddress();
 //address:0x48ff2269e58a373120FFdBBdEE3FBceA854AC30A
```

#### signMessage(message)

Signing the message automatically adds Ethereum-defined prefix information ("\x19Ethereum Signed Message:\n" + len(keccak256(message)).

##### Parameters

- message  string

##### Returns

- sig {r, s, v}
  - r  hex string
  - s  hex string
  -  v  number

##### Example

```javascript
const message = 'loopring';
const sig = account.signMessage(messsage);
 //sig : { r: '0x83a812a468e90106038ba4f409b2702d14e373c40ad377c92935c61d09f12e53',
   s: '0x666425e6e769c3bf4378408488cd920aeda964d7995dac748529dab396cbaca4',
   v: 28 }
```

#### signEthereumTx(rawTx)

See KeyAccount.signEthereumTx

##### Parameters

- rawTx
  - chainId  number - for example, the chainId of the Ethereum main network is 1.
  - nonce  hex string
  - value  hex string
  - data  hex string
  - gasPrice  hex string
  - gasLimit  hex string
  - to address  Buffer

##### Returns

See KeyAccount.signEthereumTx

##### Example

Reference KeyAccount.signEthereumTx

##### signOrder(order)

Reference KeyAccount.signOrder

##### Parameters

See KeyAccount.signOrder

##### Returns

Reference KeyAccount.signOrder

##### Example

Reference KeyAccount.signOrder

### MetaMaskAccount

This is an account class that connects the MetaMask wallet to your account. It extends the Account by implementing getAddress, sign, signMessage, signEthereumTx, and signOrder.

#### Creation Method

##### Parameters

- web3 

##### Returns

- account MetaMaskAccount

##### getAddress, sign(hash), signMessage(message), signEthereumTx(rawTx), signOrder(order) See the corresponding method of KeyAccount

​    

### keystore

#### decryptKeystoreToPkey(keystore, password)

Decrypt the private key using the keystore and password

##### Parameters

- keystore string
-  password string

##### Returns

- privatekey Buffer

##### Example

```javascript
const keystore = "{"version":3,"id":"e603b01d-9aa9-4ddf-a165-1b21630237a5","address":"2131b0816b3ef8fe2d120e32b20d15c866e6b4c1","Crypto":{"ciphertext":"7e0c30a985cf29493486acaf86259a2cb0eb45befb367ab59a0baa7738adf49e","cipherparams":{"iv":"54bbb6e77719a13c3fc2072bb88a708c"},"cipher":"aes-128-ctr","kdf":"scrypt","kdfparams":{"dklen":32,"salt":"50c31e2a99f231b09201494cac1cf0943246edcc6864a91cc931563cd11eb0ce","n":1024,"r":8,"p":1},"mac":"13d3566174d20d93d2fb447167c21a127190d4b9b4843fe7cbebeb6054639a4f"}}";
 const password = "1111111";
 const privatekey =  decryptKeystoreToPkey(keystore,password);
```

#### pkeyToKeystore(privateKey, password)

Keystore obtained using the privatekey and password

##### Parameters

- privateKey Buffer
- password string

##### Returns

- keystore Object

##### Example

```javascript
const privateKey = toBuffer('0x07ae9ee56203d29171ce3de536d7742e0af4df5b7f62d298a0445d11e466bf9e')；
 const password = "1111111";
 const keystore = pkeyToKeystore(privateKey,password);
 //keystore:{ version: 3,
   id: '2f76ed18-76dd-4186-90c6-c95c71fcff09',
   address: '48ff2269e58a373120ffdbbdee3fbcea854ac30a',
   crypto: 
    { ciphertext: 'ad086c4b4bed193ae4ed2103160829c5c64027b2258110bae86d78be18905463',
      cipherparams: { iv: '32dd303feab25da5e612ffa3676c946f' },
      cipher: 'aes-128-ctr',
      kdf: 'scrypt',
      kdfparams: 
       { dklen: 32,
         salt: '765aa6c750c0a511da0184e9914484a7293a63f5e5817b57ce9bef8ef559b8df',
         n: 262144,
         r: 8,
         p: 1 },
      mac: '33fb274ba8eb91674f0e5957e86784358cf65d9593c4b1e55333299a94249565' } }
```

#### decryptUtcKeystoreToPkey(keystore, password)

Decrypt the utc-type keystore using the keystore and password to get the privatekey

##### Parameters

- keystore string
- password string

##### Returns

- privatekey Buffer

##### Example

See decryptKeystoreToPkey

#### determineKeystoreType(keystore)

Analyze the keystore to get the keystore type

##### Parameters

- keystore string

##### Returns

- type string

##### Example

```javascript
const keystore = "{"version":3,"id":"e603b01d-9aa9-4ddf-a165-1b21630237a5","address":"2131b0816b3ef8fe2d120e32b20d15c866e6b4c1","Crypto":{"ciphertext":"7e0c30a985cf29493486acaf86259a2cb0eb45befb367ab59a0baa7738adf49e","cipherparams":{"iv":"54bbb6e77719a13c3fc2072bb88a708c"},"cipher":"aes-128-ctr","kdf":"scrypt","kdfparams":{"dklen":32,"salt":"50c31e2a99f231b09201494cac1cf0943246edcc6864a91cc931563cd11eb0ce","n":1024,"r":8,"p":1},"mac":"13d3566174d20d93d2fb447167c21a127190d4b9b4843fe7cbebeb6054639a4f"}}";
 const type = determineKeystoreType(keystore);
 //type:v2-v3-utc
```

#### decryptPresaleToPrivKey(keystore, password)

Decrypt the presale keystore type using the keystore and password

##### Parameters

- keystore string
- password string

##### Returns

- privatekey Buffer

##### Example

See decryptKeystoreToPkey

#### decryptMewV1ToPrivKey(keystore, password)

Decrypt the v-1-encrypted privatekey using the keystore and password

##### Parameters

- keystore string
- password string

##### Returns

- privatekey Buffer

##### Example

See decryptKeystoreToPkey

#### isKeystorePassRequired(keystore)

By analyzing the keystore, we determine if the keystore unlocks need a password

##### Parameters

- keystone string

##### Returns

- isPasswordRequired bool

##### Example

```javascript
const keystore = "{"version":3,"id":"e603b01d-9aa9-4ddf-a165-1b21630237a5","address":"2131b0816b3ef8fe2d120e32b20d15c866e6b4c1","Crypto":{"ciphertext":"7e0c30a985cf29493486acaf86259a2cb0eb45befb367ab59a0baa7738adf49e","cipherparams":{"iv":"54bbb6e77719a13c3fc2072bb88a708c"},"cipher":"aes-128-ctr","kdf":"scrypt","kdfparams":{"dklen":32,"salt":"50c31e2a99f231b09201494cac1cf0943246edcc6864a91cc931563cd11eb0ce","n":1024,"r":8,"p":1},"mac":"13d3566174d20d93d2fb447167c21a127190d4b9b4843fe7cbebeb6054639a4f"}}";
 const isPasswordRequired = isKeystorePassRequired(keystore);
 // true
```

#### getFileName(address)

Get the keystore file name of the V3 specification

##### Parameters

- address Address

##### Returns

- fileName string

##### Example

```javascript
const address = "0x48ff2269e58a373120FFdBBdEE3FBceA854AC30A";
 const fileName = getFileName(address);
 //fileName:"UTC--2018-03-07T07-03-45.764Z--48ff2269e58a373120ffdbbdee3fbcea854ac30a.json"
```

### ledger

#### connect()

Connect Ledger wallet to get a connection.

##### Example

```javascript
const response = await connect()；
 if(!response.error){
     const ledger = response.result
 }
```

#### getXPubKey(dpath,ledgerConnect)

Get the publicKey and chainCode of the specified dpath

##### Parameters

- dpath string
- ledgerConnect Ledger, real connection example

##### Returns

- response
  - publicKey hex string
  - chainCode hex string

##### Example

```javascript
const dpath = "m/44'/60'/0'/0";
 const response = await getXPubKey(dpath,ledger)
 if(!response.error){
    const result = response.result  
 }
 //result:{ "chainCode":"e755d0397636c4ab0a2c8aaf3b624f668d7c01de7afab2628fe498adf1d38c4c",
   "publicKey": "027b9dca5697352f06f9f696757c5849460fd030322e086419467f9ccf146520bd",
 }
```

#### signMessage(dpath, message, ledgerConnect)

Sign the specified message

##### Parameters

- dpath string
- message string
- ledgerConnnect Ledger, connection example

##### Returns

- sig
  - r  hex string
  - s  hex string
  - v  number

##### Example

```javascript
const dpath = "m/44'/60'/0'/0";
 const message = 'loopring';
 const sig = await signMessage(dpath,message,ledger);
```

#### signEthereumTx(dpath, rawTx, ledgerConnect)

Signing the specified rawTx

##### Parameters

- dpath string
-  rawTx object
  - chainId number - For example, the chainId of Ethereum main network is 1.
  - nonce hex string
  - value hex string
  - data hex string
  -  gasPrice hex string
  - gasLimit hex string
  - to address

##### Returns

Reference KeyAccount.signEthereumTx(rawTx)

##### Example

```javascript
const dpath = "m/44'/60'/0'/0";
 const rawTx = {
   "gasPrice": "0x4e3b29200",
   "gasLimit": "0x15f90",
   "to": "0x88699e7fee2da0462981a08a15a3b940304cc516",
   "value": "0x56bc75e2d63100000",
   "data": "",
   "chainId": 1,
   "nonce": "0x9b"
 };
 const response = await signEthereumTx(dpath,rawTx,ledger);
 if(!response.error){
     const signedTx = response.result;
 }
```

### MetaMask

#### sign(web3, account, hash)

Using MetaMask, the hash is signed with the specified account. MetaMask signs the hash and does not add Ethereum header information.

##### Parameters

- web3
-  account  address
- hash  string

##### Returns

- sig
  -  r  hex string
  - s  hex string
  - v  number

##### **Example**

```javascript
const web3 = window.web3 // MetaMask 
 const message = 'loopring';
 const account = '0x48ff2269e58a373120FFdBBdEE3FBceA854AC30A';
 const sig = await sign(web3,account,toBuffer(message))
```

#### signMessage(web3,account,message)

Signing the Message automatically adds Ethereum-defined prefix information ("\x19Ethereum Signed Message:\n" + len(keccak256(message)).

##### Parameters

- web3

- account  address

- hash  string

##### Returns

- sig
  -  r  hex string
  -  s  hex string
  -  v  number

##### Example

```javascript
const message = 'loopring'；
 const web3 = window.web3
 const account = '0x48ff2269e58a373120FFdBBdEE3FBceA854AC30A';
 const sig = await signMessage(web3,account,message)
```

#### signEthereumTx(web3, account, rawTx)

Sign Ethereum tx, returning signed serialized tx

##### Parameters

- web3
- account  address
- rawTx  object
  - chainId  number - for example, the chainId of the Ethereum main network is 1.
  -  nonce  hex string
  -  value  hex string
  - data  hex string
  - gasPrice  hex string
  - gasLimit  hex string
  - to  address

##### Returns

Reference KeyAccount.signEthereumTx(rawTx)

##### Example

```javascript
const web3 = window.web3
 const account = "0x48ff2269e58a373120FFdBBdEE3FBceA854AC30A";
 const rawTx = {
   "gasPrice": "0x4e3b29200",
   "gasLimit": "0x15f90",
   "to": "0x88699e7fee2da0462981a08a15a3b940304cc516",
   "value": "0x56bc75e2d63100000",
   "data": "",
   "chainId": 1,
   "nonce": "0x9b"
 };
 const response = await signEthereumTx(web3,account,rawTx)
 if(!response.error){
      const signedTx = response.result;
 }
```

#### sendTransaction(web3,tx)

Send Ethereum Trading via MetaMask

##### Paramters

- web3
-  tx
  - nonce  hex string
  - value  hex string
  - data  hex string
  - gasPrice  hex string
  - gasLimit  hex string
  - to  address

##### Returns

- txHash  hex string

##### Example

```javascript
const rawTx = {
   "gasPrice": "0x4e3b29200",
   "gasLimit": "0x15f90",
   "to": "0x88699e7fee2da0462981a08a15a3b940304cc516",
   "value": "0x56bc75e2d63100000",
   "data": "",
   "nonce": "0x9b"
 };
 const web3 = window.web3
 const response = await sendTransaction(web3,rawTx);
 if(!response.error){
     const txHash = response.result;
 }
```

### Mnemonic

#### mnemonictoPrivatekey(mnemonic, dpath, password)

Decrypt mnemonics to get private keys

##### Parameters

- mnemonic  string
- dpath  string
- password  string (optional)

##### Returns

- privateKey  Buffer

##### Example

```javascript
const mnemonic = "seven museum glove patrol gain dumb dawn bridge task alone lion check interest hair scare cash sentence diary better kingdom remember nerve sunset move"；
const dpath = "m/44'/60'/0'/0/0";
const privateKey = mnemonictoPrivatekey(mnemonic,dpath);
```

#### isValidateMnemonic(mnemonic)

Determine the validity of mnemonic

##### Parameters

- mnemonic  string

##### Returns

- isValid  bool

##### Example

```javascript
const menmonic = "seven museum glove patrol gain dumb dawn bridge task alone lion check interest hair scare cash sentence diary better kingdom remember nerve sunset move";
 const isValid = isValidateMnemonic(mnemonic);
 //isValid true
```

###  Trezor

#### getAddress(dpath)

Get the address through the specified dpath

##### Parameters

Reference ledger.getAddress

##### Returns

Reference ledger.getAddress

##### Example

Reference ledger.getAddress

#### signMessage(dpath, message)

Specify the account using dpath and sign the message. The header information is added to the signature, but it is different from Ethereum's rules, because TREZOR's signature information can only be verified by TREZOR.

##### Parameters

- dpath  string
- message  string

##### Returns

-  sig
  - r  hex string
  -  s  hex string
  -  v  number

##### **Example**

```javascript
const message = 'loopring';
 const dpath = "m/44'/60'/0'/0/0";
 const response = await signMessage(dpath,message);
 if(!response.error){
     const sig = response.result;
 }
 //sig:{
     r:"0xcd2d7bb6ca215d4f7faf637da0db43d2ff6d2be095db0961c94b1e5f364dedc4",
     s:"0x42d5d8a55dc56e06dee07fbea65949092dd4b98a928de426d60c55d16e045141",
     v:28
     }
```

#### signEthereumTx(dpath, rawTx)

Specify the account using dpath and sign the rawTx.

##### Parameters

- dpath  string
- rawTx
  - nonce  hex string
  - value  hex string
  -  data  hex string
  - gasPrice  hex string
  -  gasLimit  hex string
  -  to  address
  - chainId  number

##### Returns

- signTx  hex string

##### Example

```javascript
const rawTx = {
   "gasPrice": "0x4e3b29200",
   "gasLimit": "0x15f90",
   "to": "0x88699e7fee2da0462981a08a15a3b940304cc516",
   "value": "0x56bc75e2d63100000",
   "data": "",
   "chainId": 1,
   "nonce": "0x9b"
 };
 const dpath = "m/44'/60'/0'/0/0";
 const response = await signEthereumTx(dpath,rawTx)
 if(!response.error){
     const tx = response.tx
 }
 //tx:0xf86f819b8504e3b2920083015f909488699e7fee2da0462981a08a15a3b940304cc51689056bc75e2d631000008025a0d75c34cf2236bf632126f10d9ee8e963bf94623f8ec2dedb59c6d13342dbe3bea0644afdfa9812f494eee21adafc1b268c5b88bc47905880577876a8a293bd9c66
```

#### getXPubKey(dpath)

PublicKey and chainCode of the account that obtained the specified dpath

##### Parameters

- dpath  string

##### Returns

- publicKey

- chainCode

##### Example

```javascript
const dpath = "m/44'/60'/0'/0";
 const response = await getXPubKey(dpath);
 if(!response.error){
     const result = response.result;
 }
 // {publicKey:"029a29b250b48fb317b81717d405f8fcf54a6bcd25d5a4f9e446db01d14c84bf9d",
    chainCode:"9bc5b6e72a92ba96f97f7b16296268c1c5b06a1ddaa22a4d821986a06b2ae16e"};

```

### Contracts

According to Ethereum abi, the contract method is implemented.

#### AbiFunction

This function implements the encoded abi method, which is the decoding of the abi output data, and the decoding of the abi input data.

#### Creation Method

##### Parameters

- abiMethod object 
  - inputs  Array, a list of incoming parameters
    -  name  string, the parameter name
    - type, the parameter type 
  - name  string, the abi method name
  - outputs  Array abi method value list

##### Example

```javascript
const abiMethod =   {
     "constant": false,
     "inputs": [
       {
         "name": "_to",
         "type": "address"
       },
       {
         "name": "_value",
         "type": "uint256"
       }
     ],
     "name": "transfer",
     "outputs": [
       {
         "name": "",
         "type": "bool"
       }
     ],
     "payable": false,
     "stateMutability": "nonpayable",
     "type": "function"
   }；
   const abiFunction = new AbiFunction(abiMethod);
```

#### encodeInputs(inputs)

Encode the input data

##### Parameters

-  inputs  object, abi method corresponding parameter. The key of the inputs is the name of the abi method.

##### Returns

- data  hex string (methodId + parameters), corresponds to the Ethereum TX data

##### Examples

```javascript
const _to = "0x88699e7fee2da0462981a08a15a3b940304cc516";
 const _value = "0xde0b6b3a7640000";
 const data = abiFunction.encodeInputs({_to,_value});
 //data: "0xa9059cbb000000000000000000000000d91a7cb8efc59f485e999f02019bf2947b15ee1d0000000000000000000000000000000000000000000008ac7230489e80000";
```

#### decodeEncodedInputs(encodedInputs)

Decode input parameters that have been encoded

##### Parameter

encodedInputs  hex string

##### Returns

-  inputs  Array

##### Example

```javascript
const data = "0x00000000000000000000000088699e7fee2da0462981a08a15a3b940304cc5160000000000000000000000000000000000000000000000de0b6b3a7640000";
 const inputs = abiFunction.decodeEncodedInputs(data);
 //inputs ['88699e7fee2da0462981a08a15a3b940304cc516','0xde0b6b3a7640000']
```

#### decodeOutputs(outputs)

decode abi method and return output values

##### Parameter

- data  hex string

##### Returns

- outputs  Array

##### Example

```javascript
const abiMethod =   {
     "constant": true,
     "inputs": [
       {
         "name": "_owner",
         "type": "address"
       }
     ],
     "name": "balanceOf",
     "outputs": [
       {
         "name": "balance",
         "type": "uint256"
       }
     ],
     "payable": false,
     "stateMutability": "view",
     "type": "function"
   };
 const abiFunction = new AbiFunctions(abiMethod);
 const data = '0x000000000000000000000000000000000000000000e6cbc4f6ec6156401801fc';
 const outputs = abiFunction.decodeOutputs(data);
 //outputs:['0xe6cbc4f6ec6156401801fc']
```

#### Contract

#### Creation Method

●      abi contract abi

##### Example

```javascript
const abi = [
   {
     "constant": true,
     "inputs": [],
     "name": "name",
     "outputs": [
       {
         "name": "",
         "type": "string"
       }
     ],
     "payable": false,
     "stateMutability": "view",
     "type": "function"
   },
   {
     "constant": false,
     "inputs": [
       {
         "name": "_spender",
         "type": "address"
       },
       {
         "name": "_value",
         "type": "uint256"
       }
     ],
     "name": "approve",
     "outputs": [
       {
         "name": "",
         "type": "bool"
       }
     ],
     "payable": false,
     "stateMutability": "nonpayable",
     "type": "function"
   }];
   const contract = new Contract(abi);
```

#### encodeInputs(method, inputs)

This method specifies that the inputs must be encoded

##### Parameter

- Method  string, if there is no method with the same methodName in the abi, it can be called methodName. Otherwise, the argument will pass on this type of methodName + methodId.

##### Returns

- data  hex string

##### Example

```javascript
const method='transfer' //(transfer(address,uint256)  '0xa9059cbb')
  const _to = "0x88699e7fee2da0462981a08a15a3b940304cc516";
  const _value = "0xde0b6b3a7640000";
  const data = contract.encodeInputs(method,{_to,_value})
  //data:"0xa9059cbb000000000000000000000000d91a7cb8efc59f485e999f02019bf2947b15ee1d0000000000000000000000000000000000000000000008ac7230489e80000"
```

#### decodeEncodeInputs(data)

Decode the encoded input parameter data of the specified method.

##### Parameters

- data  hex string (methodId + parameters)

##### Returns

-  inputs  Array

##### Example

```javascript
const data = "0xa9059cbb000000000000000000000000d91a7cb8efc59f485e999f02019bf2947b15ee1d0000000000000000000000000000000000000000000008ac7230489e80000"；
 const inputs = contract.decodeEncodeInputs(data);
 //inputs:['88699e7fee2da0462981a08a15a3b940304cc516','0xde0b6b3a7640000']
```

#### decodeOutputs(method, data)

Decode the output data of the specified method

##### Parameters

- Method  string, if there is no method with the same methodName in the abi, it can be called methodName. Otherwise, you should pass the methodName + inputs type or methodId.

##### Returns

- outputs  Array

##### Example

```javascript
const method = 'balanceOf'
 const data = '0x000000000000000000000000000000000000000000e6cbc4f6ec6156401801fc';
 const outputs = contract.decodeOutputs(method, data);
 //outputs:['0xe6cbc4f6ec6156401801fc']
```

#### Contracts

Multiple access to Loopring protocol’s commonly used contracts. Including ERC-20, WETH, AirdropContract, and Loopring Protocol.

LoopringProtocol captures the encodECancelOrder and the encodeSubmitRing

#### encodeCancelOrder(signedOrder, amount)

There is a specified number of orders that can be assigned at once. If the amount exceeds the order availability, the order is marked as complete cancellation.

##### Parameters

- signedOrder
  - protocol  address, here is an example version 1.5.1 protocol address: 0x8d8812b72d1e4ffCeC158D25f56748b7d67c1e78
  - delegate  address, the Loopring protocol authorization address, here is an example version 1.5.1 address: 0x17233e07c67d086464fD408148c3ABB56245FA64
  -  owner  address, the address of the ordering user
  - tokenS  address, the contract address that is selling currency 
  - tokenB  address, the contract address that is buying currency 
  - authAddr  address, randomly generated account address
  -  authPriavteKey  privatekey, randomly generated privatekey corresponding to the account
  -  validSince  hex string, the order effective time, timestamp in seconds
  - validUntil  hex string, the order expiration time, timestamp in seconds
  -  amountB  hex string, the amount of tokenB to buy (here in units of the smallest unit)
  - amountS  hex string, the amount of tokenS to sell (here in units of the smallest unit)
  - walletAddress  address, address of the wallet that receives the tokens from an order
  - buyNoMoreThanAmountB  bool, true if amountB is greater than tokenB
  -  lrcFee  hex string, orders fully match the maximum amount of fees that need to be paid. (Here the unit of LRC is the smallest unit)
  - marginSplitPercentage  number(0–100), the proportion of funds used to pay for the reconciliation
  - r  hex string
  - s  hex string
  -  v  number
  - powNonce  number, a random number that satisfies the degree of difficulty

- amount  number, the quantity to be cancelled is defaulted to the full quantity of the order

##### Returns

- data  hex string

##### Example

```javascript
const signedOrder = {
   "delegateAddress": "0x17233e07c67d086464fD408148c3ABB56245FA64",
   "protocol": "0x8d8812b72d1e4ffCeC158D25f56748b7d67c1e78",
   "owner": "0xb94065482ad64d4c2b9252358d746b39e820a582",
   "tokenB": "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
   "tokenS": "0xEF68e7C694F40c8202821eDF525dE3782458639f",
   "amountB": "0x429d069189e0000",
   "amountS": "0xad78ebc5ac6200000",
   "lrcFee": "0x928ca80cfc20000",
   "validSince": "0x5b038122",
   "validUntil": "0x5b04d2a2",
   "marginSplitPercentage": 50,
   "buyNoMoreThanAmountB": false,
   "walletAddress": "0xb94065482ad64d4c2b9252358d746b39e820a582",
   "authAddr": "0x5b98dac691be2f2882bfb79067ee50c221d20203",
   "authPrivateKey": "89fb80ba23d355686ff0b2093100af2d6a2ec071fe98c33252878caeab738e37",
   "v": 28,
   "r": "0xbdf3c5bdeeadbddc0995d7fb51471e2166774c8ad5ed9cc315635985c190e573",
   "s": "0x4ab135ff654c3f5e87183865175b6180e342565525eefc56bf2a0d5d5c564a73",
   "powNonce": 100
 };
 const data = LoopringProtocol.encodeCancelOrder(signedOrder);
 //data : 
 "0x8c59f7ca000000000000000000000000b94065482ad64d4c2b9252358d746b39e820a582000000000000000000000000ef68e7c694f40c8202821edf525de3782458639f000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2000000000000000000000000b94065482ad64d4c2b9252358d746b39e820a5820000000000000000000000005b98dac691be2f2882bfb79067ee50c221d2020300000000000000000000000000000000000000000000000ad78ebc5ac62000000000000000000000000000000000000000000000000000000429d069189e0000000000000000000000000000000000000000000000000000000000005b038122000000000000000000000000000000000000000000000000000000005b04d2a20000000000000000000000000000000000000000000000000928ca80cfc2000000000000000000000000000000000000000000000000000ad78ebc5ac620000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000032000000000000000000000000000000000000000000000000000000000000001cbdf3c5bdeeadbddc0995d7fb51471e2166774c8ad5ed9cc315635985c190e5734ab135ff654c3f5e87183865175b6180e342565525eefc56bf2a0d5d5c564a73"
```

#### encodeSubmitRing(orders,feeRecipient, feeSelections)

##### Parameters

- orders  order

- feeRecipient  address

- feeSelections 0 1 (0 means select sub-run, 1 means select lrcFee, the default is 1)

##### Returns

-  data  hex string

### ETH

Implement part of the Ethereum jsonrpc interface

#### Creation Method

##### Parameters

- host  string

##### **Example**

```javascript
const host = 'localhost:8545';
const ethNode = new Eth(host);
```

#### getTransactionCount({address,tag})

Get the transactionCount at the specified address

For details, reference: [Ethereum Jsonrpc eth_getTransactionCount interface](https://github.com/ethereum/wiki/wiki/JSON-RPC#eth_gettransactioncount)

#### sendRawTransaction(signTx)

Send signature transactions to Ethereum nodes

For details, reference: [Ethereum JSON-RPC eth_sendRawTransaction interface](https://github.com/ethereum/wiki/wiki/JSON-RPC#eth_sendrawtransaction)

#### getGasPrice()

Get the average gas price of the Ethereum network

For details, reference: [Ethereum JSON-RPC eth_gasPrice interface](https://github.com/ethereum/wiki/wiki/JSON-RPC#eth_gasprice)

#### getAccountBalance({address,tag})

Get the Ethereum balance for the specified address

For details, reference: [Ethereum JSON-RPC eth_getBalance interface](https://github.com/ethereum/wiki/wiki/JSON-RPC#eth_getbalance)

#### getTransactionByhash(hash)

Get the transaction details for the specified hash

For details, reference: [Ethereum JSON-RPC eth_getTransactionByHash interface](https://github.com/ethereum/wiki/wiki/JSON-RPC#eth_gettransactionbyhash)

#### call({tx,tag})

Simulate a tx

For details, reference: [Ethereum JSON-RPC eth_call interface](https://github.com/ethereum/wiki/wiki/JSON-RPC#eth_call)

### Relay

Implement Loopring Relay's JSON-RPC interface and Socket interface. See the Loopring Relay interface for more details. [Loopring Relay Documents](https://loopring.github.io/relay-cluster/relay_api_spec_v2)

#### Creation Method

##### Parameters

- host Loopring Relay host

##### Account

Implement the relevant JSON-RPC interface of the Loopring Relay.

##### getBalance({delegateAddress, owner})

Get the account balance of the specified owner and the authorized value of the Loopring address delegateAddress.

For details, reference: [Loopring Relay getBalance interface](https://loopring.github.io/relay-cluster/relay_api_spec_v2#loopring_getbalance)

##### Example

```javascript
const owner = "0x88699e7fee2da0462981a08a15a3b940304cc516";
 const delegataAddress = "0x17233e07c67d086464fD408148c3ABB56245FA64";
 const response = relay.account.getBalance({owner,delegataAddress});
```

#### register(owner)

Registers the specified owner address to therelay. After registration, relay will analyze the Ethereum txs that stores the address.

For details, reference: [Loopring Relay register interface](https://loopring.github.io/relay-cluster/relay_api_spec_v2#loopring_unlockwallet)

#### notifyTransactionSubmitted({txHash, rawTx, from})

Informs the Ethereum tx that the Relay has sent. The Relay will track the state of tx.

For details, reference: [Loopring Relay notifyTransactionSubmitted interface](https://loopring.github.io/relay-cluster/relay_api_spec_v2#loopring_notifytransactionsubmitted)

#### getTransactions({owner, status, txHash, pageIndex, pageSize})

Get the Ethereum txs for the specified owner

For details, reference: [Loopring Relay getTransactions interface](https://loopring.github.io/relay-cluster/relay_api_spec_v2#loopring_gettransactions)

#### getFrozenLrcFee(owner)

The sum of the LRC Fee required to obtain a valid order for the specified Owner.

For details, reference: [Loopring Relay getFrozenLrcFee interface](https://loopring.github.io/relay-cluster/relay_api_spec_v2#loopring_getgetfrozenlrcfee)

#### getPortfolio(owner)

Get the specified owner address of the portfolio

For details, reference: [Loopring Relay getPortfolio interface](https://loopring.github.io/relay-cluster/relay_api_spec_v2#loopring_getportfolio)

#### Market

Implement Loopring Relay Market related JSON-RPC interface

#### getPriceQuote(currency)

Get the price of the specified Currency for all tokens supported by the Relay

For details, reference: [Loopring Relay getPriceQuote interface](https://loopring.github.io/relay-cluster/relay_api_spec_v2#loopring_getpricequote)

#### getSupportedMarket()

Get all the markets supported by the Relay

For details, reference: [Loopring Relay getSupportedMarket inteface](https://loopring.github.io/relay-cluster/relay_api_spec_v2#loopring_getsupportedmarket)

#### getSupportedTokens()

Get all tokens supported by the Relay

For details, reference: [Loopring Relay getSupportedTokens interface](https://loopring.github.io/relay-cluster/relay_api_spec_v2#loopring_getsupportedtokens)

#### getDepth(filter)

Get the depth of the market

For details, reference: [Loopring Relay getDepth interface](https://loopring.github.io/relay-cluster/relay_api_spec_v2#loopring_getdepth)

#### getTicker()

Get 24-hour combined trade statistics for all Loopring markets

For details, reference: [Loopring Relay getTicker interface](https://loopring.github.io/relay-cluster/relay_api_spec_v2#loopring_getticker)

#### getTickers(market)

Get statistics on the 24-hour merger of multiple exchanges destined for the market

For details, reference: [Loopring Relay getTickers](https://loopring.github.io/relay-cluster/relay_api_spec_v2#loopring_gettickers)

#### getTrend({market, interval})

Obtain trend information such as price changes for specific markets at multiple specified exchanges

For details, reference: [Loopring Relay getTrend interface](https://loopring.github.io/relay-cluster/relay_api_spec_v2#loopring_gettrend)

### Order

Implement Loopring Relay

#### getOrders(filter)

Get a Loopring order list

For details, reference: [Loopring Relay getOrders interface](https://loopring.github.io/relay-cluster/relay_api_spec_v2#loopring_getorders)

#### getCutoff({address, delegateAddress, blockNumber})

Get the destined address and the cutoff timestamp of the delegateAddress of the corresponding loopring. Orders before the corresponding cutoff time will be cancelled.

For details, reference: [Loopring Relay getCutoff interface](https://loopring.github.io/relay-cluster/relay_api_spec_v2#loopring_getcutoff)

#### placeOrder(order)

Submit Order to the Loopring Relay

For details, reference: [Loopring Relay placeOrder interface](https://loopring.github.io/relay-cluster/relay_api_spec_v2#loopring_submitorder)

#### getOrderHash(order)

Calculate orderHash

### Ring

Implementing the Loopring Relay JSON-RPC interface

#### getRings(fiter)

Get a ring that has been matched

For details, reference: [Loopring Relay getRings interface](https://loopring.github.io/relay-cluster/relay_api_spec_v2#loopring_getringmined)

#### getRingMinedDetail({ringIndex, protocolAddress})

Get ring details

For details, reference: [Loopring Relay getRingMinedDetail interface](https://loopring.github.io/relay-cluster/relay_api_spec_v2#loopring_getRingMinedDetail)

#### getFills(filter)

Get order match history

For details, reference: [Loopring Relay getFills interface ](https://loopring.github.io/relay-cluster/relay_api_spec_v2#loopring_getfills)

### socket

The Loopring Relay implements Web Sockets using socket.io. See the Loopring Relay socket event list for details: [Loopring Relay socket interface](https://loopring.github.io/relay-cluster/relay_api_spec_v2)

#### Creation Method

Connect to the socket server for the specified url. For details, reference: [socket.io_client api documents](https://github.com/socketio/socket.io-client/blob/master/docs/API.md#iourl-options)

##### Parameters

- url string

- options object (Optional)

##### **Example**

```javascript
const url = 'ws://relay.loopring'
const options= {transports: ['websocket']};
const socket = new Socket(url,options)
```

#### emit (event, options)

Send a message to the relay, then start monitoring the specified event or update the conditions of the specified event

##### Parameters

- event string

- options string(json) event, the parameters

##### Example

```javascript
const event = 'portfolio_req';
const options = '{"owner" : "0x847983c3a34afa192cfee860698584c030f4c9db1"}';
socket.emit(event,options)
```

#### on(event,handle)

Focus on the data of the specified event

##### Parameters

- event string
-  handle function, processing data returned

##### Example

```javascript
const event = "portfolio_res"
const handle = (data)=> {console.log(data)}
socket.on(event,handle);
```

#### close()

Manually disconnect the socket connection

##### Example

```javascript
socket.close()
```

