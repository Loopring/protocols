// Hack (ruby): Failed to import src files directly.

import { grpcClientService } from "../src/grpc/grpcClientService";

describe("eddsa sign message test", function () {
    this.timeout(100000);

    before(async () => {
    });

    it("Sign a single 10 bytes from 0 to 9", async () => {

        grpcClientService.getNonce(0);
    });
});
