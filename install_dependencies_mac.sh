#!/bin/bash

cd ethsnarks
make mac-dependencies
nvm install --lts
make PIP_ARGS= python-dependencies
cd ..
