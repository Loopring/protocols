ROOT_DIR := $(shell dirname $(realpath $(MAKEFILE_LIST)))
PYTHON=python3

# CMAKE_TYPE := cmake-release
CMAKE_TYPE := cmake-openmp-performance
#CMAKE_TYPE := cmake-openmp-debug

ifeq ($(OS),Windows_NT)
	detected_OS := Windows
	DLL_EXT := .dll
else
	detected_OS := $(shell uname -s)
	ifeq ($(detected_OS),Darwin)
		DLL_EXT := .dylib
		export LD_LIBRARY_PATH := /usr/local/opt/openssl/lib:/usr/local/opt/gmp/lib:$(LD_LIBRARY_PATH)
		export LIBRARY_PATH := /usr/local/opt/gmp/lib:$(LIBRARY_PATH)
		export CPATH := /usr/local/opt/openssl/include:/usr/local/opt/gmp/include:/usr/local/opt/boost/include:$(CPATH)
		export PKG_CONFIG_PATH := /usr/local/opt/openssl/lib/pkgconfig:$(PKG_CONFIG_PATH)
		CMAKE_TYPE := cmake-release
	else
		DLL_EXT := .so
	endif
endif

all: test

test: build/circuit/dex_circuit

build/circuit/dex_circuit: $(CMAKE_TYPE)
	make -C build
	mkdir -p keys
	rm -rf ./keys/*

cmake-debug:
	mkdir -p build && cd build && cmake -DCMAKE_BUILD_TYPE=Debug ..

cmake-release:
	mkdir -p build && cd build && cmake -DCMAKE_BUILD_TYPE=Release ..

cmake-openmp-debug:
	mkdir -p build && cd build && cmake -DCMAKE_BUILD_TYPE=Debug -DMULTICORE=1 ..

cmake-openmp-release:
	mkdir -p build && cd build && cmake -DCMAKE_BUILD_TYPE=Release -DMULTICORE=1 ..

cmake-openmp-performance:
	mkdir -p build && cd build && cmake -DCMAKE_BUILD_TYPE=Release -DMULTICORE=1 -DPERFORMANCE=1 ..

git-submodules:
	git submodule update --init --recursive --remote
