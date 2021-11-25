# CounterfactualNFT

## Build instructions

```
yarn install
yarn compile
```

## Test instructions

```
yarn run ganache-cli
yarn test
```

## Usage

Everybody on L2 automatically has his/her own NFT contract for free that can be used to mint NFTs. The address of this NFT contract is `NFTFactory.computeNftContractAddress(owner, baseURI)`. In the simplest case `baseURI == ""` so there is no data that needs to be shared publicly to be able to create the NFT contract by calling `NFTFactory.createNftContract(owner, baseURI)`. **Anybody** can call this function to create an NFT contract for an account. When this contract is created is not important, it just needs to be created when somebody wants to withdraw an NFT associated with this counterfactual NFT contract to L1 because it acts like a bridge between L1 and L2.

Should be simple to understand for users:
- The user puts his NFT on IPFS and gets an IPFS hash in return (per NFT!)
- The UI calculates the counterfactual NFT token contract address and shows it as the default option to mint NFTs to for his account
- The NFT is minted with the counterfactual NFT token contract as the token address and the IPFS hash as the NFT ID

The NFT is now fully functional on L2 and the only cost was the NFT mint price on L2.

If `baseURI != 0` it's a bit more complicated because that data is not publicly known by default before the NFT contract is created. So to be able to know how to show the NFT on L2 this data needs to be made public somehow (well, at least for them to work on a general block explorer, could be part of the offchain data field in a block, but this of course also costs some gas). But the option is there if minters don't want to use the IPFS hash as the NFT ID and still have the full flexibility to store whatever data they want in the NFT ID like they can in normal NFT contracts.

This is really just mainly for people that want to mint a couple of NFTs for as cheap as possible. Creators doing serious collections with thousands of NFTs will probably want to use their own contract anyway.