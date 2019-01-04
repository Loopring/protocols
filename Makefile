PYTHON=python3

all: test

test: build/dex_circuit rings.json
	./build/dex_circuit 4 rings.json

build/dex_circuit: cmake-openmp-release
	make -C build

cmake-debug:
	mkdir -p build && cd build && cmake -DCMAKE_BUILD_TYPE=Release ..

cmake-release:
	mkdir -p build && cd build && cmake -DCMAKE_BUILD_TYPE=Release ..

cmake-openmp-debug:
	mkdir -p build && cd build && cmake -DCMAKE_BUILD_TYPE=Debug -DMULTICORE=0 ..

cmake-openmp-release:
	mkdir -p build && cd build && cmake -DCMAKE_BUILD_TYPE=Release -DMULTICORE=0 ..

cmake-openmp-performance:
	mkdir -p build && cd build && cmake -DCMAKE_BUILD_TYPE=Release -DMULTICORE=0 -DPERFORMANCE=1 ..

rings.json: test_dex.py
	PYTHONPATH=ethsnarks $(PYTHON) test_dex.py

git-submodules:
	git submodule update --init --recursive
