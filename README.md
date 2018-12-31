# Loopring protocol using zk-SNARKs

## Building

Before building retrieve the source code for the dependencies:

    git submodule update --init --recursive

Install all dependencies by running

    ./install_dependencies_linux.sh

on Linux or

    ./install_dependencies_mac.sh

on Mac (untested).

Type `make` to build everything.

The following dependencies (for Linux) are needed:

 * cmake
 * g++ or clang++
 * gmp
 * libcrypto
 * boost
 * npm / nvm
