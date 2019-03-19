#!/bin/bash


## This script should run from the protocol root directory.

kill $(ps aux | grep '[t]estrpc' | awk '{print $2}')
LATEST_COMMIT=`git log | head -n 1 | awk '{print $2}'`

## Before optimization #x PR
echo
git reset --hard 8f279792062d9dde1ef6dc0e2f9167e40c96a72e
npm uninstall &>/dev/null
npm install &>/dev/null
npm run testrpc &>/dev/null &
echo "Before optimization"
npm run test | grep cumulativeGasUsed

## After optimization#x PR
echo
git reset --hard 618d8c49cfcf52be6a1c418c8bc9b603c59e73f7
echo "After optimization"
npm run test | grep cumulativeGasUsed

kill $(ps aux | grep '[t]estrpc' | awk '{print $2}')

## reset to latest commit
echo
git reset --hard $LATEST_COMMIT