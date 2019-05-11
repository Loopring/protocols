# Loopring Hackathon Challenges

## Challange #1: Build Oedax UI

### Description

Create a web UI to display open and ended auctions, integrate with MetaMask and allow users to participate in open auctions. The UI does not need to allow people to create new auctions.


### About Oedax Protocol

Please read the [Oedax blog post](https://medium.com/loopring-protocol/oedax-looprings-open-ended-dutch-auction-exchange-model-d92cebbd3667) regarding its design.

We've also created this little [tool](https://loopring.github.io/protocols/curve.html) to show you how the Oedax curves look like in our current implementation.

### More Detailed Requirements

- There should be at least two sub-pages (tabs), one for closed auctions and one for open auctions.

- The following information should be displayed for each auction:
    - Trading pair
    - Current price range
    - Current actual price
    - Current amount of bids and asks
    - The time elapsed and remaining

- The following information should be displayed for each closed auction:
    - Whether the auction has been settled (meaning tokens have been distributed/returned)
    - For unsettled auctions, an "settle" button should be displayed (enabled or disabled). To calculate whether the button should be enabled, please read the code for function `settle` in `AuctionSettlement.sol`. Note that the `settle` function can be called multiple times.

- There can be an auction detail page to display even more information, for example, a chart to display the interaction of the price bounding curves and the actual price lines, like [this one](https://cdn-images-1.medium.com/max/1760/1*LBC-d01vn71WharDbGGDlg.jpeg).


### Auction Interface
The Oedax Auction's interface is defined in this [IAuction](https://github.com/Loopring/protocols/blob/master/packages/oedax_v1/contracts/iface/IAuction.sol) solidity file.

The ABI files can be found in our github repository - link (TODO)

There are two ways you can query the state of an auction:

1. Using its public data `IAuctionData.State  state;`
2. Using its public function `getStatus`

The data returned from these two methods are complementary.

### Testnet Deployment Addresses

- Testnet Name: TODO
- IOedax contract address: TODO
- ICurve contract address: TODO
- Token Foo address: TODO
- Token Bar address: TODO

