import fs = require("fs");
import { logDebug } from "./logs";
import { ProtocolSimulator } from "./protocol_simulator";
import { RingsInfo } from "./types";

async function main() {
  const args = process.argv.slice(2);
  console.log("args:", args );

  if (args.length < 2) {
    throw new Error("error: not enough params.");
  }
  const fileName = args[1];
  const fileContent = fs.readFileSync(fileName, "utf8");

  if (args[0] === "--decode-param") {
    try {
      const paramInfo: any = JSON.parse(fileContent);
      console.log(paramInfo);

      const protocolSimulator = new ProtocolSimulator(undefined);
      const ringsInfo = protocolSimulator.deserialize(paramInfo.bs, paramInfo.txOrigin);
      console.log("deserialized ringsInfo: ", ringsInfo);
    } catch (err) {
      console.log(err);
    }
  } else if (args[0] === "--encode-rings") {
    let ringsInfo: RingsInfo;
    ringsInfo = JSON.parse(fileContent);
    console.log("ringsInfo:", ringsInfo);
    throw new Error("Not implemented yet.");

    // const report = await protocolSimulator.simulateAndReport(ringsInfo);
  } else if (args[0] === "--decode-simulate") {
    try {
      const paramInfo: any = JSON.parse(fileContent);
      const protocolSimulator = new ProtocolSimulator(undefined);
      const ringsInfo = protocolSimulator.deserialize(paramInfo.bs, paramInfo.txOrigin);
      console.log("deserialized ringsInfo: ", ringsInfo);
    } catch (err) {
      console.log(err);
    }
  } else {
    throw new Error("error: invalid argument:" + args);
  }
}

main();
