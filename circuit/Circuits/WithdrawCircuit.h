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

    bool onchain;

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
        bool _onchain,
        const VariableT& root,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        onchain(_onchain),

        uint16_padding(make_var_array(pb, 16 - NUM_BITS_TOKENID, FMT(prefix, ".uint16_padding"))),

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

    const std::vector<VariableArrayT> getOnchainData() const
    {
        return {accountID, uint16_padding, tokenID, amountRequested.bits};
    }

    void generate_r1cs_witness(const Withdrawal& withdrawal)
    {
        uint16_padding.fill_with_bits_of_ulong(pb, 0);

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

        if (!onchain)
        {
            signatureVerifier.generate_r1cs_witness(withdrawal.signature);
        }
    }

    void generate_r1cs_constraints()
    {
        amountRequested.generate_r1cs_constraints(true);
        amountWithdrawn.generate_r1cs_constraints(true);
        padding.generate_r1cs_constraints(true);

        amountToWithdraw.generate_r1cs_constraints();
        pb.add_r1cs_constraint(ConstraintT(amountToWithdraw.result(), 1, amountWithdrawn.packed), "amountToWithdraw == amountWithdrawn");
        pb.add_r1cs_constraint(ConstraintT(balance_before - amountWithdrawn.packed, 1, balance_after), "balance_before - amount == balance_after");

        updateBalance.generate_r1cs_constraints();
        updateAccount.generate_r1cs_constraints();

        if (!onchain)
        {
            signatureVerifier.generate_r1cs_constraints();
        }
    }
};

class WithdrawalsCircuitGadget : public GadgetT
{
public:
    jubjub::Params params;

    unsigned int numAccounts;
    bool onchain;
    std::vector<WithdrawalGadget> withdrawals;

    libsnark::dual_variable_gadget<FieldT> publicDataHash;
    PublicDataGadget publicData;

    libsnark::dual_variable_gadget<FieldT> stateID;
    libsnark::dual_variable_gadget<FieldT> merkleRootBefore;
    libsnark::dual_variable_gadget<FieldT> merkleRootAfter;

    libsnark::dual_variable_gadget<FieldT> withdrawalBlockHashStart;
    std::vector<VariableArrayT> withdrawalDataBits;
    std::vector<sha256_many> hashers;

    const VariableT accountsRootBefore;
    const VariableT feesRoot;

    MerkleRootGadget merkleRootGadget;

    WithdrawalsCircuitGadget(ProtoboardT& pb, bool _onchain, const std::string& prefix) :
        GadgetT(pb, prefix),

        onchain(_onchain),

        publicDataHash(pb, 256, FMT(prefix, ".publicDataHash")),
        publicData(pb, publicDataHash, FMT(prefix, ".publicData")),

        stateID(pb, 16, FMT(prefix, ".stateID")),
        merkleRootBefore(pb, 256, FMT(prefix, ".merkleRootBefore")),
        merkleRootAfter(pb, 256, FMT(prefix, ".merkleRootAfter")),

        withdrawalBlockHashStart(pb, 256, FMT(prefix, ".withdrawalBlockHashStart")),

        accountsRootBefore(make_variable(pb, FMT(prefix, ".accountsRootBefore"))),
        feesRoot(make_variable(pb, FMT(prefix, ".feesRoot"))),

        merkleRootGadget(pb, merkleRootBefore.packed, merkleRootAfter.packed,
                         accountsRootBefore, feesRoot,
                         FMT(prefix, ".merkleRootGadget"))
    {

    }

    ~WithdrawalsCircuitGadget()
    {

    }

    void generate_r1cs_constraints(int numAccounts)
    {
        this->numAccounts = numAccounts;

        pb.set_input_sizes(1);

        stateID.generate_r1cs_constraints(true);
        merkleRootBefore.generate_r1cs_constraints(true);
        merkleRootAfter.generate_r1cs_constraints(true);

        publicData.add(stateID.bits);
        publicData.add(merkleRootBefore.bits);
        publicData.add(merkleRootAfter.bits);
        for (size_t j = 0; j < numAccounts; j++)
        {
            VariableT withdrawalAccountsRoot = (j == 0) ? accountsRootBefore : withdrawals.back().getNewAccountsRoot();
            withdrawals.emplace_back(pb, params, onchain, withdrawalAccountsRoot, std::string("withdrawals") + std::to_string(j));
            withdrawals.back().generate_r1cs_constraints();

            if (onchain)
            {
                VariableArrayT withdrawalBlockHash = (j == 0) ? withdrawalBlockHashStart.bits : hashers.back().result().bits;

                // Hash data from deposit
                std::vector<VariableArrayT> withdrawalData = withdrawals.back().getOnchainData();
                std::vector<VariableArrayT> hashBits;
                hashBits.push_back(flattenReverse({withdrawalBlockHash}));
                hashBits.insert(hashBits.end(), withdrawalData.begin(), withdrawalData.end());
                withdrawalDataBits.push_back(flattenReverse(hashBits));
                hashers.emplace_back(pb, withdrawalDataBits.back(), std::string("hash_") + std::to_string(j));
                hashers.back().generate_r1cs_constraints();
            }
        }

        if (onchain)
        {
             // Add the block hash
            publicData.add(flattenReverse({hashers.back().result().bits}));
        }
        else
        {
            publicData.add(withdrawalBlockHashStart.bits);
        }

        for (auto& withdrawal : withdrawals)
        {
            // Store data from withdrawal
            publicData.add(withdrawal.getPublicData());
        }

        // Check the input hash
        publicDataHash.generate_r1cs_constraints(true);
        publicData.generate_r1cs_constraints();

        // Check the merkle roots
        merkleRootGadget.generate_r1cs_constraints(withdrawals.back().getNewAccountsRoot(), feesRoot);
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

        pb.val(accountsRootBefore) = context.accountsRootBefore;
        pb.val(feesRoot) = context.feesRoot;

        withdrawalBlockHashStart.bits.fill_with_bits_of_field_element(pb, 0);
        withdrawalBlockHashStart.generate_r1cs_witness_from_bits();

        for(unsigned int i = 0; i < context.withdrawals.size(); i++)
        {
            withdrawals[i].generate_r1cs_witness(context.withdrawals[i]);
        }

        if (onchain)
        {
            for (auto& hasher : hashers)
            {
                hasher.generate_r1cs_witness();
            }
            printBits("WithdrawBlockHash: 0x", flattenReverse({hashers.back().result().bits}).get_bits(pb), true);
        }

        publicData.generate_r1cs_witness();

        merkleRootGadget.generate_r1cs_witness();

        return true;
    }
};

}

#endif
