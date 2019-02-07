#include "Data.h"
#include "Circuit.h"

#include "json.hpp"
#include "ethsnarks.hpp"
#include "stubs.hpp"
#include <fstream>

using json = nlohmann::json;

enum class Mode
{
    CreateKeys = 0,
    Verify,
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

bool generateKeyPair(ethsnarks::ProtoboardT& pb, libsnark::r1cs_gg_ppzksnark_zok_keypair<ethsnarks::ppT>& outKeyPair)
{
    std::cout << "Generating keys..." << std::endl;
    auto constraints = pb.get_constraint_system();
    auto temp = libsnark::r1cs_gg_ppzksnark_zok_generator<ethsnarks::ppT>(constraints);
    outKeyPair.pk = temp.pk;
    outKeyPair.vk = temp.vk;

    std::string jVK = vk2json(outKeyPair.vk);
    const char* vkFilename = "vk.json";
    std::ofstream fVK(vkFilename);
    if (!fVK.is_open())
    {
        std::cerr << "Cannot create proof file: " << vkFilename << std::endl;
        return false;
    }
    fVK << jVK;
    fVK.close();

    return true;
    //int result = stub_genkeys_from_pb(pb, "pk.raw", "vk.json");
    //return (result == 0);
}

bool generateProof(const ethsnarks::ProtoboardT& pb, const ethsnarks::ProvingKeyT& provingKey,
                   /*const char *provingKeyFilename, */const char* proofFilename)
{
    //std::cout << "Reading proving key " << provingKeyFilename << std::endl;
    //auto provingKey = ethsnarks::loadFromFile<ethsnarks::ProvingKeyT>(provingKeyFilename);

    std::cout << "Generating proof..." << std::endl;
    timespec time1, time2;
    clock_gettime(CLOCK_PROCESS_CPUTIME_ID, &time1);

    auto primaryInput = pb.primary_input();
    auto auxiliaryInput = pb.auxiliary_input();
    auto proof = libsnark::r1cs_gg_ppzksnark_zok_prover<ethsnarks::ppT>(provingKey, primaryInput, auxiliaryInput);

    std::ofstream fproof(proofFilename);
    if (!fproof.is_open())
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

    return true;
}

bool trade(Mode mode, unsigned int numRings, const json& input, ethsnarks::ProtoboardT& outPb)
{
    // Build the circuit
    Loopring::TradeCircuitGadget circuit(outPb, "circuit");
    circuit.generate_r1cs_constraints(numRings);
    circuit.printInfo();

    if (mode == Mode::Verify || mode == Mode::Prove)
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

    if (mode == Mode::Verify || mode == Mode::Prove)
    {
        json jDeposits = input["deposits"];
        if (jDeposits.size() != numDeposits)
        {
            std::cerr << "Invalid number of deposits in input file: " << jDeposits.size() << std::endl;
            return false;
        }

        std::string accountsMerkleRootBefore = input["accountsMerkleRootBefore"].get<std::string>();
        std::string accountsMerkleRootAfter = input["accountsMerkleRootAfter"].get<std::string>();

        // Read deposits
        std::vector<Loopring::Deposit> deposits;
        for(unsigned int i = 0; i < numDeposits; i++)
        {
            deposits.emplace_back(jDeposits[i].get<Loopring::Deposit>());
        }

        // Generate witness values for the given input values
        if (!circuit.generateWitness(deposits, accountsMerkleRootBefore, accountsMerkleRootAfter))
        {
            std::cerr << "Could not generate witness!" << std::endl;
            return false;
        }
    }
    return true;
}

bool withdraw(Mode mode, unsigned int numWithdrawals, const json& input, ethsnarks::ProtoboardT& outPb)
{
    // Build the circuit
    Loopring::WithdrawalsCircuitGadget circuit(outPb, "circuit");
    circuit.generate_r1cs_constraints(numWithdrawals);
    circuit.printInfo();

    if (mode == Mode::Verify || mode == Mode::Prove)
    {
        json jWithdrawals = input["withdrawals"];
        if (jWithdrawals.size() != numWithdrawals)
        {
            std::cerr << "Invalid number of withdrawals in input file: " << jWithdrawals.size() << std::endl;
            return false;
        }

        std::string accountsMerkleRootBefore = input["accountsMerkleRootBefore"].get<std::string>();
        std::string accountsMerkleRootAfter = input["accountsMerkleRootAfter"].get<std::string>();

        // Read withdrawals
        std::vector<Loopring::Withdrawal> withdrawals;
        for(unsigned int i = 0; i < numWithdrawals; i++)
        {
            withdrawals.emplace_back(jWithdrawals[i].get<Loopring::Withdrawal>());
        }

        // Generate witness values for the given input values
        if (!circuit.generateWitness(withdrawals, accountsMerkleRootBefore, accountsMerkleRootAfter))
        {
            std::cerr << "Could not generate witness!" << std::endl;
            return false;
        }
    }
    return true;
}

bool cancel(Mode mode, unsigned int numCancels, const json& input, ethsnarks::ProtoboardT& outPb)
{
    // Build the circuit
    Loopring::CancelsCircuitGadget circuit(outPb, "circuit");
    circuit.generate_r1cs_constraints(numCancels);
    circuit.printInfo();

    if (mode == Mode::Verify || mode == Mode::Prove)
    {
        json jCancels = input["cancels"];
        if (jCancels.size() != numCancels)
        {
            std::cerr << "Invalid number of cancels in input file: " << jCancels.size() << std::endl;
            return false;
        }

        std::string tradingHistoryMerkleRootBefore = input["tradingHistoryMerkleRootBefore"].get<std::string>();
        std::string tradingHistoryMerkleRootAfter = input["tradingHistoryMerkleRootAfter"].get<std::string>();
        std::string accountsMerkleRoot = input["accountsMerkleRoot"].get<std::string>();

        // Read cancels
        std::vector<Loopring::Cancellation> cancels;
        for(unsigned int i = 0; i < numCancels; i++)
        {
            cancels.emplace_back(jCancels[i].get<Loopring::Cancellation>());
        }

        // Generate witness values for the given input values
        if (!circuit.generateWitness(cancels, tradingHistoryMerkleRootBefore, tradingHistoryMerkleRootAfter, accountsMerkleRoot))
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
        std::cerr << "-verify <block.json>: Verifies a block" << std::endl;
        std::cerr << "-prove <block.json> <out_proof.json>: Proves a block" << std::endl;
        std::cerr << "-createkeys <protoBlock.json>: Creates prover/verifier keys" << std::endl;
        return 1;
    }

    const char* proofFilename = NULL;
    Mode mode = Mode::Verify;
    if (strcmp(argv[1], "-verify") == 0)
    {
        mode = Mode::Verify;
        std::cout << "Verifying " << argv[2] << "..." << std::endl;
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

    std::cout << "Building circuit... " << std::endl;
    ethsnarks::ProtoboardT pb;
    switch(blockType)
    {
        case 0:
        {
            if (!trade(mode, numElements, input, pb))
            {
                return 1;
            }
            break;
        }
        case 1:
        {
            if (!deposit(mode, numElements, input, pb))
            {
                return 1;
            }
            break;
        }
        case 2:
        {
            if (!withdraw(mode, numElements, input, pb))
            {
                return 1;
            }
            break;
        }
        case 3:
        {
            if (!cancel(mode, numElements, input, pb))
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

    if (mode == Mode::Verify || mode == Mode::Prove)
    {
        // Check if the inputs are valid for the circuit
        if (!pb.is_satisfied())
        {
            std::cerr << "Block is not valid!" << std::endl;
            return 1;
        }
        std::cout << "Block is valid." << std::endl;
    }

    libsnark::r1cs_gg_ppzksnark_zok_keypair<ethsnarks::ppT> keypair;
    if (mode == Mode::CreateKeys || mode == Mode::Prove)
    {
        if (!generateKeyPair(pb, keypair))
        {
            std::cerr << "Failed to generate keys!" << std::endl;
            return 1;
        }
    }

    if (mode == Mode::Prove)
    {
        if (!generateProof(pb, keypair.pk, proofFilename))
        {
            return 1;
        }
    }

    return 0;
}
