# Deployment info for Loopring V3.1.1

- release url: https://github.com/Loopring/protocols/releases/tag/Loopring_3.1.1
- deployer: 0x4374D3d032B3c96785094ec9f384f07077792768

## contract addresses

### Contracts shared with V3.0-beta4:

- LRCAddress: 0xBBbbCA6A901c926F240b89EacB641d8Aec7AEafD [lrctoken.eth](https://etherscan.io/address/lrctoken.eth)
- WETHAddress: 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
- ProtocolFeeVaultAddress: 0x4b89f8996892d137c3dE1312d1dD4E4F4fFcA171 [feevault.lrctoken.eth](https://etherscan.io/address/feevault.lrctoken.eth)
- BlockVerifier: 0x40598B41cc17a7E56dd72F415E8223aaCCA94cF7 [blockverifier.lrctoken.eth](https://etherscan.io/address/blockverifier.lrctoken.eth)
- DowntimeCostCalculator: 0x873685f032c6Aa1572766401f3198a1f09A5C221
- UniswapTokenSellerAddress: 0xdd5102f902b0892D1bbf2D2d0fCBE11ccEA1D537
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
- offchainWithdrawal: 1, 2, 4, 8, 16, 32, 64, 128, 256
- internalTransfer: 1, 2, 4, 8, 28, 58, 120, 243

## These tokens are supported by all exchanges:

- ETH: 0x0, tokenId: 0
- WETH: 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2, tokenId: 1
- LRC: 0xBBbbCA6A901c926F240b89EacB641d8Aec7AEafD, tokenId: 2
- protocol Fees: takerFeeBips: 60, makerFeeBips: 0 (/100000)

## WEDEX Exchange-2 Info:

- exchangeID: 1
- exchangeAddress: 0xD97D09f3bd931a14382ac60f156C1285a56Bb51B
- exchange stake: 500000 LRC
- operator: 0x056C0263E87c2edBF7083620832D25216b1cB05D

### Supported Tokens In WEDEX Exchange-2:

- USDT: 0xdac17f958d2ee523a2206206994597c13d831ec7, tokenId: 3

## Loopring Exchange-1 Info (from 2020-01-13):

- exchangeID: 2
- exchangeAddress: 0x944644Ea989Ec64c2Ab9eF341D383cEf586A5777
- exchange stake: 750000LRC
- owner: 0x4374D3d032B3c96785094ec9f384f07077792768
- operator: 0x4374D3d032B3c96785094ec9f384f07077792768

### Supported Tokens In Loopring Exchange-1:

- USDT: 0xdac17f958d2ee523a2206206994597c13d831ec7, tokenId: 3
- WBTC: 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599, tokenId: 4
- DAI: 0x6B175474E89094C44Da98b954EedeAC495271d0F, tokenId: 5
- USDC: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48, tokenId: 6
- MKR: 0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2, tokenId: 7
- KNC: 0xdd974D5C2e2928deA5F71b9825b8b646686BD200, tokenId: 8
- LINK: 0x514910771AF9Ca656af840dff83E8264EcF986CA, tokenId: 9
- BAT: 0x0D8775F648430679A709E98d2b0Cb6250d2887EF, tokenId: 10
- ZRX: 0xE41d2489571d322189246DaFA5ebDe1F4699F498, tokenId: 11
- HT: 0x6f259637dcD74C767781E37Bc6133cd6A68aa161, tokenId: 12
- OKB: 0x75231F58b43240C9718Dd58B4967c5114342a86c, tokenId: 13
- BNB: 0xB8c77482e45F1F44dE1745F52C74426C631bDD52, tokenId: 14
- KEEP: 0x85Eee30c52B0b379b046Fb0F85F4f3Dc3009aFEC, tokenId: 15
- DXD: 0xa1d65E8fB6e87b60FECCBc582F7f97804B725521, tokenId: 16
- TRB: 0x0Ba45A8b5d5575935B8158a88C631E9F9C95a2e5, tokenId: 17
- AUC: 0xc12d099be31567add4e4e4d0D45691C3F58f5663, tokenId: 18
- RPL: 0xB4EFd85c19999D84251304bDA99E90B92300Bd93, tokenId: 19
- renBTC: 0xEB4C2781e4ebA804CE9a9803C67d0893436bB27D, tokenId: 20
- PAX: 0x8e870d67f660d95d5be530380d0ec0bd388289e1, tokenId: 21
- TUSD: 0x0000000000085d4780B73119b644AE5ecd22b376, tokenId: 22
- BUSD: 0x4fabb145d64652a948d72533023f6e7a623c7c53, tokenId: 23
- SNX: 0xc011a72400e58ecd99ee497cf89e3775d4bd732f, tokenId: 24
- GNO: 0x6810e776880c02933d47db1b9fc05908e5386b96, tokenId: 25
- LEND: 0x80fB784B7eD66730e8b1DBd9820aFD29931aab03, tokenId: 26
- REN: 0x408e41876cccdc0f92210600ef50372656052a38, tokenId: 27
- REP: 0x1985365e9f78359a9B6AD760e32412f4a445E862, tokenId: 28
- BNT: 0x1F573D6Fb3F13d689FF844B4cE37794d79a7FF1C, tokenId: 29
- pBTC: 0x5228a22e72ccC52d415EcFd199F99D0665E7733b, tokenId: 30
- COMP: 0xc00e94Cb662C3520282E6f5717214004A7f26888, tokenId: 31
- PNT: 0x89ab32156e46f46d02ade3fecbe5fc4243b9aaed, tokenId: 32
- GRID: 0x12B19D3e2ccc14Da04FAe33e63652ce469b3F2FD, tokenId: 33
- PNK: 0x93ed3fbe21207ec2e8f2d3c3de6e058cb73bc04d, tokenId: 34
- NEST: 0x04abeda201850ac0124161f037efd70c74ddc74c, tokenId: 35
- BTU: 0xb683D83a532e2Cb7DFa5275eED3698436371cc9f, tokenId: 36
- BZRX: 0x56d811088235F11C8920698a204A5010a788f4b3, tokenId: 37
- vBZRX: 0xB72B31907C1C95F3650b64b2469e08EdACeE5e8F, tokenId: 38
- cDAI: 0x5d3a536e4d6dbd6114cc1ead35777bab948e3643, tokenId: 39
- cETH: 0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5, tokenId: 40
- cUSDC: 0x39aa39c021dfbae8fac545936693ac917d5e7563, tokenId: 41
- aLEND: 0x7D2D3688Df45Ce7C552E19c27e007673da9204B8, tokenId: 42
- aLINK: 0xA64BD6C70Cb9051F6A9ba1F163Fdc07E0DfB5F84, tokenId: 43
- aUSDC: 0x9bA00D6856a4eDF4665BcA2C2309936572473B7E, tokenId: 44
- OMG: 0xd26114cd6EE289AccF82350c8d8487fedB8A0C07, tokenId: 45
- ENJ: 0xf629cbd94d3791c9250152bd8dfbdf380e2a3b9c, tokenId: 46
- NMR: 0x1776e1F26f98b1A5dF9cD347953a26dd3Cb46671, tokenId: 47
- SNT: 0x744d70fdbe2ba4cf95131626614a1763df805b9e, tokenId: 48
