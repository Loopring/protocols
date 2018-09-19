var TradeDelegate = artifacts.require("./impl/TradeDelegate");
var BrokerRegistry = artifacts.require("./impl/BrokerRegistry");
var OrderRegistry = artifacts.require("./impl/OrderRegistry");
var RingSubmitter = artifacts.require("./impl/RingSubmitter");
var RingCanceller = artifacts.require("./impl/RingCanceller");
var FeeHolder = artifacts.require("./impl/FeeHolder");
var OrderBook = artifacts.require("./impl/OrderBook");
var TaxTable = artifacts.require("./impl/TaxTable");
var LRCToken = artifacts.require("./test/tokens/LRC.sol");
var WETHToken = artifacts.require("./test/tokens/WETH.sol");

module.exports = function(deployer, network, accounts) {

  if (network === "live") {
    // ignore.
  } else {
    deployer.then(() => {
      return Promise.all([
        TradeDelegate.deployed(),
        BrokerRegistry.deployed(),
        OrderRegistry.deployed(),
        FeeHolder.deployed(),
        OrderBook.deployed(),
        LRCToken.deployed(),
        WETHToken.deployed(),
      ]);
    }).then(() => {
      return Promise.all([
        LRCToken.address,
        WETHToken.address,
        BrokerRegistry.new(),
        BrokerRegistry.new(),
        deployer.deploy(TaxTable, LRCToken.address, WETHToken.address),
      ]);
    }).then(addresses => {
      var [lrcAddr, wethAddr, orderBrokerRegistry, minerBrokerRegistry, taxTableAddr] = addresses;
      return Promise.all([
        deployer.deploy(
          RingSubmitter,
          lrcAddr,
          wethAddr,
          TradeDelegate.address,
          orderBrokerRegistry.address,
          minerBrokerRegistry.address,
          OrderRegistry.address,
          FeeHolder.address,
          OrderBook.address,
          TaxTable.address,
        ),
        deployer.deploy(RingCanceller, TradeDelegate.address),
      ]);
    });
  }
};
