# DEX using zk-SNARKs

## Building

Type `make` - the first time you run it will retrieve submodules, setup cmake and build everything.

Before building, you may need to retrieve the source code for the dependencies:

	git submodule update --init --recursive

The following dependencies (for Linux) are needed:

 * cmake
 * g++ or clang++
 * gmp
 * libcrypto
 * boost
 * npm / nvm
