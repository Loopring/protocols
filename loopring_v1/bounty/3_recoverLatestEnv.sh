#!/bin/bash

## This script should run from the protocol root directory.
npm uninstall -g truffle
npm uninstall -g ethereumjs-testrpc
npm install -g truffle@4.0.1
npm install -g ethereumjs-testrpc@6.0.1

npm uninstall  &>/dev/null
npm install  &>/dev/null