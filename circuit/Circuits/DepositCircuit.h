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

    const VariableT publicKeyX_before;
    const VariableT publicKeyY_before;
    const VariableT walletID_before;
    const VariableT token_before;
    const VariableT balance_before;

    libsnark::dual_variable_gadget<FieldT> publicKeyX_after;
    libsnark::dual_variable_gadget<FieldT> publicKeyY_after;
    libsnark::dual_variable_gadget<FieldT> walletID_after;
    libsnark::dual_variable_gadget<FieldT> token_after;
    const VariableT balance_after;

    libsnark::dual_variable_gadget<FieldT> amount;

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

        merkleRootBefore(_merkleRoot),

        address(make_var_array(pb, TREE_DEPTH_ACCOUNTS, FMT(prefix, ".address"))),

        publicKeyX_before(make_variable(pb, 0, FMT(prefix, ".publicKeyX_before"))),
        publicKeyY_before(make_variable(pb, 0, FMT(prefix, ".publicKeyY_before"))),
        walletID_before(make_variable(pb, 0, FMT(prefix, ".walletID_before"))),
        token_before(make_variable(pb, 0, FMT(prefix, ".token_before"))),
        balance_before(make_variable(pb, 0, FMT(prefix, ".balance_before"))),

        publicKeyX_after(pb, 256, FMT(prefix, ".publicKeyX_after")),
        publicKeyY_after(pb, 256, FMT(prefix, ".publicKeyY_after")),
        walletID_after(pb, 16, FMT(prefix, ".walletID_after")),
        token_after(pb, 16, FMT(prefix, ".token_after")),
        balance_after(make_variable(pb, 0, FMT(prefix, ".balance_after"))),

        amount(pb, 96, FMT(prefix, ".amount")),

        leafBefore(pb, libsnark::ONE, {publicKeyX_before, publicKeyY_before, token_before, balance_before}, FMT(prefix, ".leafBefore")),
        leafAfter(pb, libsnark::ONE, {publicKeyX_after.packed, publicKeyY_after.packed, token_after.packed, balance_after}, FMT(prefix, ".leafAfter")),

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
        return {address, publicKeyX_after.bits, publicKeyY_after.bits, walletID_after.bits, token_after.bits, amount.bits};
    }

    void generate_r1cs_witness(const Deposit& deposit)
    {
        address.fill_with_bits_of_field_element(pb, deposit.address);

        pb.val(publicKeyX_before) = deposit.accountUpdate.before.publicKey.x;
        pb.val(publicKeyY_before) = deposit.accountUpdate.before.publicKey.y;
        pb.val(walletID_before) = deposit.accountUpdate.before.walletID;
        pb.val(token_before) = deposit.accountUpdate.before.token;
        pb.val(balance_before) = deposit.accountUpdate.before.balance;

        publicKeyX_after.bits.fill_with_bits_of_field_element(pb, deposit.accountUpdate.after.publicKey.x);
        publicKeyX_after.generate_r1cs_witness_from_bits();
        publicKeyY_after.bits.fill_with_bits_of_field_element(pb, deposit.accountUpdate.after.publicKey.y);
        publicKeyY_after.generate_r1cs_witness_from_bits();
        walletID_after.bits.fill_with_bits_of_field_element(pb, deposit.accountUpdate.after.walletID);
        walletID_after.generate_r1cs_witness_from_bits();
        token_after.bits.fill_with_bits_of_field_element(pb, deposit.accountUpdate.after.token);
        token_after.generate_r1cs_witness_from_bits();
        pb.val(balance_after) = deposit.accountUpdate.after.balance;

        amount.bits.fill_with_bits_of_field_element(pb, deposit.accountUpdate.after.balance - deposit.accountUpdate.before.balance);
        amount.generate_r1cs_witness_from_bits();

        leafBefore.generate_r1cs_witness();
        leafAfter.generate_r1cs_witness();

        proof.fill_with_field_elements(pb, deposit.accountUpdate.proof.data);
        proofVerifierBefore.generate_r1cs_witness();
        rootCalculatorAfter.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        publicKeyX_after.generate_r1cs_constraints(true);
        publicKeyY_after.generate_r1cs_constraints(true);
        walletID_after.generate_r1cs_constraints(true);
        token_after.generate_r1cs_constraints(true);

        amount.generate_r1cs_constraints(true);

        leafBefore.generate_r1cs_constraints();
        leafAfter.generate_r1cs_constraints();

        proofVerifierBefore.generate_r1cs_constraints();
        rootCalculatorAfter.generate_r1cs_constraints();

        pb.add_r1cs_constraint(ConstraintT(balance_before + amount.packed, 1, balance_after), "balance_before + amount == balance_after");
    }
};

class DepositsCircuitGadget : public GadgetT
{
public:

    unsigned int numAccounts;
    std::vector<DepositGadget> deposits;

    libsnark::dual_variable_gadget<FieldT> publicDataHash;
    libsnark::dual_variable_gadget<FieldT> stateID;
    libsnark::dual_variable_gadget<FieldT> accountsMerkleRootBefore;
    libsnark::dual_variable_gadget<FieldT> accountsMerkleRootAfter;

    std::vector<VariableArrayT> publicDataBits;

    libsnark::dual_variable_gadget<FieldT> depositBlockHashStart;
    std::vector<VariableArrayT> depositDataBits;
    std::vector<sha256_many> hashers;

    sha256_many* publicDataHasher;

    DepositsCircuitGadget(ProtoboardT& pb, const std::string& prefix) :
        GadgetT(pb, prefix),

        stateID(pb, 16, FMT(prefix, ".stateID")),
        accountsMerkleRootBefore(pb, 256, FMT(prefix, ".accountsMerkleRootBefore")),
        accountsMerkleRootAfter(pb, 256, FMT(prefix, ".accountsMerkleRootAfter")),

        depositBlockHashStart(pb, 256, FMT(prefix, ".depositBlockHashStart")),

        publicDataHash(pb, 256, FMT(prefix, ".publicDataHash"))
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

        stateID.generate_r1cs_constraints(true);
        accountsMerkleRootBefore.generate_r1cs_constraints(true);
        accountsMerkleRootAfter.generate_r1cs_constraints(true);

        publicDataBits.push_back(stateID.bits);
        publicDataBits.push_back(accountsMerkleRootBefore.bits);
        publicDataBits.push_back(accountsMerkleRootAfter.bits);
        for (size_t j = 0; j < numAccounts; j++)
        {
            VariableT depositAccountsMerkleRoot = (j == 0) ? accountsMerkleRootBefore.packed : deposits.back().getNewAccountsMerkleRoot();
            deposits.emplace_back(pb, depositAccountsMerkleRoot, std::string("deposits") + std::to_string(j));

            VariableArrayT depositBlockHash = (j == 0) ? depositBlockHashStart.bits : hashers.back().result().bits;

            // Hash data from deposit
            std::vector<VariableArrayT> depositData = deposits.back().getPublicData();
            std::vector<VariableArrayT> hashBits;
            hashBits.push_back(flattenReverse({depositBlockHash}));
            hashBits.insert(hashBits.end(), depositData.begin(), depositData.end());
            depositDataBits.push_back(flattenReverse(hashBits));
            hashers.emplace_back(pb, depositDataBits.back(), std::string("hash") + std::to_string(j));
            hashers.back().generate_r1cs_constraints();
        }

        publicDataHash.generate_r1cs_constraints(true);
        for (auto& deposit : deposits)
        {
            deposit.generate_r1cs_constraints();
        }

        publicDataBits.push_back(flattenReverse({hashers.back().result().bits}));

        // Check public data
        publicDataHasher = new sha256_many(pb, flattenReverse(publicDataBits), ".publicDataHash");
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

    bool generateWitness(const DepositContext& context)
    {
        stateID.bits.fill_with_bits_of_field_element(pb, context.stateID);
        stateID.generate_r1cs_witness_from_bits();

        accountsMerkleRootBefore.bits.fill_with_bits_of_field_element(pb, context.accountsMerkleRootBefore);
        accountsMerkleRootBefore.generate_r1cs_witness_from_bits();
        accountsMerkleRootAfter.bits.fill_with_bits_of_field_element(pb, context.accountsMerkleRootAfter);
        accountsMerkleRootAfter.generate_r1cs_witness_from_bits();

        depositBlockHashStart.bits.fill_with_bits_of_field_element(pb, 0);
        depositBlockHashStart.generate_r1cs_witness_from_bits();

        for(unsigned int i = 0; i < context.deposits.size(); i++)
        {
            deposits[i].generate_r1cs_witness(context.deposits[i]);
        }

        for (auto& hasher : hashers)
        {
            hasher.generate_r1cs_witness();
        }

        /*for (auto& depositDataBit : depositDataBits)
        {
            printBits("deposit data: ", depositDataBit.get_bits(pb));
        }
        printBits("Public data: ", flattenReverse(publicDataBits).get_bits(pb));*/

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

        /*for (auto& hasher : hashers)
        {
            printBits("Deposit block hash bits: ", hasher.result().bits.get_bits(pb), true);
        }*/

        return true;
    }
};

}

#endif
