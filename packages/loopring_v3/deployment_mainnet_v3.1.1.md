# Deployment info for Loopring V3.1.1

- release url: https://github.com/Loopring/protocols/releases/tag/Loopring_3.1.1
- deployer: 0x4374D3d032B3c96785094ec9f384f07077792768

## contract addresses

### Contracts shared with V3.0-beta4:

- LRCAddress: 0xBBbbCA6A901c926F240b89EacB641d8Aec7AEafD [lrctoken.eth](https://etherscan.io/address/lrctoken.eth)
- WETHAddress: 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
- ProtocolFeeVaultAddress: 0x5BB8EF8efD18C6034EC9277DaCA9a5E29B1f1Cb1 [feevault.lrctoken.eth](https://etherscan.io/address/feevault.lrctoken.eth)
- BlockVerifier: 0x40598B41cc17a7E56dd72F415E8223aaCCA94cF7 [blockverifier.lrctoken.eth](https://etherscan.io/address/blockverifier.lrctoken.eth)
- DowntimeCostCalculator: 0x873685f032c6Aa1572766401f3198a1f09A5C221
- UniswapTokenSellerAddress: 0xaf92B83231a78978A236CA9D682CEBbAe97E62cB
- UserStakingPoolAddress: 0xF4662bB1C4831fD411a95b8050B3A5998d8A4A5b [stakingpool.lrctoken.eth](https://etherscan.io/address/stakingpool.lrctoken.eth)

### New deployed:

- UniversalRegistry: 0x36F568EF555df25be4B6e15D16994F3A8374214E
- LoopringV3: 0x18dd1dda037B009F7C1024dDdD58e4Fe9F960ac7
- ExchangeV3: 0x730Ea81C982939931d7514CC3Fbc22eAf7D372ec

### price-providers

- ChainlinkTokenPriceProvider: 0x3B740FeE3ED82FA676286938E124A8Bb74553f93
- MovingAveragePriceProvider: 0x388110217e4d194d501BB52c3AB28dC709EB450d

### owners

- BlockVerifierOwner: 0xb3941215651f37B681526eA359642174F8e71b3F
- ImplementationManagerOwner: 0xAAB867f1648AC89d7339C595a22378ED9D3D3F8a
- LoopringV3Owner: 0xFc4aE885815c5b469ce6AC17F945a6dA38992F17

## vks with following blockSize are registered in blockverifier contract:

- trade: 1, 2, 4, 8, 14, 31, 63, 128, 256, 512, 1024
- deposit: 1, 2, 4, 8, 15, 31, 64, 128, 256
- onchainWithdrawal: 1, 2, 4, 8, 16, 32, 64, 128, 256

## These tokens are supported by all exchanges:

- ETH: 0x0, tokenId: 0
- WETH: 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2, tokenId: 1
- LRC: 0xBBbbCA6A901c926F240b89EacB641d8Aec7AEafD, tokenId: 2

## WEDEX Exchange-2 Info:

- exchangeID: 1
- exchangeAddress: 0xD97D09f3bd931a14382ac60f156C1285a56Bb51B
- exchange stake: 500000 LRC
- protocol Fees: takerFeeBips: 40, makerFeeBips: 20
- operator: 0x056C0263E87c2edBF7083620832D25216b1cB05D

### Supported Tokens In WEDEX Exchange-2:

- USDT: 0xdac17f958d2ee523a2206206994597c13d831ec7, tokenId: 3

## Loopring Exchange Info (from 2020-01-13):

- exchangeID: 2
- exchangeAddress: 0x944644Ea989Ec64c2Ab9eF341D383cEf586A5777
- exchange stake: 750000LRC
- protocol Fees: takerFeeBips: 40, makerFeeBips: 20
- owner: 0x4374D3d032B3c96785094ec9f384f07077792768
- operator: 0x4374D3d032B3c96785094ec9f384f07077792768
