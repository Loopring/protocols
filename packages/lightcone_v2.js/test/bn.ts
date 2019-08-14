const BN = require("bn.js");

describe("test bn.js", function() {
  this.timeout(100000);
  before(async () => {});

  it("test BN constructor", async () => {
    let bn = new BN(20);
    console.log(bn.toString(16));
  });
});
