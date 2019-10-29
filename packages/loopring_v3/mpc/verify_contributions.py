import subprocess
import config

def verify_contribution(blockType, blockSize, onchainDataAvailability):
    circuit = config.get_circuit_filename(blockType, blockSize, onchainDataAvailability)
    old_params = config.get_old_params_filename(blockType, blockSize, onchainDataAvailability)
    new_params = config.get_params_filename(blockType, blockSize, onchainDataAvailability)
    subprocess.check_call([config.phase2_repo_path + "/phase2/target/release/verify_contribution", circuit, old_params, new_params])

if __name__ == "__main__":
    for block_permutations in config.circuit_permutations:
        block_type = block_permutations[0]
        onchainDataAvailability = block_permutations[1]
        for permutation in block_permutations[2]:
            verify_contribution(block_type, permutation, onchainDataAvailability)
