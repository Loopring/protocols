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

    if (argc < 2)
    {
        std::cerr << "Usage: " << argv[0] << " <n> <rings.json>" << std::endl;
        return 1;
    }
    const unsigned int numRings = atoi(argv[1]);


    // Build the circuit
    ethsnarks::ProtoboardT pb;
    Loopring::CircuitGadget circuit(pb, "circuit");
    circuit.generate_r1cs_constraints(numRings);
    circuit.printInfo();

    libsnark::r1cs_gg_ppzksnark_zok_keypair<ethsnarks::ppT> keypair;
    if (argc >= 2)
    {
        std::cout << "Generating keys..." << std::endl;
        auto constraints = pb.get_constraint_system();
        auto temp = libsnark::r1cs_gg_ppzksnark_zok_generator<ethsnarks::ppT>(constraints);
        keypair.pk = temp.pk;
        keypair.vk = temp.vk;

        std::string jVK = vk2json(keypair.vk);
        const char* vkFilename = "vk.json";
        std::ofstream fVK(vkFilename);
        if(!fVK.is_open())
        {
            std::cerr << "Cannot create proof file: " << vkFilename << std::endl;
            return 1;
        }
        fVK << jVK;
        fVK.close();
    }

    if (argc > 2)
    {
        const char* ringsFilename = argv[2];

        // Read the JSON file
        std::ifstream file(ringsFilename);
        if (!file.is_open())
        {
            std::cerr << "Cannot open input file: " << ringsFilename << std::endl;
            return 1;
        }
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
        std::string publicDataHash = input["publicDataHash"].get<std::string>();
        if (!circuit.generateWitness(ringSettlements, publicDataHash))
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
        {
            std::cout << "Generating proof..." << std::endl;
            timespec time1, time2;
            clock_gettime(CLOCK_PROCESS_CPUTIME_ID, &time1);

            auto primaryInput = pb.primary_input();
            auto auxiliaryInput = pb.auxiliary_input();
            auto proof = libsnark::r1cs_gg_ppzksnark_zok_prover<ethsnarks::ppT>(keypair.pk, primaryInput, auxiliaryInput);

            const char* proofFilename = "proof.json";
            std::ofstream fproof(proofFilename);
            if(!fproof.is_open())
            {
                std::cerr << "Cannot create proof file: " << proofFilename << std::endl;
                return 1;
            }
            std::string jProof = proof_to_json(proof, primaryInput);
            fproof << jProof;
            fproof.close();

            clock_gettime(CLOCK_PROCESS_CPUTIME_ID, &time2);
            timespec duration = diff(time1,time2);
            std::cout << "Generated proof in " << duration.tv_sec << " seconds (" << pb.num_constraints() / duration.tv_sec << " constraints/second)" << std::endl;
        }
#endif
    }

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
