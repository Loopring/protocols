#include "Utils/Data.h"
#include "Circuits/TradeCircuit.h"
#include "Circuits/DepositCircuit.h"
#include "Circuits/WithdrawCircuit.h"
#include "Circuits/CancelCircuit.h"

#include "ThirdParty/json.hpp"
#include "ethsnarks.hpp"
#include "stubs.hpp"
#include <fstream>

#ifdef MULTICORE
#include <omp.h>
#endif

using json = nlohmann::json;

enum class Mode
{
    CreateKeys = 0,
    Validate,
    Prove
};

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

bool fileExists(const char *fileName)
{
    std::ifstream infile(fileName);
    return infile.good();
}

bool generateKeyPair(ethsnarks::ProtoboardT& pb, std::string& baseFilename)
{
    std::string provingKeyFilename = baseFilename + "_pk.raw";
    std::string verificationKeyFilename = baseFilename + "_vk.json";
    if (fileExists(provingKeyFilename.c_str()) && fileExists(verificationKeyFilename.c_str()))
    {
        return true;
    }
    std::cout << "Generating keys..." << std::endl;
    int result = stub_genkeys_from_pb(pb, provingKeyFilename.c_str(), verificationKeyFilename.c_str());
    return (result == 0);
}

bool generateProof(ethsnarks::ProtoboardT& pb, const char *provingKeyFilename, const char* proofFilename)
{
    std::cout << "Generating proof..." << std::endl;
    timespec time1, time2;
    clock_gettime(CLOCK_MONOTONIC, &time1);

    std::string jProof = stub_prove_from_pb(pb, provingKeyFilename);

    clock_gettime(CLOCK_MONOTONIC, &time2);
    timespec duration = diff(time1,time2);
    std::cout << "Generated proof in " << duration.tv_sec << " seconds (" << pb.num_constraints() / duration.tv_sec << " constraints/second)" << std::endl;

    std::ofstream fproof(proofFilename);
    if (!fproof.is_open())
    {
        std::cerr << "Cannot create proof file: " << proofFilename << std::endl;
        return 1;
    }
    fproof << jProof;
    fproof.close();

    return true;
}

bool trade(Mode mode, bool onchainDataAvailability, unsigned int numRings,
           const json& input, ethsnarks::ProtoboardT& outPb)
{
    // Build the circuit
    Loopring::TradeCircuitGadget circuit(outPb, "circuit");
    circuit.generate_r1cs_constraints(onchainDataAvailability, numRings);
    circuit.printInfo();

    if (mode == Mode::Validate || mode == Mode::Prove)
    {
        json jRingSettlements = input["ringSettlements"];
        if (jRingSettlements.size() != numRings)
        {
            std::cerr << "Invalid number of rings in input file: " << jRingSettlements.size() << std::endl;
            return false;
        }

        Loopring::TradeContext context = input.get<Loopring::TradeContext>();

        // Generate witness values for the given input values
        if (!circuit.generateWitness(context))
        {
            std::cerr << "Could not generate witness!" << std::endl;
            return false;
        }
    }
    return true;
}

bool deposit(Mode mode, unsigned int numDeposits, const json& input, ethsnarks::ProtoboardT& outPb)
{
    // Build the circuit
    Loopring::DepositsCircuitGadget circuit(outPb, "circuit");
    circuit.generate_r1cs_constraints(numDeposits);
    circuit.printInfo();

    if (mode == Mode::Validate || mode == Mode::Prove)
    {
        json jDeposits = input["deposits"];
        if (jDeposits.size() != numDeposits)
        {
            std::cerr << "Invalid number of deposits in input file: " << jDeposits.size() << std::endl;
            return false;
        }

        Loopring::DepositContext context = input.get<Loopring::DepositContext>();

        // Generate witness values for the given input values
        if (!circuit.generateWitness(context))
        {
            std::cerr << "Could not generate witness!" << std::endl;
            return false;
        }
    }
    return true;
}

bool withdraw(Mode mode, bool onchainDataAvailability, bool onchain, unsigned int numWithdrawals, const json& input, ethsnarks::ProtoboardT& outPb)
{
    // Build the circuit
    Loopring::WithdrawCircuitGadget circuit(outPb, onchain, "circuit");
    circuit.generate_r1cs_constraints(onchainDataAvailability, numWithdrawals);
    circuit.printInfo();

    if (mode == Mode::Validate || mode == Mode::Prove)
    {
        json jWithdrawals = input["withdrawals"];
        if (jWithdrawals.size() != numWithdrawals)
        {
            std::cerr << "Invalid number of withdrawals in input file: " << jWithdrawals.size() << std::endl;
            return false;
        }

        Loopring::WithdrawContext context = input.get<Loopring::WithdrawContext>();

        // Generate witness values for the given input values
        if (!circuit.generateWitness(context))
        {
            std::cerr << "Could not generate witness!" << std::endl;
            return false;
        }
    }
    return true;
}

bool cancel(Mode mode, bool onchainDataAvailability, unsigned int numCancels, const json& input, ethsnarks::ProtoboardT& outPb)
{
    // Build the circuit
    Loopring::CancelsCircuitGadget circuit(outPb, "circuit");
    circuit.generate_r1cs_constraints(onchainDataAvailability, numCancels);
    circuit.printInfo();

    if (mode == Mode::Validate || mode == Mode::Prove)
    {
        json jCancels = input["cancels"];
        if (jCancels.size() != numCancels)
        {
            std::cerr << "Invalid number of cancels in input file: " << jCancels.size() << std::endl;
            return false;
        }

        Loopring::CancelContext context = input.get<Loopring::CancelContext>();

        // Generate witness values for the given input values
        if (!circuit.generateWitness(context))
        {
            std::cerr << "Could not generate witness!" << std::endl;
            return false;
        }
    }
    return true;
}

int main (int argc, char **argv)
{
    ethsnarks::ppT::init_public_params();

    if (argc < 3)
    {
        std::cerr << "Usage: " << argv[0] << std::endl;
        std::cerr << "-validate <block.json>: Validates a block" << std::endl;
        std::cerr << "-prove <block.json> <out_proof.json>: Proves a block" << std::endl;
        std::cerr << "-createkeys <protoBlock.json>: Creates prover/verifier keys" << std::endl;
        return 1;
    }

#ifdef MULTICORE
    const int max_threads = omp_get_max_threads();
    std::cout << "Num threads: " << max_threads << std::endl;
#endif

    const char* proofFilename = NULL;
    Mode mode = Mode::Validate;
    if (strcmp(argv[1], "-validate") == 0)
    {
        mode = Mode::Validate;
        std::cout << "Validating " << argv[2] << "..." << std::endl;
    }
    else if (strcmp(argv[1], "-prove") == 0)
    {
        if (argc != 4)
        {
            return 1;
        }
        mode = Mode::Prove;
        proofFilename = argv[3];
        std::cout << "Proving " << argv[2] << "..." << std::endl;
    }
    else if (strcmp(argv[1], "-createkeys") == 0)
    {
        if (argc != 3)
        {
            return 1;
        }
        mode = Mode::CreateKeys;
        std::cout << "Creating keys for " << argv[2] << "..." << std::endl;
    }
    else
    {
        std::cerr << "Unknown option: " << argv[1] << std::endl;
        return 1;
    }

    // Read the JSON file
    const char* filename = argv[2];
    std::ifstream file(filename);
    if (!file.is_open())
    {
        std::cerr << "Cannot open input file: " << filename << std::endl;
        return 1;
    }
    json input;
    file >> input;
    file.close();

    // Read meta data
    int blockType = input["blockType"].get<int>();
    unsigned int numElements = input["numElements"].get<int>();
    bool onchainDataAvailability = input["onchainDataAvailability"].get<bool>();
    std::string strOnchainDataAvailability = onchainDataAvailability ? "_DA_" : "_";
    std::string postFix = strOnchainDataAvailability + std::to_string(numElements);

    std::cout << "Building circuit... " << std::endl;
    std::string baseFilename = "keys/";
    ethsnarks::ProtoboardT pb;
    switch(blockType)
    {
        case 0:
        {
            baseFilename += "trade" + postFix;
            if (!trade(mode, onchainDataAvailability, numElements, input, pb))
            {
                return 1;
            }
            break;
        }
        case 1:
        {
            baseFilename += "deposit" + postFix;
            if (!deposit(mode, numElements, input, pb))
            {
                return 1;
            }
            break;
        }
        case 2:
        case 3:
        {
            bool onchain = (blockType == 2) ? true : false;
            baseFilename += "withdraw_" + (onchain ? std::string("onchain") : std::string("offchain")) + postFix;
            if (!withdraw(mode, onchainDataAvailability, onchain, numElements, input, pb))
            {
                return 1;
            }
            break;
        }
        case 4:
        {
            baseFilename += "cancel" + postFix;
            if (!cancel(mode, onchainDataAvailability, numElements, input, pb))
            {
                return 1;
            }
            break;
        }
        default:
        {
            std::cerr << "Unknown block type: " << blockType << std::endl;
            return 1;
        }
    }

    if (mode == Mode::Validate || mode == Mode::Prove)
    {
        // Check if the inputs are valid for the circuit
        if (!pb.is_satisfied())
        {
            std::cerr << "Block is not valid!" << std::endl;
            return 1;
        }
        std::cout << "Block is valid." << std::endl;
    }

    if (mode == Mode::CreateKeys || mode == Mode::Prove)
    {
        if (!generateKeyPair(pb, baseFilename))
        {
            std::cerr << "Failed to generate keys!" << std::endl;
            return 1;
        }
    }

    if (mode == Mode::Prove)
    {
        if (!generateProof(pb, (baseFilename + "_pk.raw").c_str(), proofFilename))
        {
            return 1;
        }
    }

    return 0;
}
