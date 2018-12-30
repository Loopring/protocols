#include "Data.h"
#include "Circuit.h"

#include "json.hpp"
#include "ethsnarks.hpp"
#include "stubs.hpp"
#include <fstream>

using json = nlohmann::json;

timespec diff(timespec start, timespec end);

int main (int argc, char **argv)
{
    ethsnarks::ppT::init_public_params();

    if (argc < 3)
    {
        std::cerr << "Usage: " << argv[0] << " <n> <transactions.txt>" << std::endl;
        return 1;
    }
    const unsigned int numRings = atoi(argv[1]);
    const char* filename = argv[2];

    // Build the circuit
    ethsnarks::ProtoboardT pb;
    Loopring::CircuitGadget circuit(pb, "circuit");
    circuit.build(numRings);
    circuit.printInfo();

    // Read the input values from the file
    std::ifstream file(filename);
    if (!file.is_open())
    {
        std::cerr << "Cannot open input file: " << filename << std::endl;
        return 1;
    }

    // Read the JSON file
    json input;
    file >> input;
    json jRingSettlements = input["ringSettlements"];
    if (jRingSettlements.size() < numRings)
    {
        std::cerr << "Not enought rings in input file: " << jRingSettlements.size() << std::endl;
        return 1;
    }
    // Read settlements
    std::vector<Loopring::RingSettlement> ringSettlements;
    for(unsigned int i = 0; i < numRings; i++)
    {
        ringSettlements.emplace_back(jRingSettlements[i].get<Loopring::RingSettlement>());
    }

    // Generate witness values for the given input values
    if (!circuit.generateWitness(ringSettlements))
    {
        std::cerr << "Could not generate witness!" << std::endl;
        return 1;
    }

    // Check if the inputs are valid for the circuit
    if (!pb.is_satisfied())
    {
        std::cerr << "Input is not valid!" << std::endl;
        return 1;
    }
    std::cout << "Input is valid." << std::endl;

#if 1
    std::cout << "Generating keys..." << std::endl;
    auto constraints = pb.get_constraint_system();
    auto keypair = libsnark::r1cs_gg_ppzksnark_zok_generator<ethsnarks::ppT>(constraints);

    std::cout << "Generating proof..." << std::endl;
    timespec time1, time2;
    clock_gettime(CLOCK_PROCESS_CPUTIME_ID, &time1);

    auto primary_input = pb.primary_input();
    auto auxiliary_input = pb.auxiliary_input();
    auto proof = libsnark::r1cs_gg_ppzksnark_zok_prover<ethsnarks::ppT>(keypair.pk, primary_input, auxiliary_input);

    clock_gettime(CLOCK_PROCESS_CPUTIME_ID, &time2);
    timespec duration = diff(time1,time2);
    std::cout << "Generated proof in " << duration.tv_sec << " seconds (" << pb.num_constraints() / duration.tv_sec << " constraints/second)" << std::endl;
#endif

    return 0;
}

timespec diff(timespec start, timespec end)
{
    timespec temp;
    if ((end.tv_nsec-start.tv_nsec) < 0)
    {
        temp.tv_sec = end.tv_sec - start.tv_sec - 1;
        temp.tv_nsec = 1000000000 + end.tv_nsec - start.tv_nsec;
    }
    else
    {
        temp.tv_sec = end.tv_sec - start.tv_sec;
        temp.tv_nsec = end.tv_nsec - start.tv_nsec;
    }
    return temp;
}
