import chalk = require('chalk');

export function isInfoEnabled() {
  return process.argv.indexOf("-i") > -1 || isDebugEnabled();
}

export function isDebugEnabled() {
  return process.argv.indexOf("-x") > -1;
}

export function INFO(...args: any[]) {
  if (isInfoEnabled()) {
    console.log(chalk.blue.bold(["[INFO]", ...args].join(" ")));
  }
}

export function DEBUG(...args: any[]) {
  if (isDebugEnabled()) {
    console.log(...args);
  }
}

export function WARN(...args: any[]) {
  console.log(chalk.magenta.bold(["[WARN]", ...args].join(" ")));
}

export function ERROR(...args: any[]) {
  console.log(chalk.red.bold.underline(["[ERROR]", ...args].join(" ")));
}
