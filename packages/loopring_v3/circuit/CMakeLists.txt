cmake_minimum_required(VERSION 3.9)
project(circuit)

# Set this to the folder containing the protocol3-circuits repo
set(circuit_src_folder "../../../../protocol3-circuits/")

add_executable(dex_circuit "${circuit_src_folder}/main.cpp")
target_link_libraries(dex_circuit ethsnarks_jubjub)

add_library(circuit_service SHARED "${circuit_src_folder}/service.cpp")
target_link_libraries(circuit_service ethsnarks_jubjub)

