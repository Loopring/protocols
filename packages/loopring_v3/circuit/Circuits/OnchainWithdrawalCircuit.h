#ifndef _ONCHAINWITHDRAWALCIRCUIT_H_
#define _ONCHAINWITHDRAWALCIRCUIT_H_

#include "../Utils/Constants.h"
#include "../Utils/Data.h"
#include "../Utils/Utils.h"
#include "../Gadgets/AccountGadgets.h"

#include "ethsnarks.hpp"
#include "utils.hpp"
#include "gadgets/merkle_tree.hpp"

using namespace ethsnarks;

namespace Loopring
{

class OnchainWithdrawalGadget : public GadgetT
{
public:
    const Constants& constants;

    VariableArrayT accountID;
    VariableArrayT tokenID;
    libsnark::dual_variable_gadget<FieldT> amountRequested;
    libsnark::dual_variable_gadget<FieldT> amountWithdrawn;

    BalanceState balanceBefore;
    AccountState accountBefore;

    MinGadget amountToWithdraw;

    BalanceState balanceAfter;
    UpdateBalanceGadget updateBalance_A;
    AccountState accountAfter;
    UpdateAccountGadget updateAccount_A;

    OnchainWithdrawalGadget(
        ProtoboardT& pb,
        const jubjub::Params& params,
        const Constants& _constants,
        const VariableT& _accountsMerkleRoot,
        const VariableArrayT& _realmID,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        constants(_constants),

        accountID(make_var_array(pb, TREE_DEPTH_ACCOUNTS, FMT(prefix, ".accountID"))),
        tokenID(make_var_array(pb, TREE_DEPTH_TOKENS, FMT(prefix, ".tokenID"))),
        amountRequested(pb, NUM_BITS_AMOUNT, FMT(prefix, ".amountRequested")),

        // User
        balanceBefore({
            make_variable(pb, FMT(prefix, ".before.balance")),
            make_variable(pb, FMT(prefix, ".before.tradingHistory"))
        }),
        accountBefore({
            make_variable(pb, FMT(prefix, ".publicKeyX")),
            make_variable(pb, FMT(prefix, ".publicKeyY")),
            make_variable(pb, FMT(prefix, ".nonce")),
            make_variable(pb, FMT(prefix, ".before.balancesRoot"))
        }),

        // Calculate how much can be withdrawn
        amountToWithdraw(pb, amountRequested.packed, balanceBefore.balance, NUM_BITS_AMOUNT, FMT(prefix, ".min(amountRequested, balance)")),
        amountWithdrawn(pb, NUM_BITS_AMOUNT, FMT(prefix, ".amountWithdrawn")),

        // Update User
        balanceAfter({
            make_variable(pb, FMT(prefix, ".after.balance")),
            balanceBefore.tradingHistory
        }),
        updateBalance_A(pb, accountBefore.balancesRoot, tokenID, balanceBefore, balanceAfter, FMT(prefix, ".updateBalance_A")),
        accountAfter({
            accountBefore.publicKeyX,
            accountBefore.publicKeyY,
            accountBefore.nonce,
            updateBalance_A.getNewRoot()
        }),
        updateAccount_A(pb, _accountsMerkleRoot, accountID, accountBefore, accountAfter, FMT(prefix, ".updateAccount_A"))
    {

    }

    const VariableT getNewAccountsRoot() const
    {
        return updateAccount_A.result();
    }

    const std::vector<VariableArrayT> getOnchainData() const
    {
        return {constants.accountPadding, accountID,
                constants.tokenPadding, tokenID,
                amountRequested.bits};
    }

    const std::vector<VariableArrayT> getApprovedWithdrawalData() const
    {
        return {constants.accountPadding, accountID,
                constants.tokenPadding, tokenID,
                amountWithdrawn.bits};
    }

    void generate_r1cs_witness(const OnchainWithdrawal& withdrawal)
    {
        accountID.fill_with_bits_of_field_element(pb, withdrawal.accountUpdate.accountID);
        tokenID.fill_with_bits_of_field_element(pb, withdrawal.balanceUpdate.tokenID);
        amountRequested.bits.fill_with_bits_of_field_element(pb, withdrawal.amountRequested);
        amountRequested.generate_r1cs_witness_from_bits();

        // Balance
        pb.val(balanceBefore.tradingHistory) = withdrawal.balanceUpdate.before.tradingHistoryRoot;
        pb.val(balanceBefore.balance) = withdrawal.balanceUpdate.before.balance;
        pb.val(balanceAfter.balance) = withdrawal.balanceUpdate.after.balance;

        // Account
        pb.val(accountBefore.publicKeyX) = withdrawal.accountUpdate.before.publicKey.x;
        pb.val(accountBefore.publicKeyY) = withdrawal.accountUpdate.before.publicKey.y;
        pb.val(accountBefore.nonce) = withdrawal.accountUpdate.before.nonce;
        pb.val(accountBefore.balancesRoot) = withdrawal.accountUpdate.before.balancesRoot;

        // Withdrawal calculations
        amountToWithdraw.generate_r1cs_witness();
        amountWithdrawn.bits.fill_with_bits_of_field_element(pb, (pb.val(balanceBefore.balance) - pb.val(balanceAfter.balance)));
        amountWithdrawn.generate_r1cs_witness_from_bits();

        // Update User
        updateBalance_A.generate_r1cs_witness(withdrawal.balanceUpdate.proof);
        updateAccount_A.generate_r1cs_witness(withdrawal.accountUpdate.proof);
    }

    void generate_r1cs_constraints()
    {
        amountRequested.generate_r1cs_constraints(true);
        amountWithdrawn.generate_r1cs_constraints(true);

        amountToWithdraw.generate_r1cs_constraints();
        pb.add_r1cs_constraint(ConstraintT(balanceBefore.balance, 1, balanceAfter.balance + amountToWithdraw.result()), "balance_before == balance_after + amountToWithdraw");

        updateBalance_A.generate_r1cs_constraints();
        updateAccount_A.generate_r1cs_constraints();
    }
};

class OnchainWithdrawalCircuit : public GadgetT
{
public:
    jubjub::Params params;

    bool onchainDataAvailability;
    unsigned int numWithdrawals;
    std::vector<OnchainWithdrawalGadget> withdrawals;

    libsnark::dual_variable_gadget<FieldT> publicDataHash;
    PublicDataGadget publicData;

    Constants constants;

    libsnark::dual_variable_gadget<FieldT> realmID;
    libsnark::dual_variable_gadget<FieldT> merkleRootBefore;
    libsnark::dual_variable_gadget<FieldT> merkleRootAfter;

    VariableArrayT withdrawalBlockHashStart;
    libsnark::dual_variable_gadget<FieldT> startIndex;
    libsnark::dual_variable_gadget<FieldT> count;

    std::vector<sha256_many> hashers;

    OnchainWithdrawalCircuit(ProtoboardT& pb, const std::string& prefix) :
        GadgetT(pb, prefix),

        publicDataHash(pb, 256, FMT(prefix, ".publicDataHash")),
        publicData(pb, publicDataHash, FMT(prefix, ".publicData")),

        constants(pb, FMT(prefix, ".constants")),

        realmID(pb, 32, FMT(prefix, ".realmID")),
        merkleRootBefore(pb, 256, FMT(prefix, ".merkleRootBefore")),
        merkleRootAfter(pb, 256, FMT(prefix, ".merkleRootAfter")),

        withdrawalBlockHashStart(make_var_array(pb, 256, FMT(prefix, ".withdrawalBlockHashStart"))),
        startIndex(pb, 32, FMT(prefix, ".startIndex")),
        count(pb, 32, FMT(prefix, ".count"))
    {

    }

    ~OnchainWithdrawalCircuit()
    {

    }

    void generate_r1cs_constraints(bool onchainDataAvailability, int numWithdrawals)
    {
        this->onchainDataAvailability = onchainDataAvailability;
        this->numWithdrawals = numWithdrawals;

        pb.set_input_sizes(1);

        constants.generate_r1cs_witness();

        realmID.generate_r1cs_constraints(true);
        merkleRootBefore.generate_r1cs_constraints(true);
        merkleRootAfter.generate_r1cs_constraints(true);

        publicData.add(realmID.bits);
        publicData.add(merkleRootBefore.bits);
        publicData.add(merkleRootAfter.bits);
        for (size_t j = 0; j < numWithdrawals; j++)
        {
            VariableT withdrawalAccountsRoot = (j == 0) ? merkleRootBefore.packed : withdrawals.back().getNewAccountsRoot();
            withdrawals.emplace_back(
                pb,
                params,
                constants,
                withdrawalAccountsRoot,
                realmID.bits,
                std::string("withdrawals_") + std::to_string(j)
            );
            withdrawals.back().generate_r1cs_constraints();

            VariableArrayT withdrawalBlockHash = (j == 0) ? withdrawalBlockHashStart : hashers.back().result().bits;

            // Hash data from withdrawal request
            std::vector<VariableArrayT> withdrawalRequestData = withdrawals.back().getOnchainData();
            std::vector<VariableArrayT> hash;
            hash.push_back(flattenReverse({withdrawalBlockHash}));
            hash.insert(hash.end(), withdrawalRequestData.begin(), withdrawalRequestData.end());
            hashers.emplace_back(pb, flattenReverse(hash), std::string("hash_") + std::to_string(j));
            hashers.back().generate_r1cs_constraints();
        }

        // Add the ending hash
        publicData.add(flattenReverse({withdrawalBlockHashStart}));
        publicData.add(flattenReverse({hashers.back().result().bits}));
        publicData.add(startIndex.bits);
        publicData.add(count.bits);

        // Store the approved data for all withdrawals
        for (auto& withdrawal : withdrawals)
        {
            publicData.add(withdrawal.getApprovedWithdrawalData());
        }

        // Check the input hash
        publicDataHash.generate_r1cs_constraints(true);
        publicData.generate_r1cs_constraints();

        // Check the new merkle root
        forceEqual(pb, withdrawals.back().getNewAccountsRoot(), merkleRootAfter.packed, "newMerkleRoot");
    }

    void printInfo()
    {
        std::cout << pb.num_constraints() << " constraints (" << (pb.num_constraints() / numWithdrawals) << "/onchain withdrawal)" << std::endl;
    }

    bool generateWitness(const OnchainWithdrawalBlock& block)
    {
        constants.generate_r1cs_witness();

        realmID.bits.fill_with_bits_of_field_element(pb, block.realmID);
        realmID.generate_r1cs_witness_from_bits();

        merkleRootBefore.bits.fill_with_bits_of_field_element(pb, block.merkleRootBefore);
        merkleRootBefore.generate_r1cs_witness_from_bits();
        merkleRootAfter.bits.fill_with_bits_of_field_element(pb, block.merkleRootAfter);
        merkleRootAfter.generate_r1cs_witness_from_bits();

        // Store the starting hash
        for (unsigned int i = 0; i < 256; i++)
        {
            pb.val(withdrawalBlockHashStart[255 - i]) = block.startHash.test_bit(i);
        }
        // printBits("start hash input: 0x", depositBlockHashStart.get_bits(pb), true);
        startIndex.bits.fill_with_bits_of_field_element(pb, block.startIndex);
        startIndex.generate_r1cs_witness_from_bits();
        count.bits.fill_with_bits_of_field_element(pb, block.count);
        count.generate_r1cs_witness_from_bits();

        // All withdrawals
        for(unsigned int i = 0; i < block.withdrawals.size(); i++)
        {
            withdrawals[i].generate_r1cs_witness(block.withdrawals[i]);
        }

        // All hashes
        for (auto& hasher : hashers)
        {
            hasher.generate_r1cs_witness();
        }
        printBits("WithdrawBlockHash: 0x", flattenReverse({hashers.back().result().bits}).get_bits(pb), true);

        // Public data
        publicData.generate_r1cs_witness();

        return true;
    }
};

}

#endif
