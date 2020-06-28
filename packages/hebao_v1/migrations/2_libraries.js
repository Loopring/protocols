var AddressUtil = artifacts.require("AddressUtil");
var EIP712 = artifacts.require("EIP712");
var MathInt = artifacts.require("MathInt");
var MathUint = artifacts.require("MathUint");
var BytesUtil = artifacts.require("BytesUtil");
var Create2 = artifacts.require("Create2");
var strings = artifacts.require("strings");
var SignedRequest = artifacts.require("SignedRequest");
var SignatureUtil = artifacts.require("SignatureUtil");

module.exports = function(deployer) {
  deployer.then(() => {
    return Promise.all([
      deployer.deploy(AddressUtil),
      deployer.deploy(EIP712),
      deployer.deploy(MathInt),
      deployer.deploy(MathUint),
      deployer.deploy(BytesUtil),
      deployer.deploy(Create2),
      deployer.deploy(strings),
      deployer.deploy(SignedRequest),
      deployer.deploy(SignatureUtil)
    ]);
  });
};
