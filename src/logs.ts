
export function logInfo(...args: any[]) {
  if (process.argv.indexOf("-i") > -1 || process.argv.indexOf("-x") > -1) {
    console.log(...args);
  }
}

export function logDebug(...args: any[]) {
  if (process.argv.indexOf("-x") > -1) {
    console.log(...args);
  }
}
