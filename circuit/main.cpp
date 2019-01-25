#include "Data.h"
#include "Circuit.h"

#include "json.hpp"
#include "ethsnarks.hpp"
#include "stubs.hpp"
#include <fstream>

using json = nlohmann::json;


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


int submitRings(unsigned int numRings, const char* ringsFilename)
{
    // Build the circuit
    ethsnarks::ProtoboardT pb;
    Loopring::TradeCircuitGadget circuit(pb, "circuit");
    circuit.generate_r1cs_constraints(numRings);
    circuit.printInfo();

#if 1
    libsnark::r1cs_gg_ppzksnark_zok_keypair<ethsnarks::ppT> keypair;
    if (ringsFilename != NULL)
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
#endif

    if (ringsFilename != NULL)
    {
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
        std::string tradingHistoryMerkleRootBefore = input["tradingHistoryMerkleRootBefore"].get<std::string>();
        std::string tradingHistoryMerkleRootAfter = input["tradingHistoryMerkleRootAfter"].get<std::string>();
        std::string accountsMerkleRootBefore = input["accountsMerkleRootBefore"].get<std::string>();
        std::string accountsMerkleRootAfter = input["accountsMerkleRootAfter"].get<std::string>();
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

int deposit(unsigned int numAccounts, const char* accountsFilename)
{
    // Build the circuit
    ethsnarks::ProtoboardT pb;
    Loopring::DepositsCircuitGadget circuit(pb, "circuit");
    circuit.generate_r1cs_constraints(numAccounts);
    circuit.printInfo();

#if 1
    libsnark::r1cs_gg_ppzksnark_zok_keypair<ethsnarks::ppT> keypair;
    if (accountsFilename != NULL)
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
#endif

    if (accountsFilename != NULL)
    {
        // Read the JSON accountsFilename
        std::ifstream file(accountsFilename);
        if (!file.is_open())
        {
            std::cerr << "Cannot open input file: " << accountsFilename << std::endl;
            return 1;
        }
        json input;
        file >> input;
        json jDeposits = input["deposits"];
        std::string accountsMerkleRootBefore = input["accountsMerkleRootBefore"].get<std::string>();
        std::string accountsMerkleRootAfter = input["accountsMerkleRootAfter"].get<std::string>();
        if (jDeposits.size() < numAccounts)
        {
            std::cerr << "Not enought deposits in input file: " << jDeposits.size() << std::endl;
            return 1;
        }
        // Read deposits
        std::vector<Loopring::Deposit> deposits;
        for(unsigned int i = 0; i < numAccounts; i++)
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

int withdraw(unsigned int numWithdrawals, const char* withdrawalsFilename)
{
    // Build the circuit
    ethsnarks::ProtoboardT pb;
    Loopring::WithdrawalsCircuitGadget circuit(pb, "circuit");
    circuit.generate_r1cs_constraints(numWithdrawals);
    circuit.printInfo();

#if 1
    libsnark::r1cs_gg_ppzksnark_zok_keypair<ethsnarks::ppT> keypair;
    if (withdrawalsFilename != NULL)
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
#endif

    if (withdrawalsFilename != NULL)
    {
        // Read the JSON accountsFilename
        std::ifstream file(withdrawalsFilename);
        if (!file.is_open())
        {
            std::cerr << "Cannot open input file: " << withdrawalsFilename << std::endl;
            return 1;
        }
        json input;
        file >> input;
        json jWithdrawals = input["withdrawals"];
        std::string accountsMerkleRootBefore = input["accountsMerkleRootBefore"].get<std::string>();
        std::string accountsMerkleRootAfter = input["accountsMerkleRootAfter"].get<std::string>();
        if (jWithdrawals.size() < numWithdrawals)
        {
            std::cerr << "Not enought deposits in input file: " << jWithdrawals.size() << std::endl;
            return 1;
        }
        // Read deposits
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

int cancel(unsigned int numCancels, const char* cancelsFilename)
{
    // Build the circuit
    ethsnarks::ProtoboardT pb;
    Loopring::CancelsCircuitGadget circuit(pb, "circuit");
    circuit.generate_r1cs_constraints(numCancels);
    circuit.printInfo();

#if 0
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
#endif

    if (cancelsFilename != NULL)
    {
        // Read the JSON cancelsFilename
        std::ifstream file(cancelsFilename);
        if (!file.is_open())
        {
            std::cerr << "Cannot open input file: " << cancelsFilename << std::endl;
            return 1;
        }
        json input;
        file >> input;
        json jCancels = input["cancels"];
        std::string tradingHistoryMerkleRootBefore = input["tradingHistoryMerkleRootBefore"].get<std::string>();
        std::string tradingHistoryMerkleRootAfter = input["tradingHistoryMerkleRootAfter"].get<std::string>();
        std::string accountsMerkleRoot = input["accountsMerkleRoot"].get<std::string>();
        if (jCancels.size() < numCancels)
        {
            std::cerr << "Not enought deposits in input file: " << jCancels.size() << std::endl;
            return 1;
        }
        // Read deposits
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

#if 0
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

int main (int argc, char **argv)
{
    ethsnarks::ppT::init_public_params();

    if (argc < 3)
    {
        std::cerr << "Usage: " << argv[0] << "<m> <n> <input.json>" << std::endl;
        return 1;
    }

    const unsigned int mode = atoi(argv[1]);
    switch(mode)
    {
        case 0:
        {
            const unsigned int numRings = atoi(argv[2]);
            const char* ringsFilename = NULL;
            if (argc > 2)
            {
                ringsFilename = argv[3];
            }
            return submitRings(numRings, ringsFilename);
            break;
        }
       case 1:
        {
            const unsigned int numDeposits = atoi(argv[2]);
            const char* depositsFilename = NULL;
            if (argc > 2)
            {
                depositsFilename = argv[3];
            }
            return deposit(numDeposits, depositsFilename);
            break;
        }
        case 2:
        {
            const unsigned int numWithdrawals = atoi(argv[2]);
            const char* withdrawalsFilename = NULL;
            if (argc > 2)
            {
                withdrawalsFilename = argv[3];
            }
            return withdraw(numWithdrawals, withdrawalsFilename);
            break;
        }
        case 3:
        {
            const unsigned int numCancels = atoi(argv[2]);
            const char* cancelsFilename = NULL;
            if (argc > 2)
            {
                cancelsFilename = argv[3];
            }
            return cancel(numCancels, cancelsFilename);
            break;
        }
    }
}
