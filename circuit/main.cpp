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

bool generateKeyPair(const ethsnarks::ProtoboardT& pb, libsnark::r1cs_gg_ppzksnark_zok_keypair<ethsnarks::ppT>& outKeyPair)
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
}

bool generateProof(const ethsnarks::ProtoboardT& pb, const libsnark::r1cs_gg_ppzksnark_zok_keypair<ethsnarks::ppT>& keyPair)
{
    std::cout << "Generating proof..." << std::endl;
    timespec time1, time2;
    clock_gettime(CLOCK_PROCESS_CPUTIME_ID, &time1);

    auto primaryInput = pb.primary_input();
    auto auxiliaryInput = pb.auxiliary_input();
    auto proof = libsnark::r1cs_gg_ppzksnark_zok_prover<ethsnarks::ppT>(keyPair.pk, primaryInput, auxiliaryInput);

    const char* proofFilename = "proof.json";
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

bool generateData(Mode mode, const ethsnarks::ProtoboardT& pb)
{
    libsnark::r1cs_gg_ppzksnark_zok_keypair<ethsnarks::ppT> keypair;
    if (mode == Mode::CreateKeys || mode == Mode::Prove)
    {
        if (!generateKeyPair(pb, keypair))
        {
            return false;
        }
    }

    if (mode == Mode::Prove)
    {
        if (!generateProof(pb, keypair))
        {
            return false;
        }
    }

    return true;
}


int submitRings(Mode mode, unsigned int numRings, const json& input)
{
    // Build the circuit
    ethsnarks::ProtoboardT pb;
    Loopring::TradeCircuitGadget circuit(pb, "circuit");
    circuit.generate_r1cs_constraints(numRings);
    circuit.printInfo();

    if (mode == Mode::Verify || mode == Mode::Prove)
    {
        json jRingSettlements = input["ringSettlements"];
        if (jRingSettlements.size() != numRings)
        {
            std::cerr << "Invalid number of rings in input file: " << jRingSettlements.size() << std::endl;
            return 1;
        }

        std::string tradingHistoryMerkleRootBefore = input["tradingHistoryMerkleRootBefore"].get<std::string>();
        std::string tradingHistoryMerkleRootAfter = input["tradingHistoryMerkleRootAfter"].get<std::string>();
        std::string accountsMerkleRootBefore = input["accountsMerkleRootBefore"].get<std::string>();
        std::string accountsMerkleRootAfter = input["accountsMerkleRootAfter"].get<std::string>();

        // Read settlements
        std::vector<Loopring::RingSettlement> ringSettlements;
        for(unsigned int i = 0; i < numRings; i++)
        {
            ringSettlements.emplace_back(jRingSettlements[i].get<Loopring::RingSettlement>());
        }

        // Generate witness values for the given input values
        if (!circuit.generateWitness(ringSettlements,
                                     tradingHistoryMerkleRootBefore, tradingHistoryMerkleRootAfter,
                                     accountsMerkleRootBefore, accountsMerkleRootAfter))
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
    }

    if (!generateData(mode, pb))
    {
        return 1;
    }
    return 0;
}

int deposit(Mode mode, unsigned int numDeposits, const json& input)
{
    // Build the circuit
    ethsnarks::ProtoboardT pb;
    Loopring::DepositsCircuitGadget circuit(pb, "circuit");
    circuit.generate_r1cs_constraints(numDeposits);
    circuit.printInfo();

    if (mode == Mode::Verify || mode == Mode::Prove)
    {
        json jDeposits = input["deposits"];
        if (jDeposits.size() != numDeposits)
        {
            std::cerr << "Invalid number of deposits in input file: " << jDeposits.size() << std::endl;
            return 1;
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
            return 1;
        }

        // Check if the inputs are valid for the circuit
        if (!pb.is_satisfied())
        {
            std::cerr << "Input is not valid!" << std::endl;
            return 1;
        }
        std::cout << "Input is valid." << std::endl;
    }

    if (!generateData(mode, pb))
    {
        return 1;
    }
    return 0;
}

int withdraw(Mode mode, unsigned int numWithdrawals, const json& input)
{
    // Build the circuit
    ethsnarks::ProtoboardT pb;
    Loopring::WithdrawalsCircuitGadget circuit(pb, "circuit");
    circuit.generate_r1cs_constraints(numWithdrawals);
    circuit.printInfo();

    if (mode == Mode::Verify || mode == Mode::Prove)
    {
        json jWithdrawals = input["withdrawals"];
        if (jWithdrawals.size() != numWithdrawals)
        {
            std::cerr << "Invalid number of withdrawals in input file: " << jWithdrawals.size() << std::endl;
            return 1;
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
            return 1;
        }

        // Check if the inputs are valid for the circuit
        if (!pb.is_satisfied())
        {
            std::cerr << "Input is not valid!" << std::endl;
            return 1;
        }
        std::cout << "Input is valid." << std::endl;
    }

    if (!generateData(mode, pb))
    {
        return 1;
    }
    return 0;
}

int cancel(Mode mode, unsigned int numCancels, const json& input)
{
    // Build the circuit
    ethsnarks::ProtoboardT pb;
    Loopring::CancelsCircuitGadget circuit(pb, "circuit");
    circuit.generate_r1cs_constraints(numCancels);
    circuit.printInfo();

    if (mode == Mode::Verify || mode == Mode::Prove)
    {
        json jCancels = input["cancels"];
        if (jCancels.size() != numCancels)
        {
            std::cerr << "Invalid number of cancels in input file: " << jCancels.size() << std::endl;
            return 1;
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
            return 1;
        }

        // Check if the inputs are valid for the circuit
        if (!pb.is_satisfied())
        {
            std::cerr << "Input is not valid!" << std::endl;
            return 1;
        }
        std::cout << "Input is valid." << std::endl;
    }

    if (!generateData(mode, pb))
    {
        return 1;
    }
    return 0;
}

int main (int argc, char **argv)
{
    ethsnarks::ppT::init_public_params();

    if (argc != 3)
    {
        std::cerr << "Usage: " << argv[0] << std::endl;
        std::cerr << "-verify <block.json>: Verifies a block" << std::endl;
        std::cerr << "-prove <block.json>: Proves a block" << std::endl;
        return 1;
    }

    Mode mode = Mode::Verify;
    if (strcmp(argv[1], "-verify") == 0)
    {
        mode = Mode::Verify;
    }
    else if (strcmp(argv[1], "-prove") == 0)
    {
        mode = Mode::Prove;
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
    int blockType = input["blockType"].get<int>();
    std::cerr << "BlockType: " << blockType << std::endl;

    unsigned int numElements = input["numElements"].get<int>();

    switch(blockType)
    {
        case 0:
        {
            return submitRings(mode, numElements, input);
        }
        case 1:
        {
            return deposit(mode, numElements, input);
        }
        case 2:
        {
            return withdraw(mode, numElements, input);
        }
        case 3:
        {
            return cancel(mode, numElements, input);
        }
    }
}
