import fs = require("fs");
import { ExchangeDeserializer } from "./exchange_deserializer";
import { OrderInfo, RingsInfo } from "./types";
import { Mining } from "./mining";

function parseArgs(): [boolean, string] {
  const args = process.argv.slice(2);
  let isBinary = true;
  let ringData = "";
  if (args.length == 0) {
    console.log("error: no ringData found");
    process.exit(1);
  }
  if (args[0] === "-f") {
    const fileName = args[1];
    const fileContent = fs.readFileSync(fileName, 'utf8');
    console.log(fileContent);
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
      console.log("error: invalid argument:", args[0]);
      process.exit(1);
    } else {
      ringData = args[0];
    }
  }

  return [isBinary, ringData];
}


function main() {
  const [isBinData, data] = parseArgs();
  // console.log(isBinData);
  // console.log(data);

  let ringsInfo: RingsInfo;

  const deserializer: ExchangeDeserializer = new ExchangeDeserializer(undefined);
  if (isBinData) {
    const [mining, orders, rings] = deserializer.deserialize(data);
    console.log(mining, orders, rings);
  } else {
    ringsInfo = JSON.parse(data);
  }
  console.log(ringsInfo);
}

main();
