const fs = require("fs");
const contractBuildPath = "./build/contracts";
const abiDir = "./ABI/version36";

fs.readdir(contractBuildPath, function(err, files) {
  if (err) {
    return console.log(
      `Unable to scan directory: ${contractBuildPath}, error: ${err}`
    );
  }

  files.forEach(function(file) {
    const contract = JSON.parse(
      fs.readFileSync(contractBuildPath + "/" + file),
      "utf8"
    );
    const abiStr = JSON.stringify(contract.abi);
    // abiFile: same as file but replace ext .json with .abi
    const abiFile = abiDir + "/" + file.slice(0, -4) + "abi";
    fs.writeFileSync(abiFile, abiStr);
  });
});
