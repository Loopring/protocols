
## About
This developer documentation introduces the use of loopring.js to access Loopring’s Protocol. loopring.js can be used to develop ethereum wallet and dex by intergrating loopring protocol.

## Documents in Other Languages

- [Chinese (中文文档)](chinese.md)


## Installation

```javascript
 npm install loopring.js --save
```

## Browser Usage

loopring.js ships as both a [UMD](https://github.com/umdjs/umd) module and a [CommonJS](https://en.wikipedia.org/wiki/CommonJS) package.

- ##### UMD Package


Include the following script tag in your HTML:

```javascript
<script src="../node_modules/loopring/dist/loopring.min.js"></script>
```

 Get each component like so:

```javascript
window.loopring.WalletUtils
window.loopring.ContractUtils
window.loopring.RelayRpcUitls
window.loopring.EthRpcUtils
window.loopring.SocketUtils
```

- ##### CommonJS  Package   

  using commonjs version loopring.js, babel-polyfill is required，

```javascript
import loopring from 'loopring.js';
or
import {WalletUtils} from 'loopring.js';
or
const loopring = require('loopring.js');
```

## API

note: The following code examples take the CommonJS approach

### WalletUtils

#### createMnemonic()

Generate a set of English word mnemonics, the number of words is determined by strength, 256 will get 24 words and 128 will get 12 words.

##### Parameters

- strength number  default is 256

##### Returns

- mnemonic  string

```javascript
import {WalletUtils} from 'loopring.js'

const mnemonic = WalletUtils.createMnemonic();
// mnemonic: "seven museum glove patrol gain dumb dawn bridge task alone lion check interest hair scare cash sentence diary better kingdom remember nerve sunset move"
```

#### isValidateMnemonic(mnemonic)

Check the validity of mnemonic

##### Parameters

- menmonic  string

##### Returns

- isValid  bool   

##### Example

```javascript
import {WalletUtils} from 'loopring.js'

const menmonic = "seven museum glove patrol gain dumb dawn bridge task alone lion check interest hair scare cash sentence diary better kingdom remember nerve sunset move";
const isValid = WalletUtils.isValidateMnemonic(mnemonic);
//isValid true
```

#### privateKeytoAddress(privatekey)

Get the address using the private key

##### Parameters

- privatekey  hex string or  Buffer

##### Returns

- address

##### Example

```js
import {WalletUtils} from 'loopring.js'
const pKey = "07ae9ee56203d29171ce3de536d7742e0af4df5b7f62d298a0445d11e466bf9e";
WalletUtils.privateKeytoAddress(pkey); //address:0x48ff2269e58a373120FFdBBdEE3FBceA854AC30A
```

#### publicKeytoAddress（publicKey，sanitize）

Get the address using the public key

##### Parameters

- publicKey	hex string  or Buffer
- sanitize           bool  default is false

##### Returns

- address

##### Example 

```javascript
import {WalletUtils} from 'loopring.js'
const publicKey = "0895b915149d15148ac4171f453060d6b53a9ebb694689351df8e3a49c109c7a65374b5c196ce8cc35ff79cb3ce54ea1695704dd5b3cfc6864bd110b62cfd509";
WalletUtils.publicKeytoAddress(publicKey)
//address:0x48ff2269e58a373120FFdBBdEE3FBceA854AC30A
```

#### privateKeytoPublic(privatekey)

Get the public key using the private key

##### Parameters

- privateKey hex string Buffer

##### Returns

- publickey hex string without prefix

##### Example

```javascript
import {WalletUtils} from 'loopring.js'

const privateKey = '07ae9ee56203d29171ce3de536d7742e0af4df5b7f62d298a0445d11e466bf9e';
const publicKey = WalletUtils.privateKeytoPublic(privateKey);
//publicKey:"0895b915149d15148ac4171f453060d6b53a9ebb694689351df8e3a49c109c7a65374b5c196ce8cc35ff79cb3ce54ea1695704dd5b3cfc6864bd110b62cfd509"
```

#### decryptKeystoreToPkey(keystore, password)

Decrypt mnemonics to get private key

##### Parameters

- keystore    string
- password  string

##### Returns

- privatekey  Buffer

##### Example

```javascript
import {WalletUtils} from 'loopring.js'

const keystore = "{"version":3,"id":"e603b01d-9aa9-4ddf-a165-1b21630237a5","address":"2131b0816b3ef8fe2d120e32b20d15c866e6b4c1","Crypto":{"ciphertext":"7e0c30a985cf29493486acaf86259a2cb0eb45befb367ab59a0baa7738adf49e","cipherparams":{"iv":"54bbb6e77719a13c3fc2072bb88a708c"},"cipher":"aes-128-ctr","kdf":"scrypt","kdfparams":{"dklen":32,"salt":"50c31e2a99f231b09201494cac1cf0943246edcc6864a91cc931563cd11eb0ce","n":1024,"r":8,"p":1},"mac":"13d3566174d20d93d2fb447167c21a127190d4b9b4843fe7cbebeb6054639a4f"}}";
const password = "1111111";
const privatekey =  WalletUtils.decryptKeystoreToPkey(keystore,password);
```

#### pkeyToKeystore(privateKey, password)

Decrypt the private key using the keystore and password

##### Parameters

- privateKey     Buffer
- password       string

##### Returns

- keystore    Object   

##### Example

```javascript
import {WalletUtils} from 'loopring.js'

const privateKey = toBuffer('0x07ae9ee56203d29171ce3de536d7742e0af4df5b7f62d298a0445d11e466bf9e')；
const password = "1111111";
const keystore = WalletUtils.pkeyToKeystore(privateKey,password);
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

#### mnemonictoPrivatekey(mnemonic, dpath, password)

Decrypt mnemonics to get private key

##### Parameters

- mnemonic    string
- dpath            string
- password     string (optional)

##### Returns

- privateKey Buffer

##### Example

```javascript
import {WalletUtils} from 'loopring.js'

const mnemonic = "seven museum glove patrol gain dumb dawn bridge task alone lion check interest hair scare cash sentence diary better kingdom remember nerve sunset move"；
const dpath = "m/44'/60'/0'/0/0";
const privateKey = WalletUtils.mnemonictoPrivatekey(mnemonic,dpath);
```

#### fromMnemonic(mnemonic, dpath, password)

##### Parameters

- mnemonic   string 
- dpath       string
- password  string   (optional)

##### Returns

- account   KeyAccount

```javascript
import {WalletUtils} from 'loopring.js'

const mnemonic = "seven museum glove patrol gain dumb dawn bridge task alone lion check interest hair scare cash sentence diary better kingdom remember nerve sunset move";
const dpath = "m/44'/60'/0'/0/0";
const password = "1111111";
const account =  WalletUtils.fromMnemonic(mnemonic,dpath,password);
```

#### fromKeystore(keystone,password)

##### Parameters

- keystore  string
- password string can be empty, depending on whether the keystore requires a password to unlock it.

##### Returns

- account  KeyAccount

##### Example

```javascript
import {WalletUtils} from 'loopring.js'

const keystore = "{"version":3,"id":"e603b01d-9aa9-4ddf-a165-1b21630237a5","address":"2131b0816b3ef8fe2d120e32b20d15c866e6b4c1","Crypto":{"ciphertext":"7e0c30a985cf29493486acaf86259a2cb0eb45befb367ab59a0baa7738adf49e","cipherparams":{"iv":"54bbb6e77719a13c3fc2072bb88a708c"},"cipher":"aes-128-ctr","kdf":"scrypt","kdfparams":{"dklen":32,"salt":"50c31e2a99f231b09201494cac1cf0943246edcc6864a91cc931563cd11eb0ce","n":1024,"r":8,"p":1},"mac":"13d3566174d20d93d2fb447167c21a127190d4b9b4843fe7cbebeb6054639a4f"}}";
const password = "1111111";
const account =  WalletUtils.fromKeystore(keystore,password);
```

#### fromPrivateKey(privateKey)

##### Parameters

- privateKey   hex string  Buffer

##### Returns

- account KeyAccount

##### Example

```javascript
import {WalletUtils} from 'loopring.js'

const privateKey = "07ae9ee56203d29171ce3de536d7742e0af4df5b7f62d298a0445d11e466bf9e";
const account = WalletUtils.fromPrivateKey(privateKey);
```

#### fromLedger(dpath)

##### Parameters

- dpath  string

##### Returns

LedgerAccount 

##### Example

```javascript
import {WalletUtils} from 'loopring.js'

const dpath = "m/44'/60'/0'/0"
try{
const account = await WalletUtils.fromLedger(dpath)    
}catch(e){
    console.log(e.message)
}
```

##### fromTrezor

##### Parameters

- dpath  string

##### Returns

TrezorAccount

##### Example

```javascript
import {WalletUtils} from 'loopring.js'

const dpath = "m/44'/60'/0'/0/0"
const account = await WalletUtils.fromTrezor(dpath)    
```

##### fromMetaMask

##### Parameters

- web3   object web3 that metamask wallet registers under the browser window

##### Returns

MetaMaskAccount

##### Example

```javascript
import {WalletUtils} from 'loopring.js'

const dpath = "m/44'/60'/0'/0/0"
const account = await WalletUtils.fromMetaMask(web3)    
```

### ContractUtils

Contains of ERC20Token，WETH，AirdropContract，LoopringProtocol ，supports the encode and decode operations of ABI for corresponding contracts.

#### encodeInputs(method, inputs)

encode the inputs of giving method。

##### Parameters

- method  string, if there is no method with the same methodName in the abi, it can be called methodName. Otherwise, the argument will pass on this type of methodName + methodId.

##### Returns

- data  hex string

##### Example

```javascript
import {ContractUtils} from 'loopring.js'

const method='transfer' //(transfer(address,uint256) or '0xa9059cbb')
 const _to = "0x88699e7fee2da0462981a08a15a3b940304cc516";
 const _value = "0xde0b6b3a7640000";
 const data = ContractUtils.ERC20Token.encodeInputs(method,{_to,_value})
 //data:"0xa9059cbb000000000000000000000000d91a7cb8efc59f485e999f02019bf2947b15ee1d0000000000000000000000000000000000000000000008ac7230489e80000"
```

#### decodeEncodeInputs(data)

Decode the encoded input parameter data of the specified method.

##### Parameters

- data  hex string   （methodId+ parameters）

##### Returns

- inputs  Array  

##### Example

```javascript
import {ContractUtils} from 'loopring.js'

const data = "0xa9059cbb000000000000000000000000d91a7cb8efc59f485e999f02019bf2947b15ee1d0000000000000000000000000000000000000000000008ac7230489e80000"；
const inputs = ContractUtils.ERC20Token.decodeEncodeInputs(data);
//inputs:['88699e7fee2da0462981a08a15a3b940304cc516','0xde0b6b3a7640000']
```

#### decodeOutputs(method, data)

decode the outputs of giving method。

##### Parameters

- method  string, if there is no method with the same methodName in the abi, it can be called methodName. Otherwise, the argument will pass on this type of methodName + methodId.

##### Returns

- outputs   Array  

##### Example

```javascript
import {ContractUtils} from 'loopring.js'

const method = 'balanceOf'
const data = '0x000000000000000000000000000000000000000000e6cbc4f6ec6156401801fc';
const outputs = ContractUtils.ERC20Token.decodeOutputs(method, data);
//outputs:['0xe6cbc4f6ec6156401801fc']
```

LoopringProtocol adds the encodECancelOrder and the encodeSubmitRing

#### encodeCancelOrder(signedOrder, amount)

There is a specified number of orders that can be assigned at once. If the amount exceeds the order availability, the order is marked as complete cancellation.

- ##### Parameters

  - signedOrder
    - protocol  address, here is an example version 1.5.1 protocol address: 0x8d8812b72d1e4ffCeC158D25f56748b7d67c1e78
    - delegate  address, the Loopring protocol authorization address, here is an example version 1.5.1 address: 0x17233e07c67d086464fD408148c3ABB56245FA64
    - owner  address, the address of the ordering user
    - tokenS  address, the contract address that is selling currency 
    - tokenB  address, the contract address that is buying currency 
    - authAddr  address, randomly generated account address
    - authPriavteKey  privatekey, randomly generated privatekey corresponding to the account
    - validSince  hex string, the order effective time, timestamp in seconds
    - validUntil  hex string, the order expiration time, timestamp in seconds
    - amountB  hex string, the amount of tokenB to buy (here in units of the smallest unit)
    - amountS  hex string, the amount of tokenS to sell (here in units of the smallest unit)
    - walletAddress  address, address of the wallet that receives the tokens from an order
    - buyNoMoreThanAmountB  bool, true if amountB is greater than tokenB
    - lrcFee  hex string, orders fully match the maximum amount of fees that need to be paid. (Here the unit of LRC is the smallest unit)
    - marginSplitPercentage  number(0–100), the proportion of funds used to pay for the reconciliation
    - r  hex string
    - s  hex string
    - v  number
    - powNonce  number, a random number that satisfies the degree of difficulty
  - amount  number, the quantity to be cancelled is defaulted to the full quantity of the order

  ##### Returns

  - data  hex string

##### Example

```javascript
import {ContractUtils} from 'loopring.js'
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
const data = ContractUtils.LoopringProtocol.encodeCancelOrder(signedOrder);
//data : 
"0x8c59f7ca000000000000000000000000b94065482ad64d4c2b9252358d746b39e820a582000000000000000000000000ef68e7c694f40c8202821edf525de3782458639f000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2000000000000000000000000b94065482ad64d4c2b9252358d746b39e820a5820000000000000000000000005b98dac691be2f2882bfb79067ee50c221d2020300000000000000000000000000000000000000000000000ad78ebc5ac62000000000000000000000000000000000000000000000000000000429d069189e0000000000000000000000000000000000000000000000000000000000005b038122000000000000000000000000000000000000000000000000000000005b04d2a20000000000000000000000000000000000000000000000000928ca80cfc2000000000000000000000000000000000000000000000000000ad78ebc5ac620000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000032000000000000000000000000000000000000000000000000000000000000001cbdf3c5bdeeadbddc0995d7fb51471e2166774c8ad5ed9cc315635985c190e5734ab135ff654c3f5e87183865175b6180e342565525eefc56bf2a0d5d5c564a73"
```

#### encodeSubmitRing(orders,feeRecipient, feeSelections)

##### Parameters

- orders                  order[]
- feeRecipient       address
- feeSelections     number[]   (0 means select margin-split, 1 means select lrcFee, the default is 1)

##### Returns

- data                     hex string

### EthRpcUtils

implements Ethereum jsonrpc interfaces

#### construction method

##### Parameters

- host  string

##### Example

```javascript
import {EthRpcUtils} from 'loopring.js'

const host = 'localhost:8545';
const ethRpcUtils = new EthRpcUtils(host);
```

#### getTransactionCount({address,tag})

Get the transactionCount at the specified address

For details, reference: [Ethereum Jsonrpc eth_getTransactionCount interface](https://github.com/ethereum/wiki/wiki/JSON-RPC#eth_gettransactioncount)

##### Example

```javascript
const address= "0xb94065482ad64d4c2b9252358d746b39e820a582";
const tag = "latest"
ethRpcUtils.getTransactionCount({address,tag})
```

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

For details, reference: [Ethereum JSON-RPC eth_call interface](

### RelayRpcUtils

#### construction method

##### Parameters

- host    Loopring Relay host

##### Example

```javascript
import {RelayRpcUtils} from 'loopring.js'

const host = "localhost:8080"
const relayRpcUtils = new RelayRpcUtils(host)
```

RelayRpcUtils contains four partial objects, namely, account, market, ring and order, which respectively implement the corresponding interfaces of relay RPC. The following is the specific interface.

#### Account interfaces

------

##### getBalance({delegateAddress, owner})

Get the account balance of the specified owner and the authorized value of the Loopring address delegateAddress.

For details, reference: [Loopring Relay getBalance interface](https://loopring.github.io/relay-cluster/relay_api_spec_v2#loopring_getbalance)

##### Example

```javascript
 const owner = "0x88699e7fee2da0462981a08a15a3b940304cc516";
 const delegataAddress = "0x17233e07c67d086464fD408148c3ABB56245FA64";
 const response = relayRpcUtils.account.getBalance({owner,delegataAddress});
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

#### Market interfaces

------

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

#### Order Interfaces

------

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

#### Ring interfaces

------

#### getRings(fiter)

Get a ring that has been matched

For details, reference: [Loopring Relay getRings interface](https://loopring.github.io/relay-cluster/relay_api_spec_v2#loopring_getringmined)

#### getRingMinedDetail({ringIndex, protocolAddress})

Get ring details

For details, reference: [Loopring Relay getRingMinedDetail interface](https://loopring.github.io/relay-cluster/relay_api_spec_v2#loopring_getRingMinedDetail)

#### getFills(filter)

Get order match history

For details, reference: [Loopring Relay getFills interface ](https://loopring.github.io/relay-cluster/relay_api_spec_v2#loopring_getfills)

### SocketUtils

The Loopring Relay implements Web Sockets using socket.io. See the Loopring Relay socket event list for details: [Loopring Relay socket interface](https://loopring.github.io/relay-cluster/relay_api_spec_v2)

#### Creation Method

Connect to the socket server for the specified url. For details, reference: [socket.io_client api documents](https://github.com/socketio/socket.io-client/blob/master/docs/API.md#iourl-options)

##### Parameters

- url string
- options object (Optional)

##### **Example**

```javascript
import {SocketUtils} from 'loopring.js'

const url = 'ws://relay.loopring'
const options= {transports: ['websocket']};
const socketUtils = new SocketUtils(url,options)
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
socketUtils.emit(event,options)
```

#### on(event,handle)

Focus on the data of the specified event

##### Parameters

- event string
- handle function, processing data returned

##### Example

```javascript
const event = "portfolio_res"
const handle = (data)=> {console.log(data)}
socketUtils.on(event,handle);
```

#### close()

Manually disconnect the socket connection

##### Example

```javascript
socketUtils.close()
```