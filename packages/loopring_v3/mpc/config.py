# Set this to the folder containing the phase2 repo
phase2_repo_path = "../../../phase2-bn254"

# Setup the following block permutations
circuit_permutations = [[1, False, [1]]]

def str_da(onchainDataAvailability):
    return "_DA_" if onchainDataAvailability else "_"

def base_name(blockType, blockSize, onchainDataAvailability):
    str_block_types = ["trade", "deposit", "withdraw_onchain", "withdraw_offchain", "cancel", "internal_transfer"]
    return str_block_types[blockType] + str_da(onchainDataAvailability) + str(blockSize)

def get_block_filename(blockType, blockSize, onchainDataAvailability):
    return "./blocks/block_meta_" + base_name(blockType, blockSize, onchainDataAvailability) + ".json"

def get_circuit_filename(blockType, blockSize, onchainDataAvailability):
    return "./circuits/circuit_" + base_name(blockType, blockSize, onchainDataAvailability) + ".json"

def get_params_filename(blockType, blockSize, onchainDataAvailability):
    return phase2_repo_path + "/phase2/params/params_" + base_name(blockType, blockSize, onchainDataAvailability) + ".params"

def get_old_params_filename(blockType, blockSize, onchainDataAvailability):
    return phase2_repo_path + "/phase2/old_params/params_" + base_name(blockType, blockSize, onchainDataAvailability) + ".params"

def get_bellman_vk_filename(blockType, blockSize, onchainDataAvailability):
    return phase2_repo_path + "/phase2/keys/" + base_name(blockType, blockSize, onchainDataAvailability) + "_vk.json"

def get_bellman_pk_filename(blockType, blockSize, onchainDataAvailability):
    return phase2_repo_path + "/phase2/keys/" + base_name(blockType, blockSize, onchainDataAvailability) + "_pk.json"

def get_vk_filename(blockType, blockSize, onchainDataAvailability):
    return "keys/" + base_name(blockType, blockSize, onchainDataAvailability) + "_vk.json"

