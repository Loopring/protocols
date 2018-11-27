const Accountant = artifacts.require("./AccountantImpl.sol")

module.exports = function(deployer, network, accounts) {
  //deployer.deploy(Accountant, ["0xB773CBB99C474CC47BE32971457EE662073E0C18", "0xF4F4A8E3409B022C35C7F78182611B78BA175B5A","0x791099EE2468139BDA81AA56C9313E71DF86DEE1","0x55A82E35D8D701BE1C4191C6F01784F9A98C841C"]);
  var accountants = [];
  accountants.push(accounts[0]);
  console.log(accounts[0]);
  console.log(accountants);
  deployer.deploy(Accountant, accountants);
};
