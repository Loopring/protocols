from create_block import *
import subprocess

class Struct(object): pass

def generate_keys(blockType, blockSize):
    block = Struct()
    block.blockType = blockType
    block.blockSize = blockSize

    blockJson = json.dumps(block, default=lambda o: o.__dict__, sort_keys=True, indent=4)
    print("blockJson:", blockJson)

    inputFile = "./blocks/block_meta_" + str(blockType) + "_" + str(blockSize) + ".json"
    f = open(inputFile, "w+")
    f.write(blockJson)
    f.close()
    subprocess.check_call(["build/circuit/dex_circuit", "-createkeys", inputFile])


if __name__ == "__main__":
    # generate keys for blocks with length: [1-16, 32, 64, 96, 128]
    size_arr = [*range(1, 17), 32, 64, 96, 128]
    # size_arr = [4] # simple test

    for size in size_arr:
        for blockType in range(4):
            generate_keys(blockType, size, False)

    for size in size_arr:
        for blockType in [0, 3]:
            generate_keys(blockType, size, True)
