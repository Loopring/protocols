var AddressUtil = artifacts.require("AddressUtil");
var EIP712 = artifacts.require("EIP712");
var MathInt = artifacts.require("MathInt");
var MathUint = artifacts.require("MathUint");
var BytesUtil = artifacts.require("BytesUtil");
var Create2 = artifacts.require("Create2");
var strings = artifacts.require("strings");
var SignedRequest = artifacts.require("SignedRequest");
var SignatureUtil = artifacts.require("SignatureUtil");

const WalletImpl = artifacts.require("WalletImpl");

module.exports = function(deployer, network, accounts) {
  deployer
    .then(() => {
      let dest = [WalletImpl];
      return Promise.all([
        deployer.link(AddressUtil, dest),
        deployer.link(EIP712, dest),
        deployer.link(MathInt, dest),
        deployer.link(MathUint, dest),
        deployer.link(BytesUtil, dest),
        deployer.link(Create2, dest),
        deployer.link(strings, dest),
        deployer.link(SignedRequest, dest),
        deployer.link(Create2, dest),
        deployer.link(SignatureUtil, dest)
      ]);
    })
    .then(() => {
      return Promise.all([deployer.deploy(WalletImpl)]);
    });
};
