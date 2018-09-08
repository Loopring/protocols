var TradeDelegate = artifacts.require("./impl/TradeDelegate");
var TokenRegistry = artifacts.require("./impl/TokenRegistry");
var SymbolRegistry = artifacts.require("./impl/SymbolRegistry");
var BrokerRegistry = artifacts.require("./impl/BrokerRegistry");
var OrderRegistry = artifacts.require("./impl/OrderRegistry");
var MinerRegistry = artifacts.require("./impl/MinerRegistry");
var RingSubmitter = artifacts.require("./impl/RingSubmitter");
var RingCanceller = artifacts.require("./impl/RingCanceller");
var FeeHolder = artifacts.require("./impl/FeeHolder");
var OrderBook = artifacts.require("./impl/OrderBook");
var TaxTable = artifacts.require("./impl/TaxTable");

module.exports = function(deployer, network, accounts) {

  if (network === "live") {
    // ignore.
  } else {
    deployer.then(() => {
      return Promise.all([
        SymbolRegistry.deployed(),
        TokenRegistry.deployed(),
        TradeDelegate.deployed(),
        BrokerRegistry.deployed(),
        OrderRegistry.deployed(),
        MinerRegistry.deployed(),
        FeeHolder.deployed(),
        OrderBook.deployed(),
      ]);
    }).then((contracts) => {
      var [symbolRegistry] = contracts;
      return Promise.all([
        symbolRegistry.getAddressBySymbol("LRC"),
        symbolRegistry.getAddressBySymbol("WETH"),
      ]);
    }).then((addresses) => {
      var [lrcAddr, wethAddr] = addresses;
      return Promise.all([
        lrcAddr,
        wethAddr,
        BrokerRegistry.new(),
        BrokerRegistry.new(),
        deployer.deploy(TaxTable, lrcAddr, wethAddr),
      ]);
    }).then(addresses => {
      var [lrcAddr, wethAddr, orderBrokerRegistry, minerBrokerRegistry, taxTableAddr] = addresses;
      return Promise.all([
        deployer.deploy(
          RingSubmitter,
          lrcAddr,
          wethAddr,
          TokenRegistry.address,
          TradeDelegate.address,
          orderBrokerRegistry.address,
          minerBrokerRegistry.address,
          OrderRegistry.address,
          MinerRegistry.address,
          FeeHolder.address,
          OrderBook.address,
          TaxTable.address,
        ),
        deployer.deploy(RingCanceller, TradeDelegate.address),
      ]);
    });
  }
};
