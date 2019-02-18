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

    VariableArrayT uint16_padding;

    const jubjub::VariablePointT publicKey;
    VariableArrayT accountID;
    VariableArrayT tokenID;
    libsnark::dual_variable_gadget<FieldT> amountRequested;
    libsnark::dual_variable_gadget<FieldT> amountWithdrawn;
    libsnark::dual_variable_gadget<FieldT> padding;

    VariableT walletID;
    VariableT balance_before;
    VariableT balance_after;
    VariableT nonce_before;
    VariableT nonce_after;

    VariableT tradingHistoryRoot;
    VariableT balancesRoot_before;

    MinGadget amountToWithdraw;

    UpdateBalanceGadget updateBalance;
    UpdateAccountGadget updateAccount;

    SignatureVerifier signatureVerifier;

    WithdrawalGadget(
        ProtoboardT& pb,
        const jubjub::Params& params,
        const VariableT& root,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        uint16_padding(make_var_array(pb, 16 - NUM_BITS_WALLETID, FMT(prefix, ".uint16_padding"))),

        publicKey(pb, FMT(prefix, ".publicKey")),

        accountID(make_var_array(pb, TREE_DEPTH_ACCOUNTS, FMT(prefix, ".accountID"))),
        tokenID(make_var_array(pb, TREE_DEPTH_BALANCES, FMT(prefix, ".tokenID"))),
        amountRequested(pb, 96, FMT(prefix, ".amountRequested")),
        padding(pb, 2, FMT(prefix, ".padding")),

        walletID(make_variable(pb, FMT(prefix, ".walletID"))),
        balance_before(make_variable(pb, FMT(prefix, ".balance_before"))),
        balance_after(make_variable(pb, FMT(prefix, ".balance_after"))),
        nonce_before(make_variable(pb, FMT(prefix, ".nonce_before"))),
        nonce_after(make_variable(pb, FMT(prefix, ".nonce_after"))),

        balancesRoot_before(make_variable(pb, FMT(prefix, ".balancesRoot_before"))),
        tradingHistoryRoot(make_variable(pb, FMT(prefix, ".tradeHistoryRoot"))),

        amountToWithdraw(pb, amountRequested.packed, balance_before, FMT(prefix, ".min(amountRequested, balance)")),
        amountWithdrawn(pb, 96, FMT(prefix, ".amount")),

        updateBalance(pb, balancesRoot_before, tokenID,
                      {balance_before, tradingHistoryRoot},
                      {balance_after, tradingHistoryRoot},
                      FMT(prefix, ".updateBalance")),

        updateAccount(pb, root, accountID,
                      {publicKey.x, publicKey.y, walletID, nonce_before, balancesRoot_before},
                      {publicKey.x, publicKey.y, walletID, nonce_after, updateBalance.getNewRoot()},
                      FMT(prefix, ".updateAccount")),

        signatureVerifier(pb, params, publicKey,
                          flatten({accountID, tokenID, amountRequested.bits, padding.bits}),
                          FMT(prefix, ".signatureVerifier"))
    {

    }

    const VariableT getNewAccountsRoot() const
    {
        return updateAccount.result();
    }

    const std::vector<VariableArrayT> getPublicData() const
    {
        return {accountID, uint16_padding, tokenID, amountWithdrawn.bits};
    }

    void generate_r1cs_witness(const Withdrawal& withdrawal)
    {
        pb.val(publicKey.x) = withdrawal.publicKey.x;
        pb.val(publicKey.y) = withdrawal.publicKey.y;

        accountID.fill_with_bits_of_field_element(pb, withdrawal.accountID);
        tokenID.fill_with_bits_of_field_element(pb, withdrawal.tokenID);

        amountRequested.bits.fill_with_bits_of_field_element(pb, withdrawal.amount);
        amountRequested.generate_r1cs_witness_from_bits();

        padding.bits.fill_with_bits_of_field_element(pb, 0);
        padding.generate_r1cs_witness_from_bits();

        pb.val(walletID) = withdrawal.accountUpdate.before.walletID;
        pb.val(balance_before) = withdrawal.balanceUpdate.before.balance;
        pb.val(balance_after) = withdrawal.balanceUpdate.after.balance;
        pb.val(nonce_before) = withdrawal.accountUpdate.before.nonce;
        pb.val(nonce_after) = withdrawal.accountUpdate.after.nonce;

        pb.val(tradingHistoryRoot) = withdrawal.balanceUpdate.before.tradingHistoryRoot;
        pb.val(balancesRoot_before) = withdrawal.accountUpdate.before.balancesRoot;

        amountToWithdraw.generate_r1cs_witness();

        amountWithdrawn.bits.fill_with_bits_of_field_element(pb, pb.val(balance_before) - pb.val(balance_after));
        amountWithdrawn.generate_r1cs_witness_from_bits();

        updateBalance.generate_r1cs_witness(withdrawal.balanceUpdate.proof);
        updateAccount.generate_r1cs_witness(withdrawal.accountUpdate.proof);

        signatureVerifier.generate_r1cs_witness(withdrawal.signature);
    }

    void generate_r1cs_constraints()
    {
        amountRequested.generate_r1cs_constraints(true);
        amountWithdrawn.generate_r1cs_constraints(true);
        padding.generate_r1cs_constraints(true);

        signatureVerifier.generate_r1cs_constraints();

        amountToWithdraw.generate_r1cs_constraints();
        pb.add_r1cs_constraint(ConstraintT(amountToWithdraw.result(), 1, amountWithdrawn.packed), "amountToWithdraw == amountWithdrawn");
        pb.add_r1cs_constraint(ConstraintT(balance_before - amountWithdrawn.packed, 1, balance_after), "balance_before - amount == balance_after");

        updateBalance.generate_r1cs_constraints();
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
    libsnark::dual_variable_gadget<FieldT> stateID;
    libsnark::dual_variable_gadget<FieldT> merkleRootBefore;
    libsnark::dual_variable_gadget<FieldT> merkleRootAfter;

    std::vector<VariableArrayT> publicDataBits;
    VariableArrayT publicData;

    sha256_many* publicDataHasher;

    MiMC_hash_gadget* hashRootsBefore;
    MiMC_hash_gadget* hashRootsAfter;

    const VariableT accountsRootBefore;
    const VariableT feesRoot;

    WithdrawalsCircuitGadget(ProtoboardT& pb, const std::string& prefix) :
        GadgetT(pb, prefix),

        publicDataHash(pb, 256, FMT(prefix, ".publicDataHash")),

        stateID(pb, 16, FMT(prefix, ".stateID")),
        merkleRootBefore(pb, 256, FMT(prefix, ".merkleRootBefore")),
        merkleRootAfter(pb, 256, FMT(prefix, ".merkleRootAfter")),

        accountsRootBefore(make_variable(pb, FMT(prefix, ".accountsRootBefore"))),
        feesRoot(make_variable(pb, FMT(prefix, ".feesRoot")))
    {
        this->publicDataHasher = nullptr;
    }

    ~WithdrawalsCircuitGadget()
    {
        if (hashRootsBefore)
        {
            delete hashRootsBefore;
        }
        if (hashRootsAfter)
        {
            delete hashRootsAfter;
        }
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
        merkleRootBefore.generate_r1cs_constraints(true);
        merkleRootAfter.generate_r1cs_constraints(true);

        publicDataBits.push_back(stateID.bits);
        publicDataBits.push_back(merkleRootBefore.bits);
        publicDataBits.push_back(merkleRootAfter.bits);
        for (size_t j = 0; j < numAccounts; j++)
        {
            VariableT withdrawalAccountsRoot = (j == 0) ? accountsRootBefore : withdrawals.back().getNewAccountsRoot();
            withdrawals.emplace_back(pb, params, withdrawalAccountsRoot, std::string("withdrawals") + std::to_string(j));

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

        hashRootsBefore = new MiMC_hash_gadget(pb, libsnark::ONE, {accountsRootBefore, feesRoot}, FMT(annotation_prefix, ".rootBefore"));
        hashRootsBefore->generate_r1cs_constraints();
        hashRootsAfter = new MiMC_hash_gadget(pb, libsnark::ONE, {withdrawals.back().getNewAccountsRoot(), feesRoot}, FMT(annotation_prefix, ".rootAfter"));
        hashRootsAfter->generate_r1cs_constraints();

        // Make sure the merkle roots are correctly passed in
        pb.add_r1cs_constraint(ConstraintT(hashRootsBefore->result(), 1, merkleRootBefore.packed), "oldMerkleRoot");
        pb.add_r1cs_constraint(ConstraintT(hashRootsAfter->result(), 1, merkleRootAfter.packed), "newMerkleRoot");
    }

    void printInfo()
    {
        std::cout << pb.num_constraints() << " constraints (" << (pb.num_constraints() / numAccounts) << "/withdrawal)" << std::endl;
    }

    bool generateWitness(const WithdrawContext& context)
    {
        stateID.bits.fill_with_bits_of_field_element(pb, context.stateID);
        stateID.generate_r1cs_witness_from_bits();

        merkleRootBefore.bits.fill_with_bits_of_field_element(pb, context.merkleRootBefore);
        merkleRootBefore.generate_r1cs_witness_from_bits();
        merkleRootAfter.bits.fill_with_bits_of_field_element(pb, context.merkleRootAfter);
        merkleRootAfter.generate_r1cs_witness_from_bits();

        pb.val(accountsRootBefore) = context.withdrawals[0].accountUpdate.rootBefore;
        pb.val(feesRoot) = context.feesRoot;

        for(unsigned int i = 0; i < context.withdrawals.size(); i++)
        {
            withdrawals[i].generate_r1cs_witness(context.withdrawals[i]);
        }

        publicDataHasher->generate_r1cs_witness();

        hashRootsBefore->generate_r1cs_witness();
        hashRootsAfter->generate_r1cs_witness();

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
