const fs = require("fs");
const ethUtil = require("ethereumjs-util");

// Creation code on mainnet:
const creationCode =
    "608060405234801561001057600080fd5b506101f0806100206000396000f3fe60806040526004361061002d5760003560e01c80635c60da1b14610078578063d784d426146100a357610034565b3661003457005b600061003e6100c5565b90506001600160a01b03811661005357600080fd5b60405136600082376000803683855af43d806000843e818015610074578184f35b8184fd5b34801561008457600080fd5b5061008d6100c5565b60405161009a9190610179565b60405180910390f35b3480156100af57600080fd5b506100c36100be36600461014b565b6100ea565b005b7f49e52b53564741f5cdd331b330c04deb825a37506ec265623007d3f13f9371f85490565b60006100f46100c5565b90506001600160a01b038116156101265760405162461bcd60e51b815260040161011d9061018d565b60405180910390fd5b507f49e52b53564741f5cdd331b330c04deb825a37506ec265623007d3f13f9371f855565b60006020828403121561015c578081fd5b81356001600160a01b0381168114610172578182fd5b9392505050565b6001600160a01b0391909116815260200190565b602080825260139082015272494e495449414c495a45445f414c524541445960681b60408201526060019056fea26469706673582212204770b39f5f4b1e42b64dc20427208dec3f6fe833ecd5a61c77795c719e70b8c964736f6c63430007000033";

const codeHash = ethUtil.keccak(Buffer.from(creationCode, "hex"));
const zeroAddress = "0x" + "00".repeat(20);
const walletFactory = "0x339703fb41DF4049B02DFcE624Fa516fCfB31c46";
const batchSize = 1000000;
console.log("Using WalletFactory:", walletFactory);

function computeAddress(owner, salt) {
    if (owner.startsWith("0x")) {
        owner = owner.slice(2);
    }

    const saltHex = Number(salt).toString(16);
    const saltHex256 = "0".repeat(64 - saltHex.length) + saltHex;
    const saltBuf = Buffer.concat([
        Buffer.from("WALLET_CREATION", "utf8"),
        Buffer.from(owner, "hex"),
        Buffer.from(saltHex256, "hex")
    ]);

    const saltHash = ethUtil.keccak(saltBuf);

    const rawBuf = Buffer.concat([
        Buffer.from("ff", "hex"),
        Buffer.from(walletFactory.slice(2), "hex"),
        saltHash,
        codeHash
    ]);

    const addr = ethUtil
        .keccak(rawBuf)
        .slice(12)
        .toString("hex");
    return ethUtil.toChecksumAddress(addr);
}

function scoreString(str) {
    const len = str.length;
    if (len == 0 || len == 1) return 0;
    if (len == 2) return 1;

    let score = 0.0;

    let diff = str.charCodeAt(1) - str.charCodeAt(0);
    let segment = 1 - Math.abs(diff) / 25.0;

    for (let i = 2; i < len; i++) {
        let diff2 = str.charCodeAt(i) - str.charCodeAt(i - 1);
        if (diff2 == diff) {
            segment += 1 - Math.abs(diff) / 25.0;
        } else {
            score += segment * segment;
            diff = diff2;
            segment = 1 - Math.abs(diff) / 25.0;
        }
    }

    score += segment * segment;
    score /= (len - 1) * (len - 1);
    return score;
}

function calAddress(nextBatch, salt, headSize, tailSize) {
    const addr = computeAddress(zeroAddress, salt);
    const prefixScore = scoreString(addr.slice(2, 2 + headSize));
    const tailScore = scoreString(addr.slice(0 - tailSize));

    const score = (prefixScore * prefixScore + tailScore * tailScore) / 2.0;
    return {
        addr,
        nextBatch,
        salt,
        score,
        prefixScore,
        tailScore
    };
}

function findTopAddressesInBatch(nextBatch) {
    const prettyOnes = [];
    const uglyOnes = [];

    const base = nextBatch * batchSize;

    for (let i = 0; i < batchSize; i++) {
        const addr = calAddress(nextBatch, i + base, 8, 8);

        if (addr.score >= 0.2) {
            prettyOnes.push(addr);
        }
        if (addr.score <= 0.00025) {
            uglyOnes.push(addr);
        }
    }

    return [prettyOnes, uglyOnes];
}

function main() {

    if (!fs.existsSync(`wallet_addr`)) {
        fs.mkdirSync(`wallet_addr`);
    }

    let config = {
        nextBatch: 0,
        selectPerMillion: 10
    }

    let prettyOnes = [];
    let uglyOnes = [];

    if (fs.existsSync(`wallet_addr/result.json`)) {
        try {
            const result = JSON.parse(fs.readFileSync(`wallet_addr/result.json`));
            config = result.config || config;
            prettyOnes = result.pretty || [];
            uglyOnes = result.ugly || [];
        } catch (err) {}
    }

    while (true) {
        const startTime = new Date().getTime();
        console.log(">>> batch:", config.nextBatch, ", select per million:", config.selectPerMillion, ", pretty:", prettyOnes.length, ", ugly:", uglyOnes.length);


        let res = findTopAddressesInBatch(config.nextBatch);

        let select = config.selectPerMillion * (config.nextBatch + 1);
        prettyOnes = prettyOnes
            .concat(res[0])
            .sort((a, b) => b.score - a.score)
            .slice(0, select);

        uglyOnes = uglyOnes
            .concat(res[1])
            .sort((a, b) => a.score - b.score)
            .slice(0, select);

        config.nextBatch++;

        const endTime = new Date().getTime();

        let result = {
            config: config,
            timeUsedLastBatch: (endTime - startTime),
            prettyCount: prettyOnes.length,
            uglyCount: uglyOnes.length,
            pretty: prettyOnes,
            ugly: uglyOnes
        }

        fs.writeFileSync(`wallet_addr/result.json`, JSON.stringify(result, undefined, 2));
    }
}

main();
