import os
import subprocess
import config

def mpc_export_keys(blockType, blockSize, onchainDataAvailability):
    # Export the params to bellman vk/pk json files
    params = config.get_params_filename(blockType, blockSize, onchainDataAvailability)
    bellman_vk = config.get_bellman_vk_filename(blockType, blockSize, onchainDataAvailability)
    bellman_pk = config.get_bellman_pk_filename(blockType, blockSize, onchainDataAvailability)
    if not os.path.exists(bellman_vk):
        os.makedirs(os.path.dirname(bellman_vk), exist_ok=True)
    if not os.path.exists(bellman_pk):
        os.makedirs(os.path.dirname(bellman_pk), exist_ok=True)
    subprocess.check_call([config.phase2_repo_path + "/phase2/target/release/export_keys", params, bellman_vk, bellman_pk])

    # Use the vk/pk json files to creates the vk/pk files compatible with ethsnarks
    # vk
    vk = config.get_vk_filename(blockType, blockSize, onchainDataAvailability)
    if not os.path.exists(vk):
        os.makedirs(os.path.dirname(vk), exist_ok=True)
    subprocess.check_call(["python3", config.phase2_repo_path + "/phase2/tools/vk2ethsnarks.py", bellman_vk, vk])
    # pk
    block = config.get_block_filename(blockType, blockSize, onchainDataAvailability)
    subprocess.check_call(["build/circuit/dex_circuit", "-createpk", block, bellman_pk])

if __name__ == "__main__":
    for block_permutations in config.circuit_permutations:
        block_type = block_permutations[0]
        onchainDataAvailability = block_permutations[1]
        for permutation in block_permutations[2]:
            mpc_export_keys(block_type, permutation, onchainDataAvailability)
