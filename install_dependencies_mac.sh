#!/bin/bash
brew install nvm
NVM_DIR="$HOME/.nvm"
[ -s "/usr/local/opt/nvm/nvm.sh" ] && . "/usr/local/opt/nvm/nvm.sh"  # This loads nvm

cd ethsnarks
make mac-dependencies
nvm install --lts
make PIP_ARGS= python-dependencies
cd ..
