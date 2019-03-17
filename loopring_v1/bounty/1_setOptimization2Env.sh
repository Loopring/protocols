#!/bin/bash

## This script should run from the protocol root directory.

npm uninstall -g truffle
npm uninstall -g ethereumjs-testrpc
npm install -g truffle@3.4.11
npm install -g ethereumjs-testrpc@4.1.3
