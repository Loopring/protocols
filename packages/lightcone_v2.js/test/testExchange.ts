// Hack: Failed to import src files directly.
import { exchange } from "../src";

describe("eddsa sign test", function() {
  this.timeout(1000);

  before(async () => {
    exchange.init("");
  });

  it("create account", function(done) {
    done();
  });
});
