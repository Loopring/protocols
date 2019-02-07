#ifndef _WITHDRAWCIRCUIT_H_
#define _WITHDRAWCIRCUIT_H_

#include "../Utils/Constants.h"
#include "../Utils/Data.h"
#include "../Utils/Utils.h"
#include "../Gadgets/AccountGadgets.h"

#include "../ThirdParty/BigInt.hpp"
#include "ethsnarks.hpp"
#include "utils.hpp"
#include "jubjub/point.hpp"
#include "jubjub/eddsa.hpp"
#include "gadgets/mimc.hpp"
#include "gadgets/merkle_tree.hpp"
#include "gadgets/sha256_many.hpp"
#include "gadgets/subadd.hpp"

using namespace ethsnarks;

namespace Loopring
{

class WithdrawalGadget : public GadgetT
{
public:
    typedef merkle_path_authenticator<MiMC_hash_gadget> MerklePathCheckT;
    typedef markle_path_compute<MiMC_hash_gadget> MerklePathT;

    const VariableT merkleRootBefore;

    const jubjub::VariablePointT publicKey;

    VariableArrayT account;
    libsnark::dual_variable_gadget<FieldT> amount;
    libsnark::dual_variable_gadget<FieldT> padding;

    VariableT walletID;
    VariableT token;
    VariableT balance_before;
    VariableT balance_after;

    UpdateAccountGadget updateAccount;

    // variables for signature
    const jubjub::VariablePointT sig_R;
    const VariableArrayT sig_s;
    const VariableArrayT sig_m;
    jubjub::PureEdDSA signatureVerifier;

    WithdrawalGadget(
        ProtoboardT& pb,
        const jubjub::Params& params,
        const VariableT& _merkleRoot,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        merkleRootBefore(_merkleRoot),

        publicKey(pb, FMT(prefix, ".publicKey")),

        account(make_var_array(pb, TREE_DEPTH_ACCOUNTS, FMT(prefix, ".account"))),
        amount(pb, 96, FMT(prefix, ".amount")),
        padding(pb, 2, FMT(prefix, ".padding")),

        walletID(make_variable(pb, FMT(prefix, ".walletID"))),
        token(make_variable(pb, FMT(prefix, ".token"))),
        balance_before(make_variable(pb, FMT(prefix, ".balance_before"))),
        balance_after(make_variable(pb, FMT(prefix, ".balance_after"))),

        updateAccount(pb, merkleRootBefore, account, publicKey, walletID, token, balance_before, balance_after, FMT(prefix, ".updateBalance")),

        sig_R(pb, FMT(prefix, ".R")),
        sig_s(make_var_array(pb, FieldT::size_in_bits(), FMT(prefix, ".s"))),
        sig_m(flatten({account, amount.bits, padding.bits})),
        signatureVerifier(pb, params, jubjub::EdwardsPoint(params.Gx, params.Gy), publicKey, sig_R, sig_s, sig_m, FMT(prefix, ".signatureVerifier"))
    {

    }

    const VariableT getNewAccountsMerkleRoot() const
    {
        return updateAccount.result();
    }

    const std::vector<VariableArrayT> getPublicData() const
    {
        return {account, amount.bits};
    }

    void generate_r1cs_witness(const Withdrawal& withdrawal)
    {
        pb.val(publicKey.x) = withdrawal.publicKey.x;
        pb.val(publicKey.y) = withdrawal.publicKey.y;

        account.fill_with_bits_of_field_element(pb, withdrawal.account);

        amount.bits.fill_with_bits_of_field_element(pb, withdrawal.amount);
        amount.generate_r1cs_witness_from_bits();

        padding.bits.fill_with_bits_of_field_element(pb, 0);
        padding.generate_r1cs_witness_from_bits();

        pb.val(walletID) = withdrawal.accountUpdate.before.walletID;
        pb.val(token) = withdrawal.accountUpdate.before.token;
        pb.val(balance_before) = withdrawal.accountUpdate.before.balance;
        pb.val(balance_after) = withdrawal.accountUpdate.after.balance;

        updateAccount.generate_r1cs_witness(withdrawal.accountUpdate.proof);

        pb.val(sig_R.x) = withdrawal.signature.R.x;
        pb.val(sig_R.y) = withdrawal.signature.R.y;
        sig_s.fill_with_bits_of_field_element(pb, withdrawal.signature.s);
        signatureVerifier.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        amount.generate_r1cs_constraints(true);
        padding.generate_r1cs_constraints(true);

        signatureVerifier.generate_r1cs_constraints();

        updateAccount.generate_r1cs_constraints();
    }
};

class WithdrawalsCircuitGadget : public GadgetT
{
public:
    jubjub::Params params;

    unsigned int numAccounts;
    std::vector<WithdrawalGadget> withdrawals;

    libsnark::dual_variable_gadget<FieldT> publicDataHash;
    libsnark::dual_variable_gadget<FieldT> accountsMerkleRootBefore;
    libsnark::dual_variable_gadget<FieldT> accountsMerkleRootAfter;

    std::vector<VariableArrayT> publicDataBits;
    VariableArrayT publicData;

    sha256_many* publicDataHasher;

    WithdrawalsCircuitGadget(ProtoboardT& pb, const std::string& prefix) :
        GadgetT(pb, prefix),

        publicDataHash(pb, 256, FMT(prefix, ".publicDataHash")),

        accountsMerkleRootBefore(pb, 256, FMT(prefix, ".accountsMerkleRootBefore")),
        accountsMerkleRootAfter(pb, 256, FMT(prefix, ".accountsMerkleRootAfter"))
    {
        this->publicDataHasher = nullptr;
    }

    ~WithdrawalsCircuitGadget()
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
            VariableT withdrawalAccountsMerkleRoot = (j == 0) ? accountsMerkleRootBefore.packed : withdrawals.back().getNewAccountsMerkleRoot();
            withdrawals.emplace_back(pb, params, withdrawalAccountsMerkleRoot, std::string("withdrawals") + std::to_string(j));

            // Store data from withdrawal
            std::vector<VariableArrayT> ringPublicData = withdrawals.back().getPublicData();
            publicDataBits.insert(publicDataBits.end(), ringPublicData.begin(), ringPublicData.end());
        }

        publicDataHash.generate_r1cs_constraints(true);
        for (auto& withdrawal : withdrawals)
        {
            withdrawal.generate_r1cs_constraints();
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
        pb.add_r1cs_constraint(ConstraintT(withdrawals.back().getNewAccountsMerkleRoot(), 1, accountsMerkleRootAfter.packed), "newMerkleRoot");
    }

    void printInfo()
    {
        std::cout << pb.num_constraints() << " constraints (" << (pb.num_constraints() / numAccounts) << "/withdrawal)" << std::endl;
    }

    bool generateWitness(const std::vector<Loopring::Withdrawal>& withdrawalsData,
                         const std::string& strAccountsMerkleRootBefore, const std::string& strAccountsMerkleRootAfter)
    {
        ethsnarks::FieldT accountsMerkleRootBeforeValue = ethsnarks::FieldT(strAccountsMerkleRootBefore.c_str());
        ethsnarks::FieldT accountsMerkleRootAfterValue = ethsnarks::FieldT(strAccountsMerkleRootAfter.c_str());
        accountsMerkleRootBefore.bits.fill_with_bits_of_field_element(pb, accountsMerkleRootBeforeValue);
        accountsMerkleRootBefore.generate_r1cs_witness_from_bits();
        accountsMerkleRootAfter.bits.fill_with_bits_of_field_element(pb, accountsMerkleRootAfterValue);
        accountsMerkleRootAfter.generate_r1cs_witness_from_bits();

        for(unsigned int i = 0; i < withdrawalsData.size(); i++)
        {
            withdrawals[i].generate_r1cs_witness(withdrawalsData[i]);
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
