const eddsa = require("../lib/sign/eddsa");
const babyJub = require("../lib/sign/babyjub");

function toByteArray(x) {
    var hexString = x.toString(16);
    if(hexString.length % 2 > 0) hexString = "0" + hexString;
    var byteArray = [];
    for(var i = 0; i < hexString.length; i += 2) {
        byteArray.push(parseInt(hexString.slice(i, i + 2), 16));
    }
    return byteArray;
}

describe("generate key_pair test", function () {
    this.timeout(100000);
    before( async () => {
    });

    it("Sign a single 10 bytes from 0 to 9", async () => {
        console.log(eddsa.generateKeyPair());
    });
});

describe("eddsa sign message test", function () {
    this.timeout(100000);

    before(async () => {
    });

    it("Sign a single 10 bytes from 0 to 9", async () => {

        console.log(eddsa.generateKeyPair());

        var bits

//         const msg = Buffer.from("abc123", "hex");
//
// //        const prvKey = crypto.randomBytes(32);
//
//         // const prvKey = Buffer.from("0001020304050607080900010203040506070809000102030405060708090001", "hex");
//         const prvKey = Buffer.from(toByteArray(1809176706725293124560617712135368090745583862266386407971859398358975651064));
//         const pubKey = eddsa.prv2pub(prvKey);
//
//         const pPubKey = babyJub.packPoint(pubKey);
//
//         const signature = eddsa.sign("1809176706725293124560617712135368090745583862266386407971859398358975651064", msg);
//
//         const pSignature = eddsa.packSignature(signature);
//         const uSignature = eddsa.unpackSignature(pSignature);
//
//         assert(eddsa.verify(msg, uSignature, pubKey));
//
//         const msgBits = buffer2bits(msg);
//         const r8Bits = buffer2bits(pSignature.slice(0, 32));
//         const sBits = buffer2bits(pSignature.slice(32, 64));
//         const aBits = buffer2bits(pPubKey);

    });
});


