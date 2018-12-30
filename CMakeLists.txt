cmake_minimum_required(VERSION 3.9)
project(snarks-dex)
add_subdirectory(ethsnarks ethsnarks EXCLUDE_FROM_ALL)

add_executable(dex_circuit main.cpp)
target_link_libraries(dex_circuit ethsnarks_jubjub)
