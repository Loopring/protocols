import fs = require("fs");
import { logDebug } from "./logs";
import { ProtocolSimulator } from "./protocol_simulator";
import { RingsInfo } from "./types";

function parseArgs(): [boolean, string] {
  const args = process.argv.slice(2);
  let isBinary = true;
  let ringData = "";
  if (args.length === 0) {
    throw new Error("error: no ringData found");
  }
  if (args[0] === "-f") {
    const fileName = args[1];
    const fileContent = fs.readFileSync(fileName, "utf8");
    try {
      const ringsInfo: RingsInfo = JSON.parse(fileContent);
      isBinary = false;
    } catch (err) {
      ringData = fileContent;
    }
  } else if (args[0] === "-b") {
    const binData = args[1];
    logDebug(binData);
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
    logDebug("receive binary data, deserializing...");
    ringsInfo = protocolSimulator.deserialize(data, "");
    logDebug("deserialize result:", ringsInfo);
  } else {
    ringsInfo = JSON.parse(data);
    logDebug("receive ringsInfo data:", ringsInfo);
  }

  logDebug("run simulator and report:");
  const report = await protocolSimulator.simulateAndReport(ringsInfo);
  logDebug(report);
}

main();
