#!/bin/bash

cd ethsnarks
sudo apt-get update
sudo make ubuntu-dependencies
make PIP_ARGS= python-dependencies
cd ..
