cmake_minimum_required(VERSION 3.9)
project(circuit)

set(
  CURVE
  "MCL_BN128"
  CACHE
  STRING
  "Default curve: one of ALT_BN128, BN128, MCL_BN128, EDWARDS, MNT4, MNT6"
)

if("${MULTICORE}")
  add_definitions(-DMULTICORE=1)
endif()

add_definitions(-DCURVE_${CURVE})

# Set this to the folder containing the protocol3-circuits repo
set(circuit_src_folder "../../../../protocol3-circuits/")

add_executable(dex_circuit "${circuit_src_folder}/main.cpp")
target_link_libraries(dex_circuit ethsnarks_jubjub)
if("${PERFORMANCE}")
  set_target_properties(dex_circuit PROPERTIES INTERPROCEDURAL_OPTIMIZATION TRUE)
endif()

#file(GLOB test_filenames
#    "${circuit_src_folder}/test/*.cpp"
#)

#add_executable(dex_circuit_tests ${test_filenames})
#target_link_libraries(dex_circuit_tests ethsnarks_jubjub)

if("${GPU_PROVE}")
  add_definitions(-DGPU_PROVE=1)
  enable_language(CUDA)
  target_compile_features(prover_reference_functions PUBLIC cxx_std_11)
  add_executable(dex_circuit_gpu "${circuit_src_folder}/cuda_prover/cuda_prover.cu")
  target_link_libraries(dex_circuit_gpu prover_reference_functions)
endif()
