import os
import subprocess
import json
import config

class Struct(object): pass

def generate_block(blockType, blockSize, onchainDataAvailability):
    block = Struct()
    block.onchainDataAvailability = onchainDataAvailability
    block.blockType = blockType
    block.blockSize = blockSize

    blockJson = json.dumps(block, default=lambda o: o.__dict__, sort_keys=True, indent=4)

    block = config.get_block_filename(blockType, blockSize, onchainDataAvailability)
    if not os.path.exists(block):
        os.makedirs(os.path.dirname(block), exist_ok=True)
    f = open(block, "w+")
    f.write(blockJson)
    f.close()

def export_circuit(blockType, blockSize, onchainDataAvailability):
    block = config.get_block_filename(blockType, blockSize, onchainDataAvailability)
    circuit = config.get_circuit_filename(blockType, blockSize, onchainDataAvailability)
    if not os.path.exists(circuit):
        os.makedirs(os.path.dirname(circuit), exist_ok=True)
    subprocess.check_call(["build/circuit/dex_circuit", "-exportcircuit", block, circuit])

def mpc_setup(blockType, blockSize, onchainDataAvailability):
    circuit = config.get_circuit_filename(blockType, blockSize, onchainDataAvailability)
    params = config.get_params_filename(blockType, blockSize, onchainDataAvailability)
    if not os.path.exists(params):
        os.makedirs(os.path.dirname(params), exist_ok=True)
    subprocess.check_call([config.phase2_repo_path + "/phase2/target/release/new", circuit, params])

if __name__ == "__main__":
    for block_permutations in config.circuit_permutations:
        block_type = block_permutations[0]
        onchainDataAvailability = block_permutations[1]
        for permutation in block_permutations[2]:
            generate_block(block_type, permutation, onchainDataAvailability)
            export_circuit(block_type, permutation, onchainDataAvailability)
            mpc_setup(block_type, permutation, onchainDataAvailability)
