export function doInfoLogging() {
  return process.argv.indexOf("-i") > -1 || doDebugLogging();
}

export function doDebugLogging() {
  return process.argv.indexOf("-x") > -1;
}

export function logInfo(...args: any[]) {
  if (doInfoLogging()) {
    console.log(...args);
  }
}

export function logDebug(...args: any[]) {
  if (doDebugLogging()) {
    console.log(...args);
  }
}
