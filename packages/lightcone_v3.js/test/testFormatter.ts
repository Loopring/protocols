import assert = require("assert");
import * as fm from "../src/lib/wallet/common/formatter";


describe("test account sign functions", function() {
  this.timeout(1000);

  it("zero padded", async function() {
    const num = 10, places = 20;
    let buf = fm.zeroPad(num, places);
    assert.strictEqual(buf.length, places);
  });
});
