## 关于Loopring.js

该开发者文档主要介绍如果使用loopring.js接入路印协议。文档主要包括两个部分，Ethereum 部分和Relay接入部分。

Ethereum 部分主要针对以太坊钱包功能。可以实现以太坊账户的生成，私钥解锁，助记词解锁与生成，keystore 的解锁生成，MetaMask的接入，Trezor 以及Ledger等硬件钱包的接入都账户功能，可以实现以太坊交易的签名，实现信息签名，路印订单签名等签名功能，可以实现以太坊合约调用中abi功能以及abi信息的解析。同时该部分还实现了部分以太坊JSON-RPC的接口，包括eth_getTransactionCount，eth_sendRawTransaction，eth_gasPrice，eth_estimateGas，eth_getBalance，eth_getTransactionByHash，eth_call。

Relay 部分主要针对Loopring Relay的接口接入，包括JSON-RPC 接口和SocketIO接口。具体的接口详情见[Loopring Relay 接入文档](https://loopring.github.io/relay-cluster/relay_api_spec_v2)。

## 获取

```javascript
 npm install loopring.js --save
```
  
## 浏览器端使用方法

loopring.js包含UMD规范的版本和CommonJS规范的版本

### UMD 规范包

通过下面的方式引入 loopring.min.js

```javascript
<script src="../node_modules/loopring/dist/loopring.min.js"></script>
```

通过下面的方式获得获得loopring

```javascript
window.loopring.common
window.loopring.ethereum
window.loopring.relay
```

### CommonJS  规范包  (要求引入babel-polyfill)

```javascript
import loopring from 'loopring.js';
or
import {relay} from 'loopring.js';
or
const loopring = require('loopring.js');
```

## Ethereum

### Account

#### path

常量，路印钱包中使用的dpath，（m/44'/60'/0'/0）

#### privateKeytoAddress(privatekey)

通过私钥获取地址

##### 参数

- privatekey  hex string or  Buffer

#####  返回值

- address

##### 代码样例：

```js
const pKey = "07ae9ee56203d29171ce3de536d7742e0af4df5b7f62d298a0445d11e466bf9e";
privateKeytoAddress(pkey); //address:0x48ff2269e58a373120FFdBBdEE3FBceA854AC30A
```

#### publicKeytoAddress（publicKey，sanitize）

通过公钥获得地址

##### 参数

- publicKey	hex string  or Buffer
- sanitize           bool 默认是false

##### 返回值

- address

##### 代码样例 

```javascript
const publicKey = "0895b915149d15148ac4171f453060d6b53a9ebb694689351df8e3a49c109c7a65374b5c196ce8cc35ff79cb3ce54ea1695704dd5b3cfc6864bd110b62cfd509";
publicKeytoAddress(publicKey)//address:0x48ff2269e58a373120FFdBBdEE3FBceA854AC30A
```

#### privateKeytoPublic(privatekey)

通过私钥获取公钥

##### 参数

- privateKey hex string Buffer

##### 返回值

- publickey hex string without prefix

##### 代码样例

```javascript
const privateKey = '07ae9ee56203d29171ce3de536d7742e0af4df5b7f62d298a0445d11e466bf9e';
const publicKey = privateKeytoPublic(privateKey);
//publicKey:"0895b915149d15148ac4171f453060d6b53a9ebb694689351df8e3a49c109c7a65374b5c196ce8cc35ff79cb3ce54ea1695704dd5b3cfc6864bd110b62cfd509"
```

#### fromMnemonic(mnemonic, dpath, password)

通过助记词，dpath，以及密码生成Account 实例。

##### 参数

- mnemonic   string 
- dpath       string
- password  string  可以为空

##### 返回值

- account   KeyAccount实例

```javascript
const mnemonic = "seven museum glove patrol gain dumb dawn bridge task alone lion check interest hair scare cash sentence diary better kingdom remember nerve sunset move";
const dpath = "m/44'/60'/0'/0/0";
const password = "1111111";
const account =  fromMnemonic(mnemonic,dpath,password);
```

#### fromKeystore(keystone,password)

通过keystore 和password获得keyAccount 实例

##### 参数

- keystore  string
- password string 可以为空，根据keystore 是否需要密码解锁而定。

##### 返回值

- account  KeyAccount

##### 代码样例

```javascript
const keystore = "{"version":3,"id":"e603b01d-9aa9-4ddf-a165-1b21630237a5","address":"2131b0816b3ef8fe2d120e32b20d15c866e6b4c1","Crypto":{"ciphertext":"7e0c30a985cf29493486acaf86259a2cb0eb45befb367ab59a0baa7738adf49e","cipherparams":{"iv":"54bbb6e77719a13c3fc2072bb88a708c"},"cipher":"aes-128-ctr","kdf":"scrypt","kdfparams":{"dklen":32,"salt":"50c31e2a99f231b09201494cac1cf0943246edcc6864a91cc931563cd11eb0ce","n":1024,"r":8,"p":1},"mac":"13d3566174d20d93d2fb447167c21a127190d4b9b4843fe7cbebeb6054639a4f"}}";
const password = "1111111";
const account =  fromKeystore(keystore,password);
```

#### fromPrivateKey(privateKey)

通过privateKey 获得KeyAccount 实例。

##### 参数

- privateKey   hex string  Buffer

##### 返回值

- account KeyAccount

##### 代码样例

```javascript
const privateKey = "07ae9ee56203d29171ce3de536d7742e0af4df5b7f62d298a0445d11e466bf9e";
const account = fromPrivateKey(privateKey);
```

#### createMnemonic()

生成一组24个单词组成的英文助记词

##### 返回值

- mnemonic  string

```javascript
const mnemonic = createMnemonic();
// mnemonic: "seven museum glove patrol gain dumb dawn bridge task alone lion check interest hair scare cash sentence diary better kingdom remember nerve sunset move"
```

#### getAddresses({publicKey, chainCode, pageSize, pageNum})

使用publicKey 和chainCode 获取指定pageSize数量的地址。

##### 参数

- publicKey     hex string  Buffer
- chainCode   hex string  Buffer
- pageSize   number  
- pageNum  number

##### 返回值

-  Address[pageSize]

##### 代码样例

```js
const publicKey = "029a29b250b48fb317b81717d405f8fcf54a6bcd25d5a4f9e446db01d14c84bf9d";
const chainCode = "9bc5b6e72a92ba96f97f7b16296268c1c5b06a1ddaa22a4d821986a06b2ae16e";
const pageSize = 5;
const pageNum=0;
const addresses = getAddresses({publicKey, chainCode, pageSize, pageNum});
//addresses:["0xc57bb1cd690e7483ee2d2b4ecee060145a33fa3c","0x7d0749db3013f6e4c949d7810630aebe0e2e8756","0x7a9bbf63e8cc2bd7dba83884b6ed2d1e2e764409","0xef803e1d485fe9ae9ea6308d5c5d874cc011ac9a","0xfdffa0f9d72f7766b204bb8d6166990548419d96"]
```

### Account 

Account 类，实现了sendTransaction方法。

#### sendTransaction（host，{signTx}）

发送以太坊交易

##### 参数

- host  url 
- signTx  序列化的签名以太坊交易

##### 返回值

- txHash 

##### 样例代码

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

类，扩展了Account 类，在Account 的基础上实现了toV3Keystore，getPublicKey，getAddress，sign,signMessage,signEthereumTx,signOrder方法。

#### 构造方法

##### 参数

- privateKey  hex string or Buffer

##### 代码样例

```javascript
const privateKey = '07ae9ee56203d29171ce3de536d7742e0af4df5b7f62d298a0445d11e466bf9e';
const account = new KeyAccount(privateKey);
```

#### getAddress()

获得账户的地址

##### 返回值

- address 

##### 代码样例

```javascript
account.getAddress();//address:0x48ff2269e58a373120FFdBBdEE3FBceA854AC30A
```

#### getPublicKey()

获取账户的publicKey

##### 返回值

- publicKey hex string

##### 样例代码

```javascript
const publicKey = account.getPublicKey();
//publicKey:"0895b915149d15148ac4171f453060d6b53a9ebb694689351df8e3a49c109c7a65374b5c196ce8cc35ff79cb3ce54ea1695704dd5b3cfc6864bd110b62cfd509"
```

#### toV3Keystore(password)

转成v3型 Keystore Json 

##### 参数

- password string

##### 返回值

-  keystore  object

##### 代码样例

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

对hash签名

##### 参数

- hash Buffer

#####  返回值

- sig   {r, s, v}
  - r   — hex string
  - s  — hex string
  - v  — number

##### 样例代码：

```javascript
const hash = toBuffer('loopring');
const sig = account.sign(hash);
/sig :{ r: '0x87b7472c6116f5fd931b05f7b57c8b87192eb006f0e1376d997e68629d66bde7',
  s: '0x501f9eb08cde1a241595afd91e14d53568365d0124b72cc18fefd2b8ea1223ac',
  v: 28 }
```

#### signMessage(message)

对Message签名，自动添加以太坊规定的前缀信息，即（"\x19Ethereum Signed Message:\n" + len(keccak256(message)）。

##### 参数

- Message  string or Buffer

#####   返回值

- sig   {r, s, v}
  - r   — hex string
  - s  — hex string 
  - v  — number

##### 样例代码

```javascript
const message = 'loopring';
const sig = account.signMessage(messsage);
//sig : { r: '0x83a812a468e90106038ba4f409b2702d14e373c40ad377c92935c61d09f12e53',
  s: '0x666425e6e769c3bf4378408488cd920aeda964d7995dac748529dab396cbaca4',
  v: 28 }
```

#### signEthereumTx(rawTx)

对以太坊交易进行签名，获得序列化的16进制字符形式的tx。

##### 参数

- rawTx 
  - chainId  number    — 例如以太坊主网的chainId为1
  - nonce   hex string or Buffer
  - value   hex string  or Buffer
  - data  hex string    or Buffer
  - gasPrice  hex string or Buffer
  - gasLimit  hex string  or Buffer
  - to   address  or Buffer

##### 返回值

- tx   hex string  序列化后的tx

##### 样例代码

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

 对路印订单进行签名，获得签名后的订单。

##### 参数

- order  
  - protocol    address      路印撮合协议地址，例如 1.5.1版本：0x8d8812b72d1e4ffCeC158D25f56748b7d67c1e78
  - delegate   address      路印协议授权地址，例如 1.5.1 版本 ：0x17233e07c67d086464fD408148c3ABB56245FA64
  - owner       address        订单拥有者，即下单用户的地址
  - tokenS      address         要卖出币种的合约地址
  - tokenB      address         要买入币种的合约地址
  - authAddr   address      随机生成账户对应地址
  - authPriavteKey    privatekey    随机生成账户对应私钥
  - validSince    hex string    订单生效时间，时间戳—秒数。 
  - validUntil     hex string    订单失效时间， 时间戳—秒数。
  - amountB     hex string    要购买的tokenB的数量（这里以最小单位作为单位）
  - amountS     hex string    要出售的tokenS的数量（这里以最小单位作为单位） 
  - walletAddress   address  钱包的订单撮合费收益接收地址
  - buyNoMoreThanAmountB   bool  是不是允许购买超过amountB数量的tokeB
  - lrcFee           hex string    订单完全撮合最多需要支付的撮合费。（这里以LRC的最小单位作单位）
  - marginSplitPercentage   number(0–100)  撮合分润中用来支付撮合费的比例

##### 返回值

- signedOrder   在原order的基础上加上获得的订单签名  r, s,v  

##### 样例代码

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

### TrezorAccount 

类，连接TREZOR的账户，扩展了Account 类，实现了getAddress，signMessage，signEthereumTx。 TREZOR 的signMessage方法与其他的account的签名方式不同，仅可以通过TREZOR本身来验证。因此，TREZOR不支持对Loopring Order 进行签名，这导致TREZOR用户无法通过TREZOR下单，除非通过TREZOR助记词在Loopr 中解锁，下单。

#### 构造方法

##### 参数

- dpath  string

##### 返回值

- account   TrezorAccount

##### 样例代码

```javascript
const dpath = "m/44'/60'/0'/0/0";
const account = new TrezorAccount(dpath);
```

#### getAddress()

获得账户地址

##### 返回值

- address  Address 

##### 代码样例

```javascript
const address = await account.getAddress();
//address:0x48ff2269e58a373120FFdBBdEE3FBceA854AC30A
```

#### signMessage(message)

对Message进行签名，只能被TREZOR进行验证。

##### 参数

- message  string

##### 返回值

- sig 
  - r     hex string
  - s    hex string 
  - v    number

#### 样例代码

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

见KeyAccount.signEthereumTx

#####  参数

见KeyAccount.signEthereumTx

##### 返回值

见KeyAccount.signEthereumTx

##### 代码样例

见KeyAccount.signEthereumTx

### LedgerAccount

类，连接Ledger的账户。扩展Account，实现getAddress，signMessage，signEthereumTx，signOrder。

#### 构造方法

##### 参数

- ledger  Ledger连接实例
- dpath   string 

##### 返回值

- account   LedgerAccount

#### getAddress（）

获得账户地址

##### 返回值

- address    Address

##### 代码样例

```javascript
const address = await account.getAddress();
//address:0x48ff2269e58a373120FFdBBdEE3FBceA854AC30A
```

#### signMessage（message）

对Message签名，自动添加以太坊规定的前缀信息，即（"\x19Ethereum Signed Message:\n" + len(keccak256(message)）。

##### 参数

- message  string

##### 返回值

- sig   {r, s, v}
  - r   — hex string
  - s  — hex string 
  - v  — number

##### 代码样例

```javascript
const message = 'loopring';
const sig = account.signMessage(messsage);
//sig : { r: '0x83a812a468e90106038ba4f409b2702d14e373c40ad377c92935c61d09f12e53',
  s: '0x666425e6e769c3bf4378408488cd920aeda964d7995dac748529dab396cbaca4',
  v: 28 }
```

#### signEthereumTx(rawTx)

见KeyAccount.signEthereumTx

#####  参数

- rawTx  
  - chainId  number    — 例如以太坊主网的chainId为1
  - nonce   hex string
  - value   hex string 
  - data  hex string  
  - gasPrice  hex string 
  - gasLimit  hex string 
  - to   address  or Buffer

##### 返回值

见KeyAccount.signEthereumTx

##### 代码样例

参考KeyAccount.signEthereumTx

#### signOrder(order) 

参考KeyAccount.signOrder

#####  参数

见KeyAccount.signOrder

##### 返回值

参考KeyAccount.signOrder

##### 代码样例

参考KeyAccount.signOrder

### MetaMaskAccount

类，连接MetaMask钱包账户。扩展了Account，实现了getAddress，sign，signMessage，signEthereumTx，signOrder。

#### 构造方法

##### 参数

- web3   web3实例

##### 返回值

- account     MetaMaskAccount

getAddress, sign(hash),  signMessage(message), signEthereumTx(rawTx), signOrder(order) 见KeyAccount对应的方法。

------

### keystore

#### decryptKeystoreToPkey(keystore, password)

通过keystore和password 解锁得到私钥

##### 参数

- keystore    string
- password  string

##### 返回值

- privatekey  Buffer

##### 样例代码

```javascript
const keystore = "{"version":3,"id":"e603b01d-9aa9-4ddf-a165-1b21630237a5","address":"2131b0816b3ef8fe2d120e32b20d15c866e6b4c1","Crypto":{"ciphertext":"7e0c30a985cf29493486acaf86259a2cb0eb45befb367ab59a0baa7738adf49e","cipherparams":{"iv":"54bbb6e77719a13c3fc2072bb88a708c"},"cipher":"aes-128-ctr","kdf":"scrypt","kdfparams":{"dklen":32,"salt":"50c31e2a99f231b09201494cac1cf0943246edcc6864a91cc931563cd11eb0ce","n":1024,"r":8,"p":1},"mac":"13d3566174d20d93d2fb447167c21a127190d4b9b4843fe7cbebeb6054639a4f"}}";
const password = "1111111";
const privatekey =  decryptKeystoreToPkey(keystore,password);
```

#### pkeyToKeystore(privateKey, password)

通过privateKey 和 password 获得Keystore

##### 参数

- privateKey     Buffer
- password       string

##### 返回值

- keystore    Object   

##### 样例代码

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

通过keystore 和password 解锁 utc 类型的keystore，获得privatekey；

##### 参数

- keystore    string
- password   string

##### 返回值

- privatekey   Buffer

##### 样例代码

见decryptKeystoreToPkey

#### determineKeystoreType(keystore)

解析keystore，获得keystore的类型

##### 参数

- keystore    string

##### 返回值

- type  string

##### 样例代码

```
const keystore = "{"version":3,"id":"e603b01d-9aa9-4ddf-a165-1b21630237a5","address":"2131b0816b3ef8fe2d120e32b20d15c866e6b4c1","Crypto":{"ciphertext":"7e0c30a985cf29493486acaf86259a2cb0eb45befb367ab59a0baa7738adf49e","cipherparams":{"iv":"54bbb6e77719a13c3fc2072bb88a708c"},"cipher":"aes-128-ctr","kdf":"scrypt","kdfparams":{"dklen":32,"salt":"50c31e2a99f231b09201494cac1cf0943246edcc6864a91cc931563cd11eb0ce","n":1024,"r":8,"p":1},"mac":"13d3566174d20d93d2fb447167c21a127190d4b9b4843fe7cbebeb6054639a4f"}}";
const type = determineKeystoreType(keystore);
//type:v2-v3-utc
```

#### decryptPresaleToPrivKey(keystore, password)

通过keystore 和 password 解锁 presale 类型的keystore

##### 参数

- keystore    string

- password  string

##### 返回值

- privatekey    Buffer

##### 样例代码

见decryptKeystoreToPkey

#### decryptMewV1ToPrivKey(keystore, password)

通过 keystore 和password，解锁v1-encrypted 类型的keystore

##### 参数

- keystore    string
- password  string

##### 返回值

- privatekey   Buffer

##### 样例代码

见decryptKeystoreToPkey

#### isKeystorePassRequired(keystore)

通过解析keystore，判断keystore解锁是否需要密码。

##### 参数

- keystone  string

##### 返回值

- isPasswordRequired   bool

##### 样例代码

```javascript
const keystore = "{"version":3,"id":"e603b01d-9aa9-4ddf-a165-1b21630237a5","address":"2131b0816b3ef8fe2d120e32b20d15c866e6b4c1","Crypto":{"ciphertext":"7e0c30a985cf29493486acaf86259a2cb0eb45befb367ab59a0baa7738adf49e","cipherparams":{"iv":"54bbb6e77719a13c3fc2072bb88a708c"},"cipher":"aes-128-ctr","kdf":"scrypt","kdfparams":{"dklen":32,"salt":"50c31e2a99f231b09201494cac1cf0943246edcc6864a91cc931563cd11eb0ce","n":1024,"r":8,"p":1},"mac":"13d3566174d20d93d2fb447167c21a127190d4b9b4843fe7cbebeb6054639a4f"}}";
const isPasswordRequired = isKeystorePassRequired(keystore);
// true
```

#### getFileName(address)

获得V3 规范的keystore 文件名

##### 参数

- address   Address

##### 返回值

- fileName  string

##### 样例代码

```javascript
const address = "0x48ff2269e58a373120FFdBBdEE3FBceA854AC30A";
const fileName = getFileName(address);
//fileName:"UTC--2018-03-07T07-03-45.764Z--48ff2269e58a373120ffdbbdee3fbcea854ac30a.json"
```

------

### ledger

#### connect()

连接Ledger钱包，获得连接实例。

##### 样例代码

```javascript
const response = await connect()；
if(!response.error){
    const ledger = response.result
}
```

#### getXPubKey(dpath,ledgerConnect)

获取指定dpath的publicKey和chainCode

##### 参数

- dpath     string
- ledgerConnect      Ledger 连接实例

##### 返回值

- response
  - publicKey   hex string
  - chainCode  hex string

##### 样例代码

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

对指定的message进行签名

##### 参数

- dpath    string
- message  string
- ledgerConnnect   Ledger 连接实例

##### 返回值

- sig 
  - r    hex string 
  - s    hex string
  - v    number

##### 样例代码

```javascript
const dpath = "m/44'/60'/0'/0";
const message = 'loopring';
const sig = await signMessage(dpath,message,ledger);
```

#### signEthereumTx(dpath, rawTx, ledgerConnect)

 对指定的rawTx进行签名

##### 参数

- dpath    string
- rawTx   object  
  - chainId  number    — 例如以太坊主网的chainId为1
  - nonce   hex string 
  - value   hex string  
  - data  hex string  
  - gasPrice  hex string 
  - gasLimit  hex string 
  - to   address 

##### 返回值

参考KeyAccount.signEthereumTx(rawTx)

##### 样例代码

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

------

### MetaMask

#### sign(web3, account, hash)

 通MetaMask,用指定的account 对hash进行签名。MetaMask对hash 签名，不会添加以太坊头部信息。

##### 参数

- web3       web3 实例
- account   address
- hash         string

##### 返回值

- sig 
  - r    hex string 
  - s    hex string
  - v    number

##### 代码样例

```javascript
const web3 = window.web3 // MetaMask 
const message = 'loopring';
const account = '0x48ff2269e58a373120FFdBBdEE3FBceA854AC30A';
const sig = await sign(web3,account,toBuffer(message))
```

#### signMessage(web3,account,message)

对Message签名，自动添加以太坊规定的前缀信息，即（"\x19Ethereum Signed Message:\n" + len(keccak256(message)）。

##### 参数

- web3       web3 实例
- account   address
- hash         string

##### 返回值

- sig 
  - r    hex string 
  - s    hex string
  - v    number

##### 代码样例

```javascript
const message = 'loopring'；
const web3 = window.web3
const account = '0x48ff2269e58a373120FFdBBdEE3FBceA854AC30A';
const sig = await signMessage(web3,account,message)
```

#### signEthereumTx(web3, account, rawTx)

对Ethereum tx 进行签名，返回签名后的序列化的tx

##### 参数

- web3
- account address
- rawTx   object  
  - chainId  number    — 例如以太坊主网的chainId为1
  - nonce   hex string 
  - value   hex string  
  - data  hex string  
  - gasPrice  hex string 
  - gasLimit  hex string 
  - to   address 

##### 返回值

参考KeyAccount.signEthereumTx(rawTx)

##### 代码样例

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

通过MetaMask发送以太坊交易

##### 参数

- web3   web3 
-   tx  
  - nonce   hex string 
  - value   hex string  
  - data  hex string  
  - gasPrice  hex string 
  - gasLimit  hex string 
  - to   address 

##### 返回值

- txHash  hex string

##### 代码样例

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

解锁助记词得到私钥

##### 参数

- mnemonic    string
- dpath            string
- password     string (optional)

##### 返回值

- privateKey Buffer

##### 样例代码

```javascript
const mnemonic = "seven museum glove patrol gain dumb dawn bridge task alone lion check interest hair scare cash sentence diary better kingdom remember nerve sunset move"；
const dpath = "m/44'/60'/0'/0/0";
const privateKey = mnemonictoPrivatekey(mnemonic,dpath);
```

#### isValidateMnemonic(mnemonic)

验证助记词的合法性

##### 参数

- menmonic  string

##### 返回值

- isValid  bool   

##### 样例代码

```javascript
const menmonic = "seven museum glove patrol gain dumb dawn bridge task alone lion check interest hair scare cash sentence diary better kingdom remember nerve sunset move";
const isValid = isValidateMnemonic(mnemonic);
//isValid true
```

------

### Trezor

#### getAddress(dpath)

通过指定的dpath 获得地址

##### 参数

参考ledger.getAddress

##### 返回值

参考ledger.getAddress

##### 样例代码

参考ledger.getAddress

#### signMessage(dpath, message)

用dpath指定账户，对Message进行签名。签名中会添加头部信息，但是与以太坊的规则不同，因此TREZOR的签名信息只能通过TREZOR进行验证。

##### 参数

- dpath           string
- message     string

##### 返回值

- sig
  - r   hex string
  - s   hex string
  - v   number

##### 样例代码

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

用dpath指定账户，对rawTx进行签名。

##### 参数

- dpath    string
- rawTx
  - nonce   hex string 
  - value   hex string  
  - data  hex string  
  - gasPrice  hex string 
  - gasLimit  hex string 
  - to   address 
  - chainId number

##### 返回值

- signTx    hex string

##### 代码样例

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

获得指定dpath的账户的publicKey 和 chainCode

##### 参数

- dpath    string

##### 返回值

- publicKey 
- chainCode 

##### 样例代码

```javascript
const dpath = "m/44'/60'/0'/0";
const response = await getXPubKey(dpath);
if(!response.error){
    const result = response.result;
}
// {publicKey:"029a29b250b48fb317b81717d405f8fcf54a6bcd25d5a4f9e446db01d14c84bf9d",
   chainCode:"9bc5b6e72a92ba96f97f7b16296268c1c5b06a1ddaa22a4d821986a06b2ae16e"};
```

------

### Contracts

根据Ethereum abi，实现对合约方法的调用。

#### AbiFunction

类，实现abi method 的encode，abi output 的decode，abi input encoded 后的数据的decode。

#### 构造方法

##### 参数

-  abiMethod  object
  - inputs  Array   abi method 的传入的参数列表
    - name      string  参数名称
    - type         type     参数类型
  - name     string  abi mthod 的方法名
  - outputs  abi method  的返回值列表

##### 返回值

- 代码样例

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

encode 

##### 参数

- inputs   object  abi method 对应的参数。inputs的key是abi method 的name。

#####  返回值

- data  hex string  （methodId + parameters） 对应于以太坊TX 的data 

##### 样例代码

```javascript
const _to = "0x88699e7fee2da0462981a08a15a3b940304cc516";
const _value = "0xde0b6b3a7640000";
const data = abiFunction.encodeInputs({_to,_value});
//data: "0xa9059cbb000000000000000000000000d91a7cb8efc59f485e999f02019bf2947b15ee1d0000000000000000000000000000000000000000000008ac7230489e80000";
```

#### decodeEncodedInputs(encodedInputs)

decode 已经encoded 的inputs参数

##### 参数

encodedInputs   hex string

##### 返回值

-  inputs Array

##### 代码样例

```javascript
const data = "0x00000000000000000000000088699e7fee2da0462981a08a15a3b940304cc5160000000000000000000000000000000000000000000000de0b6b3a7640000";
const inputs = abiFunction.decodeEncodedInputs(data);
//inputs ['88699e7fee2da0462981a08a15a3b940304cc516','0xde0b6b3a7640000']
```

##### decodeOutputs(outputs)

decode abi method 的返回值

##### 参数

- data  hex string

##### 返回值

- outputs  Array

##### 样例代码

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

##### Contract

根据Ethereum abi，实现对合约方法的调用。

##### 构造方法

- abi    合约abi

##### 代码样例

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

encode 指定方法的inputs。

##### 参数

- method  string , method如果abi中没有相同methodName的Method，可以是methodName。否则应该传入methodName+传入参数的类型或者methodId。

##### 返回值

- data  hex string

##### 代码样例

```javascript
 const method='transfer' //(transfer(address,uint256) or '0xa9059cbb')
 const _to = "0x88699e7fee2da0462981a08a15a3b940304cc516";
 const _value = "0xde0b6b3a7640000";
 const data = contract.encodeInputs(method,{_to,_value})
 //data:"0xa9059cbb000000000000000000000000d91a7cb8efc59f485e999f02019bf2947b15ee1d0000000000000000000000000000000000000000000008ac7230489e80000"
```

#### decodeEncodeInputs(data)

decode 已经encoded 指定method的inputs参数。

##### 参数

- data  hex string   （methodId+ parameters）

##### 返回值

- inputs  Array  

##### 代码样例

```javascript
const data = "0xa9059cbb000000000000000000000000d91a7cb8efc59f485e999f02019bf2947b15ee1d0000000000000000000000000000000000000000000008ac7230489e80000"；
const inputs = contract.decodeEncodeInputs(data);
//inputs:['88699e7fee2da0462981a08a15a3b940304cc516','0xde0b6b3a7640000']
```

#### decodeOutputs(method, data)

decode 指定method的outputs 。

##### 参数

- method  string , method如果abi中没有相同methodName的Method，可以是methodName。否则应该传入methodName+inputs的类型或者methodId。

#####  返回值

- outputs   Array  

##### 代码样例

```javascript
const method = 'balanceOf'
const data = '0x000000000000000000000000000000000000000000e6cbc4f6ec6156401801fc';
const outputs = contract.decodeOutputs(method, data);
//outputs:['0xe6cbc4f6ec6156401801fc']
```

### Contracts

多个接入路印协议常用的合约。包括ERC20，WETH，AirdropContract，LoopringProtocol。

LoopringProtocol 封装实现了encodECancelOrder, encodeSubmitRing

#### encodeCancelOrder(signedOrder, amount)

取消指定amount数量的订单可成交量。如果amount 超过订单可成家量，则订单记为完全取消。

##### 参数

- signedOrder
  - protocol    address      路印撮合协议地址，例如 1.5.1版本：0x8d8812b72d1e4ffCeC158D25f56748b7d67c1e78
  - delegate   address      路印协议授权地址，例如 1.5.1 版本 ：0x17233e07c67d086464fD408148c3ABB56245FA64
  - owner       address        订单拥有者，即下单用户的地址
  - tokenS      address         要卖出币种的合约地址
  - tokenB      address         要买入币种的合约地址
  - authAddr   address      随机生成账户对应地址
  - authPriavteKey    privatekey    随机生成账户对应私钥
  - validSince    hex string    订单生效时间，时间戳—秒数。 
  - validUntil     hex string    订单失效时间， 时间戳—秒数。
  - amountB     hex string    要购买的tokenB的数量（这里以最小单位作为单位）
  - amountS     hex string    要出售的tokenS的数量（这里以最小单位作为单位） 
  - walletAddress   address  钱包的订单撮合费收益接收地址
  - buyNoMoreThanAmountB   bool  是不是允许购买超过amountB数量的tokeB
  - lrcFee           hex string    订单完全撮合最多需要支付的撮合费。（这里以LRC的最小单位作单位）
  - marginSplitPercentage   number(0–100)  撮合分润中用来支付撮合费的比例
  - v               number
  - r               hex string
  - v              hex string
  - powNonce  number     满足难度系数的随机数
  - amount  number or hex string  要取消的数量 ，默认为订单全量

##### 返回值

- data    hex string

##### 代码样例

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

##### 参数

- orders                  order[]
- feeRecipient       address
- feeSelections     0 or1          (0 代表选择分润，1代表选择lrcFee，默认为1)

##### 返回值

- data                     hex string

### ETH

实现部分Ethereum jsonrpc 接口

#### 构造方法

##### 参数

- host  string

##### 样例代码

```javascript
const host = 'localhost:8545';
const ethNode = new Eth(host);
```

#### getTransactionCount({address,tag})

获得指定地址的transactionCount

详情参考[Ethereum Jsonrpc eth_getTransactionCount接口](https://github.com/ethereum/wiki/wiki/JSON-RPC#eth_gettransactioncount) 

#### sendRawTransaction(signTx)

向以太坊节点发送签名交易

详情参考 [Ethereum JSON-RPC eth_sendRawTransaction 接口](https://github.com/ethereum/wiki/wiki/JSON-RPC#eth_sendrawtransaction)

#### getGasPrice()

获得Ethereum 网络的平均gas price

详情参考 [Ethereum JSON-RPC eth_gasPrice 接口](https://github.com/ethereum/wiki/wiki/JSON-RPC#eth_gasprice)

#### getAccountBalance({address,tag})

查询指定address 的Ethereum 余额

详情参考 [Ethereum JSON-RPC eth_getBalance 接口](https://github.com/ethereum/wiki/wiki/JSON-RPC#eth_getbalance)

#### getTransactionByhash(hash)

获得指定hash的transaction详情

详情参考 [Ethereum JSON-RPC eth_getTransactionByHash 接口](https://github.com/ethereum/wiki/wiki/JSON-RPC#eth_gettransactionbyhash)

#### call({tx,tag})

模拟执行一条tx

详情参考 [Ethereum JSON-RPC eth_call 接口](https://github.com/ethereum/wiki/wiki/JSON-RPC#eth_call)

## Relay

实现Loopring Relay的JSON-RPC 接口和Socket 接口。Loopring Relay的接口详情见[Loopring Relay 接入文档](https://github.com/Loopring/relay/blob/wallet_v2/LOOPRING_RELAY_API_SPEC_V2.md)

### Relay

#### 构造方法

##### 参数

- host    Loopring Relay host

#### Account

实现Loopring Relay 的相关JSON-RPC接口。

#### getBalance({delegateAddress, owner})

获取指定owner的账户余额，以及对路印delegateAddress的授权值。

详情参考[Loopring Relay 接入文档](https://loopring.github.io/relay-cluster/relay_api_spec_v2#loopring_getbalance)

##### 代码样例

```javascript
const owner = "0x88699e7fee2da0462981a08a15a3b940304cc516";
const delegataAddress = "0x17233e07c67d086464fD408148c3ABB56245FA64";
const response = relay.account.getBalance({owner,delegataAddress});
```

#### register(owner)

向relay注册指定的owner地址。注册以后，relay会解析存储该地址的相关Ethereum txs。

详情参考[Loopring Relay 接入文档](https://loopring.github.io/relay-cluster/relay_api_spec_v2#loopring_unlockwallet)

#### notifyTransactionSubmitted({txHash, rawTx, from})

通知Relay 已经发送的以太坊tx。relay会跟踪tx的状态。

详情参考[Loopring Relay 接入文档](https://loopring.github.io/relay-cluster/relay_api_spec_v2#loopring_notifytransactionsubmitted)

#### getTransactions({owner, status, txHash, pageIndex, pageSize})

获取指定owner的以太坊txs

详情参考[Loopring Relay 接入文档](https://loopring.github.io/relay-cluster/relay_api_spec_v2#loopring_gettransactions)

#### getFrozenLrcFee(owner)

获得指定Owner的有效订单需要的LRC Fee的总和。

详情参考[Loopring Relay 接入文档](https://loopring.github.io/relay-cluster/relay_api_spec_v2#loopring_getgetfrozenlrcfee)

#### getPortfolio(owner)

获得指定owner 地址的portfolio

详情参考 [Loopring Relay 接入文档](https://loopring.github.io/relay-cluster/relay_api_spec_v2#loopring_getportfolio)

#### Market

实现Loopring Relay Market 相关的JSON-RPC 接口

#### getPriceQuote(currency)

获得Relay支持的所有token的指定Currency的价格

详情参考[Loopring Relay 接入文档](https://loopring.github.io/relay-cluster/relay_api_spec_v2#loopring_getpricequote)

#### getSupportedMarket()

获得Relay支持的所有市场

详情参考 [Loopring Relay 接入文档](https://loopring.github.io/relay-cluster/relay_api_spec_v2#loopring_getsupportedmarket)

#### getSupportedTokens()

获得Relay支持的所有token

详情参考 [Loopring Relay 接入文档](https://loopring.github.io/relay-cluster/relay_api_spec_v2#loopring_getsupportedtokens)

#### getDepth(filter)

获得市场的深度

 详情参考 [Loopring Relay 接入文档](https://loopring.github.io/relay-cluster/relay_api_spec_v2#loopring_getdepth)

#### getTicker()

获得Loopring 所有市场的24小时合并的成交统计

详情参考 [Loopring Relay 接入文档](https://loopring.github.io/relay-cluster/relay_api_spec_v2#loopring_getticker)

#### getTickers(market)

获得注定市场多个交易所24小时合并的成交统计

详情参考 [Loopring Relay的接入文档](https://loopring.github.io/relay-cluster/relay_api_spec_v2#loopring_gettickers)

#### getTrend({market, interval})

获得多个交易所指定市场在指定interval的价格变化等趋势信息

详情参考[Loopring Relay 的接入文档](https://loopring.github.io/relay-cluster/relay_api_spec_v2#loopring_gettrend)

#### Order

实现Loopring Relay

#### getOrders(filter)

获得路印的订单列表

详情参考[Loopring Relay 的接入文档](https://loopring.github.io/relay-cluster/relay_api_spec_v2#loopring_getorders)

#### getCutoff({address, delegateAddress, blockNumber})

获得注定address，在对应loopring 的delegateAddress 的cut off 时间戳。 cut off 对应时间之前的订单会被取消。

详情参考[ Loopring Relay的接入文档](https://loopring.github.io/relay-cluster/relay_api_spec_v2#loopring_getcutoff)

#### placeOrder(order)

提交订单到Loopring Relay

详情参考[Loopring Relay的接入文档](https://loopring.github.io/relay-cluster/relay_api_spec_v2#loopring_submitorder)

#### getOrderHash(order)

计算orderHash

#### Ring

实现Loopring Relay ring 相关的JSON-RPC接口

#### getRings(fiter)

获得已经撮合的环路

详情参考 [Loopring Relay 接入文档](https://loopring.github.io/relay-cluster/relay_api_spec_v2#loopring_getringmined)

#### getRingMinedDetail({ringIndex, protocolAddress})

获得ring的详细信息

详情参考 [Loopring Relay 接入文档](https://loopring.github.io/relay-cluster/relay_api_spec_v2#loopring_getRingMinedDetail)

#### getFills(filter)

获取订单撮合历史记录

详情参考 [Loopring Relay 接入文档](https://loopring.github.io/relay-cluster/relay_api_spec_v2#loopring_getfills)

### socket

Loopring Relay 使用socket.io 实现Web Socket。Loopring Relay 的socket 事件列表详情见[Loopring Relay接入文档](https://loopring.github.io/relay-cluster/relay_api_spec_v2)

#### 构造方法

连接指定url的socket 服务器，详情参考 [socket.io_client api 文档](https://github.com/socketio/socket.io-client/blob/master/docs/API.md#iourl-options)

##### 参数

- url            string
- options    object  (可选)

##### 代码样例

```javascript
const url = 'ws://relay.loopring'
const options= {transports: ['websocket']};
const socket = new Socket(url,options)
```

#### emit ( event, options)

向relay发送一条消息，开始监听指定的event或者更新指定事件的条件

##### 参数

- event string 
- options  string(json)  event 的参数

##### 代码样例

```javascript
cosnt event = 'portfolio_req';
const options = '{"owner" : "0x847983c3a34afa192cfee860698584c030f4c9db1"}';
socket.emit(event,options)
```

#### on(event,handle)

监听指定event 的数据返回

##### 参数

- event     string
- handle  function  处理返回的数据

##### 代码样例

```javascript
const event = "portfolio_res"
const handle = (data)=> {console.log(data)}
socket.on(event,handle);
```

#### close()

手动断开socket连接

##### 代码样例

```javascript
socket.close()
```

