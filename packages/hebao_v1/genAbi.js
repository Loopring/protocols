const path = require("path");
const fs = require("fs");
const contractBuildPath = "./build/contracts";
const abiDir = "./ABI";

fs.readdir(contractBuildPath, function (err, files) {
    if (err) {
        return console.log(`Unable to scan directory: $directoryPath, error: $err`);
    }

    files.forEach(function (file) {
      const contract = JSON.parse(fs.readFileSync(contractBuildPath + "/" + file), "utf8");
      const abiStr = JSON.stringify(contract.abi);
      const abiFile = abiDir + "/" + file.slice(0, -4) + "abi";
      fs.writeFileSync(abiFile, abiStr);
    });
});
