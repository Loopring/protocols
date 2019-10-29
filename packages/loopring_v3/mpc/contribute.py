import subprocess
import config

def mpc_contribute(blockType, blockSize, onchainDataAvailability, entropy):
    params = config.get_params_filename(blockType, blockSize, onchainDataAvailability)
    subprocess.check_call([config.phase2_repo_path + "/phase2/target/release/contribute", params, entropy])

if __name__ == "__main__":
    entropy = input("Type some random text and press [ENTER] to provide additional entropy...\n")
    for block_permutations in config.circuit_permutations:
        block_type = block_permutations[0]
        onchainDataAvailability = block_permutations[1]
        for permutation in block_permutations[2]:
            mpc_contribute(block_type, permutation, onchainDataAvailability, entropy)
