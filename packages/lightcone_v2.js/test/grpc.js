const grpcClient = require("dist/src/grpc/grpcClient").grpcClient;

describe("eddsa sign message test", function () {
    this.timeout(100000);

    before(async () => {
    });

    it("Sign a single 10 bytes from 0 to 9", async () => {

        grpcClient.getNonce(0);

    });
});
