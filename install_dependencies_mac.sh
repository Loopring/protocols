#!/bin/bash
brew install nvm

cd ethsnarks
make mac-dependencies
nvm install --lts
make PIP_ARGS= python-dependencies
cd ..
