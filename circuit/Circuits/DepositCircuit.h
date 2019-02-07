#ifndef _DEPOSITCIRCUIT_H_
#define _DEPOSITCIRCUIT_H_

#include "../Utils/Constants.h"
#include "../Utils/Data.h"

#include "../ThirdParty/BigInt.hpp"
#include "ethsnarks.hpp"
#include "utils.hpp"
#include "jubjub/point.hpp"
#include "jubjub/eddsa.hpp"
#include "gadgets/sha256_many.hpp"

using namespace ethsnarks;

namespace Loopring
{

class DepositGadget : public GadgetT
{
public:
    typedef merkle_path_authenticator<MiMC_hash_gadget> MerklePathCheckT;
    typedef markle_path_compute<MiMC_hash_gadget> MerklePathT;

    const VariableT merkleRootBefore;

    VariableArrayT address;

    const VariableT emptyPublicKeyX;
    const VariableT emptyPublicKeyY;
    const VariableT emptyDex;
    const VariableT emptyToken;
    const VariableT emptyBalance;

    libsnark::dual_variable_gadget<FieldT> publicKeyX;
    libsnark::dual_variable_gadget<FieldT> publicKeyY;
    libsnark::dual_variable_gadget<FieldT> dex;
    libsnark::dual_variable_gadget<FieldT> token;
    libsnark::dual_variable_gadget<FieldT> balance;

    MiMC_hash_gadget leafBefore;
    MiMC_hash_gadget leafAfter;

    const VariableArrayT proof;
    MerklePathCheckT proofVerifierBefore;
    MerklePathT rootCalculatorAfter;

    DepositGadget(
        ProtoboardT& pb,
        const VariableT& _merkleRoot,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        address(make_var_array(pb, TREE_DEPTH_ACCOUNTS, FMT(prefix, ".address"))),

        emptyPublicKeyX(make_variable(pb, 0, FMT(prefix, ".emptyPublicKeyX"))),
        emptyPublicKeyY(make_variable(pb, 0, FMT(prefix, ".emptyPublicKeyY"))),
        emptyDex(make_variable(pb, 0, FMT(prefix, ".emptyDex"))),
        emptyToken(make_variable(pb, 0, FMT(prefix, ".emptyToken"))),
        emptyBalance(make_variable(pb, 0, FMT(prefix, ".emptyBalance"))),

        publicKeyX(pb, 256, FMT(prefix, ".publicKeyX")),
        publicKeyY(pb, 256, FMT(prefix, ".publicKeyY")),
        dex(pb, 16, FMT(prefix, ".dex")),
        token(pb, 16, FMT(prefix, ".token")),
        balance(pb, 96, FMT(prefix, ".balance")),

        merkleRootBefore(_merkleRoot),

        leafBefore(pb, libsnark::ONE, {emptyPublicKeyX, emptyPublicKeyY, emptyToken, emptyBalance}, FMT(prefix, ".leafBefore")),
        leafAfter(pb, libsnark::ONE, {publicKeyX.packed, publicKeyY.packed, token.packed, balance.packed}, FMT(prefix, ".leafAfter")),

        proof(make_var_array(pb, TREE_DEPTH_ACCOUNTS, FMT(prefix, ".proof"))),
        proofVerifierBefore(pb, TREE_DEPTH_ACCOUNTS, address, merkle_tree_IVs(pb), leafBefore.result(), merkleRootBefore, proof, FMT(prefix, ".pathBefore")),
        rootCalculatorAfter(pb, TREE_DEPTH_ACCOUNTS, address, merkle_tree_IVs(pb), leafAfter.result(), proof, FMT(prefix, ".pathAfter"))
    {

    }

    const VariableT getNewAccountsMerkleRoot() const
    {
        return rootCalculatorAfter.result();
    }

    const std::vector<VariableArrayT> getPublicData() const
    {
        return {publicKeyX.bits, publicKeyY.bits, dex.bits, token.bits, balance.bits};
    }

    void generate_r1cs_witness(const Deposit& deposit)
    {
        address.fill_with_bits_of_field_element(pb, deposit.address);

        publicKeyX.bits.fill_with_bits_of_field_element(pb, deposit.accountUpdate.after.publicKey.x);
        publicKeyX.generate_r1cs_witness_from_bits();
        publicKeyY.bits.fill_with_bits_of_field_element(pb, deposit.accountUpdate.after.publicKey.y);
        publicKeyY.generate_r1cs_witness_from_bits();
        dex.bits.fill_with_bits_of_field_element(pb, deposit.accountUpdate.after.walletID);
        dex.generate_r1cs_witness_from_bits();
        token.bits.fill_with_bits_of_field_element(pb, deposit.accountUpdate.after.token);
        token.generate_r1cs_witness_from_bits();
        balance.bits.fill_with_bits_of_field_element(pb, deposit.accountUpdate.after.balance);
        balance.generate_r1cs_witness_from_bits();

        leafBefore.generate_r1cs_witness();
        leafAfter.generate_r1cs_witness();

        proof.fill_with_field_elements(pb, deposit.accountUpdate.proof.data);
        proofVerifierBefore.generate_r1cs_witness();
        rootCalculatorAfter.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        // Force constants
        pb.add_r1cs_constraint(ConstraintT(emptyPublicKeyX, 1, 0), "emptyPublicKeyX == 0");
        pb.add_r1cs_constraint(ConstraintT(emptyPublicKeyY, 1, 0), "emptyPublicKeyY == 0");
        pb.add_r1cs_constraint(ConstraintT(emptyDex, 1, 0), "emptyDex == 0");
        pb.add_r1cs_constraint(ConstraintT(emptyToken, 1, 0), "emptyToken == 0");
        pb.add_r1cs_constraint(ConstraintT(emptyBalance, 1, 0), "emptyBalance == 0");

        publicKeyX.generate_r1cs_constraints(true);
        publicKeyY.generate_r1cs_constraints(true);
        dex.generate_r1cs_constraints(true);
        token.generate_r1cs_constraints(true);
        balance.generate_r1cs_constraints(true);

        leafBefore.generate_r1cs_constraints();
        leafAfter.generate_r1cs_constraints();

        proofVerifierBefore.generate_r1cs_constraints();
        rootCalculatorAfter.generate_r1cs_constraints();
    }
};

class DepositsCircuitGadget : public GadgetT
{
public:

    unsigned int numAccounts;
    std::vector<DepositGadget> deposits;

    libsnark::dual_variable_gadget<FieldT> publicDataHash;
    libsnark::dual_variable_gadget<FieldT> accountsMerkleRootBefore;
    libsnark::dual_variable_gadget<FieldT> accountsMerkleRootAfter;

    std::vector<VariableArrayT> publicDataBits;
    VariableArrayT publicData;

    sha256_many* publicDataHasher;

    DepositsCircuitGadget(ProtoboardT& pb, const std::string& prefix) :
        GadgetT(pb, prefix),

        publicDataHash(pb, 256, FMT(prefix, ".publicDataHash")),

        accountsMerkleRootBefore(pb, 256, FMT(prefix, ".accountsMerkleRootBefore")),
        accountsMerkleRootAfter(pb, 256, FMT(prefix, ".accountsMerkleRootAfter"))
    {
        this->publicDataHasher = nullptr;
    }

    ~DepositsCircuitGadget()
    {
        if (publicDataHasher)
        {
            delete publicDataHasher;
        }
    }

    void generate_r1cs_constraints(int numAccounts)
    {
        this->numAccounts = numAccounts;

        pb.set_input_sizes(1);
        accountsMerkleRootBefore.generate_r1cs_constraints(true);
        publicDataBits.push_back(accountsMerkleRootBefore.bits);
        publicDataBits.push_back(accountsMerkleRootAfter.bits);
        for (size_t j = 0; j < numAccounts; j++)
        {
            VariableT depositAccountsMerkleRoot = (j == 0) ? accountsMerkleRootBefore.packed : deposits.back().getNewAccountsMerkleRoot();
            deposits.emplace_back(pb, depositAccountsMerkleRoot, std::string("deposits") + std::to_string(j));

            // Store data from deposit
            //std::vector<VariableArrayT> ringPublicData = deposits.back().getPublicData();
            //publicDataBits.insert(publicDataBits.end(), ringPublicData.begin(), ringPublicData.end());
        }

        publicDataHash.generate_r1cs_constraints(true);
        for (auto& deposit : deposits)
        {
            deposit.generate_r1cs_constraints();
        }

        // Check public data
        publicData = flattenReverse(publicDataBits);
        publicDataHasher = new sha256_many(pb, publicData, ".publicDataHash");
        publicDataHasher->generate_r1cs_constraints();

        // Check that the hash matches the public input
        for (unsigned int i = 0; i < 256; i++)
        {
            pb.add_r1cs_constraint(ConstraintT(publicDataHasher->result().bits[255-i], 1, publicDataHash.bits[i]), "publicData.check()");
        }

        // Make sure the merkle root afterwards is correctly passed in
        pb.add_r1cs_constraint(ConstraintT(deposits.back().getNewAccountsMerkleRoot(), 1, accountsMerkleRootAfter.packed), "newMerkleRoot");
    }

    void printInfo()
    {
        std::cout << pb.num_constraints() << " constraints (" << (pb.num_constraints() / numAccounts) << "/deposit)" << std::endl;
    }

    bool generateWitness(const std::vector<Loopring::Deposit>& depositsData,
                         const std::string& strAccountsMerkleRootBefore, const std::string& strAccountsMerkleRootAfter)
    {
        ethsnarks::FieldT accountsMerkleRootBeforeValue = ethsnarks::FieldT(strAccountsMerkleRootBefore.c_str());
        ethsnarks::FieldT accountsMerkleRootAfterValue = ethsnarks::FieldT(strAccountsMerkleRootAfter.c_str());
        accountsMerkleRootBefore.bits.fill_with_bits_of_field_element(pb, accountsMerkleRootBeforeValue);
        accountsMerkleRootBefore.generate_r1cs_witness_from_bits();
        accountsMerkleRootAfter.bits.fill_with_bits_of_field_element(pb, accountsMerkleRootAfterValue);
        accountsMerkleRootAfter.generate_r1cs_witness_from_bits();

        for(unsigned int i = 0; i < depositsData.size(); i++)
        {
            deposits[i].generate_r1cs_witness(depositsData[i]);
        }

        publicDataHasher->generate_r1cs_witness();

        // Print out calculated hash of transfer data
        auto full_output_bits = publicDataHasher->result().get_digest();
        //printBits("HashC: ", full_output_bits);
        BigInt publicDataHashDec = 0;
        for (unsigned int i = 0; i < full_output_bits.size(); i++)
        {
            publicDataHashDec = publicDataHashDec * 2 + (full_output_bits[i] ? 1 : 0);
        }
        //std::cout << "publicDataHashDec: " << publicDataHashDec.to_string() << std::endl;
        libff::bigint<libff::alt_bn128_r_limbs> bn = libff::bigint<libff::alt_bn128_r_limbs>(publicDataHashDec.to_string().c_str());
        for (unsigned int i = 0; i < 256; i++)
        {
            pb.val(publicDataHash.bits[i]) = bn.test_bit(i);
        }
        publicDataHash.generate_r1cs_witness_from_bits();
        //printBits("publicData: ", publicData.get_bits(pb));

        //printBits("Public data bits: ", publicDataHash.bits.get_bits(pb));
        //printBits("Hash bits: ", publicDataHasher->result().bits.get_bits(pb), true);

        return true;
    }
};

}

#endif
