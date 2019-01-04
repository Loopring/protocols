cmake_minimum_required(VERSION 3.9)
project(snarks-dex)
add_subdirectory(ethsnarks ethsnarks EXCLUDE_FROM_ALL)
add_subdirectory(circuit circuit)
