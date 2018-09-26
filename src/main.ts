import fs = require("fs");
import { RingsInfo } from "./types";
import { ProtocolSimulator } from "./protocol_simulator";

function parseArgs(): [boolean, string] {
  const args = process.argv.slice(2);
  let isBinary = true;
  let ringData = "";
  if (args.length == 0) {
    throw new Error("error: no ringData found");
  }
  if (args[0] === "-f") {
    const fileName = args[1];
    const fileContent = fs.readFileSync(fileName, 'utf8');
    try {
      const ringsInfo: RingsInfo = JSON.parse(fileContent);
      isBinary = false;
    } catch (err) {
      ringData = fileContent;
    }
  } else if (args[0] === "-b") {
    const binData = args[1];
    console.log(binData);
  } else {
    if (args[0].startsWith("-")) {
      throw new Error("error: invalid argument:" + args[0]);
    } else {
      ringData = args[0];
    }
  }

  return [isBinary, ringData];
}


async function main() {
  const [isBinData, data] = parseArgs();
  let ringsInfo: RingsInfo;

  const protocolSimulator = new ProtocolSimulator(undefined);
  if (isBinData) {
    console.log("receive binary data, deserializing...");
    ringsInfo = protocolSimulator.deserialize(data, "");
    console.log("deserialize result:", ringsInfo);
  } else {
    ringsInfo = JSON.parse(data);
    console.log("receive ringsInfo data:", ringsInfo);
  }

  console.log("run simulator and report:");
  const report = await protocolSimulator.simulateAndReport(ringsInfo);
  console.log(report);
}

main();
