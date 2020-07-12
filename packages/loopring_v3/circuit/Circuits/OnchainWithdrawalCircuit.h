#ifndef _ONCHAINWITHDRAWALCIRCUIT_H_
#define _ONCHAINWITHDRAWALCIRCUIT_H_

#include "Circuit.h"
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

    // User state
    BalanceGadget balanceBefore;
    AccountGadget accountBefore;

    // Inputs
    DualVariableGadget accountID;
    DualVariableGadget tokenID;
    DualVariableGadget amountRequested;

    // Calculate how much can be withdrawn
    MinGadget amountToWithdrawMin;
    TernaryGadget amountToWithdraw;
    // Float
    FloatGadget amountWithdrawn;
    RequireAccuracyGadget requireAccuracyAmountWithdrawn;

    // Shutdown mode
    TernaryGadget amountToSubtract;
    TernaryGadget tradingHistoryAfter;
    TernaryGadget publicKeyXAfter;
    TernaryGadget publicKeyYAfter;
    TernaryGadget nonceAfter;

    // Calculate the new balance
    UnsafeSubGadget balance_after;

    // Update User
    UpdateBalanceGadget updateBalance_A;
    UpdateAccountGadget updateAccount_A;

    OnchainWithdrawalGadget(
        ProtoboardT& pb,
        const Constants& _constants,
        const VariableT& accountsMerkleRoot,
        const VariableT& bShutdownMode,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        constants(_constants),

        // User state
        balanceBefore(pb, FMT(prefix, ".balanceBefore")),
        accountBefore(pb, FMT(prefix, ".accountBefore")),

        // Inputs
        accountID(pb, NUM_BITS_ACCOUNT, FMT(prefix, ".accountID")),
        tokenID(pb, NUM_BITS_TOKEN, FMT(prefix, ".tokenID")),
        amountRequested(pb, NUM_BITS_AMOUNT, FMT(prefix, ".amountRequested")),

        // Calculate how much can be withdrawn
        // In shutdown mode always withdraw the complete balance
        amountToWithdrawMin(pb, amountRequested.packed, balanceBefore.balance, NUM_BITS_AMOUNT, FMT(prefix, ".min(amountRequested, balance)")),
        amountToWithdraw(pb, bShutdownMode, balanceBefore.balance, amountToWithdrawMin.result(), FMT(prefix, ".amountToWithdraw")),
        // Float
        amountWithdrawn(pb, constants, Float24Encoding, FMT(prefix, ".amountWithdrawn")),
        requireAccuracyAmountWithdrawn(pb, amountWithdrawn.value(), amountToWithdraw.result(), Float24Accuracy, NUM_BITS_AMOUNT, FMT(prefix, ".requireAccuracyAmountRequested")),

        // Shutdown mode - Reset values to genesis state
        amountToSubtract(pb, bShutdownMode, amountToWithdraw.result(), amountWithdrawn.value(), FMT(prefix, ".amountToSubtract")),
        tradingHistoryAfter(pb, bShutdownMode, constants.emptyTradeHistory, balanceBefore.tradingHistory, FMT(prefix, ".tradingHistoryAfter")),
        publicKeyXAfter(pb, bShutdownMode, constants.zero, accountBefore.publicKey.x, FMT(prefix, ".publicKeyXAfter")),
        publicKeyYAfter(pb, bShutdownMode, constants.zero, accountBefore.publicKey.y, FMT(prefix, ".publicKeyYAfter")),
        nonceAfter(pb, bShutdownMode, constants.zero, accountBefore.nonce, FMT(prefix, ".nonceAfter")),

        // Calculate the new balance
        balance_after(pb, balanceBefore.balance, amountToSubtract.result(), FMT(prefix, ".balance_after")),

        // Update User
        updateBalance_A(pb, accountBefore.balancesRoot, tokenID.bits,
                        {balanceBefore.balance, balanceBefore.tradingHistory},
                        {balance_after.result(), tradingHistoryAfter.result()},
                        FMT(prefix, ".updateBalance_A")),
        updateAccount_A(pb, accountsMerkleRoot, accountID.bits,
                        {accountBefore.publicKey.x, accountBefore.publicKey.y, accountBefore.nonce, accountBefore.balancesRoot},
                        {publicKeyXAfter.result(), publicKeyYAfter.result(), nonceAfter.result(), updateBalance_A.result()},
                        FMT(prefix, ".updateAccount_A"))
    {

    }

    void generate_r1cs_witness(const OnchainWithdrawal& withdrawal)
    {
        // User state
        balanceBefore.generate_r1cs_witness(withdrawal.balanceUpdate.before);
        accountBefore.generate_r1cs_witness(withdrawal.accountUpdate.before);

        // Inputs
        accountID.generate_r1cs_witness(pb, withdrawal.accountUpdate.accountID);
        tokenID.generate_r1cs_witness(pb, withdrawal.balanceUpdate.tokenID);
        amountRequested.generate_r1cs_witness(pb, withdrawal.amountRequested);

        // Withdrawal calculations
        amountToWithdrawMin.generate_r1cs_witness();
        amountToWithdraw.generate_r1cs_witness();
        // Float
        amountWithdrawn.generate_r1cs_witness(toFloat(pb.val(amountToWithdraw.result()), Float24Encoding));
        requireAccuracyAmountWithdrawn.generate_r1cs_witness();

        // Shutdown mode
        amountToSubtract.generate_r1cs_witness();
        tradingHistoryAfter.generate_r1cs_witness();
        publicKeyXAfter.generate_r1cs_witness();
        publicKeyYAfter.generate_r1cs_witness();
        nonceAfter.generate_r1cs_witness();

        // Calculate the new balance
        balance_after.generate_r1cs_witness();

        // Update User
        updateBalance_A.generate_r1cs_witness(withdrawal.balanceUpdate.proof);
        updateAccount_A.generate_r1cs_witness(withdrawal.accountUpdate.proof);
    }

    void generate_r1cs_constraints()
    {
        // Inputs
        accountID.generate_r1cs_constraints(true);
        tokenID.generate_r1cs_constraints(true);
        amountRequested.generate_r1cs_constraints(true);

        // Withdrawal calculations
        amountToWithdrawMin.generate_r1cs_constraints();
        amountToWithdraw.generate_r1cs_constraints();
        // Float
        amountWithdrawn.generate_r1cs_constraints();
        requireAccuracyAmountWithdrawn.generate_r1cs_constraints();

        // Shutdown mode
        amountToSubtract.generate_r1cs_constraints();
        tradingHistoryAfter.generate_r1cs_constraints();
        publicKeyXAfter.generate_r1cs_constraints();
        publicKeyYAfter.generate_r1cs_constraints();
        nonceAfter.generate_r1cs_constraints();

        // Calculate the new balance
        balance_after.generate_r1cs_constraints();

        // Update User
        updateBalance_A.generate_r1cs_constraints();
        updateAccount_A.generate_r1cs_constraints();
    }

    const std::vector<VariableArrayT> getOnchainData() const
    {
        return {accountID.bits,
                VariableArrayT(6, constants.zero), tokenID.bits,
                amountRequested.bits};
    }

    const std::vector<VariableArrayT> getApprovedWithdrawalData() const
    {
        return {VariableArrayT(6, constants.zero), tokenID.bits,
                accountID.bits,
                amountWithdrawn.bits()};
    }

    const VariableT& getNewAccountsRoot() const
    {
        return updateAccount_A.result();
    }
};

class OnchainWithdrawalCircuit : public Circuit
{
public:

    PublicDataGadget publicData;
    Constants constants;

    // Inputs
    DualVariableGadget exchangeID;
    DualVariableGadget merkleRootBefore;
    DualVariableGadget merkleRootAfter;
    DualVariableGadget withdrawalBlockHashStart;
    DualVariableGadget startIndex;
    DualVariableGadget count;

    // Shutdown
    EqualGadget bShutdownMode;

    // Withdrawals
    unsigned int numWithdrawals;
    std::vector<OnchainWithdrawalGadget> withdrawals;
    std::vector<sha256_many> hashers;

    OnchainWithdrawalCircuit(ProtoboardT& pb, const std::string& prefix) :
        Circuit(pb, prefix),

        publicData(pb, FMT(prefix, ".publicData")),
        constants(pb, FMT(prefix, ".constants")),

        // Inputs
        exchangeID(pb, NUM_BITS_EXCHANGE_ID, FMT(prefix, ".exchangeID")),
        merkleRootBefore(pb, 256, FMT(prefix, ".merkleRootBefore")),
        merkleRootAfter(pb, 256, FMT(prefix, ".merkleRootAfter")),
        withdrawalBlockHashStart(pb, 256, FMT(prefix, ".withdrawalBlockHashStart")),
        startIndex(pb, 32, FMT(prefix, ".startIndex")),
        count(pb, 32, FMT(prefix, ".count")),

        // Shutdown
        bShutdownMode(pb, count.packed, constants.zero, FMT(prefix, ".bShutdownMode"))
    {

    }

    void generateConstraints(bool onchainDataAvailability, unsigned int blockSize) override
    {
        this->numWithdrawals = blockSize;

        constants.generate_r1cs_constraints();

        // Inputs
        exchangeID.generate_r1cs_constraints(true);
        merkleRootBefore.generate_r1cs_constraints(true);
        merkleRootAfter.generate_r1cs_constraints(true);
        withdrawalBlockHashStart.generate_r1cs_constraints(true);
        startIndex.generate_r1cs_constraints(true);
        count.generate_r1cs_constraints(true);

        // Shutdown
        bShutdownMode.generate_r1cs_constraints();

        // Withdrawals
        withdrawals.reserve(numWithdrawals);
        hashers.reserve(numWithdrawals);
        for (size_t j = 0; j < numWithdrawals; j++)
        {
            VariableT withdrawalAccountsRoot = (j == 0) ? merkleRootBefore.packed : withdrawals.back().getNewAccountsRoot();
            withdrawals.emplace_back(
                pb,
                constants,
                withdrawalAccountsRoot,
                bShutdownMode.result(),
                std::string("withdrawals_") + std::to_string(j)
            );
            withdrawals.back().generate_r1cs_constraints();

            // Hash data from withdrawal request
            std::vector<VariableArrayT> withdrawalRequestData = withdrawals.back().getOnchainData();
            std::vector<VariableArrayT> hash;
            hash.push_back(reverse((j == 0) ? withdrawalBlockHashStart.bits : hashers.back().result().bits));
            hash.insert(hash.end(), withdrawalRequestData.begin(), withdrawalRequestData.end());
            hashers.emplace_back(pb, flattenReverse(hash), std::string("hash_") + std::to_string(j));
            hashers.back().generate_r1cs_constraints();
        }

        // Public data
        publicData.add(exchangeID.bits);
        publicData.add(merkleRootBefore.bits);
        publicData.add(merkleRootAfter.bits);
        publicData.add(reverse(withdrawalBlockHashStart.bits));
        publicData.add(reverse(hashers.back().result().bits));
        publicData.add(startIndex.bits);
        publicData.add(count.bits);
        // Store the approved data for all withdrawals
        for (auto& withdrawal : withdrawals)
        {
            publicData.add(withdrawal.getApprovedWithdrawalData());
        }
        publicData.generate_r1cs_constraints();

        // Check the new merkle root
        requireEqual(pb, withdrawals.back().getNewAccountsRoot(), merkleRootAfter.packed, "newMerkleRoot");
    }

    bool generateWitness(const OnchainWithdrawalBlock& block)
    {
        constants.generate_r1cs_witness();

        // Inputs
        exchangeID.generate_r1cs_witness(pb, block.exchangeID);
        merkleRootBefore.generate_r1cs_witness(pb, block.merkleRootBefore);
        merkleRootAfter.generate_r1cs_witness(pb, block.merkleRootAfter);
        withdrawalBlockHashStart.generate_r1cs_witness(pb, block.startHash);
        startIndex.generate_r1cs_witness(pb, block.startIndex);
        count.generate_r1cs_witness(pb, block.count);
        // printBits("start hash input: 0x", depositBlockHashStart.get_bits(pb), true);

        // Shutdown
        bShutdownMode.generate_r1cs_witness();

        // Withdrawals
        assert(withdrawals.size() == hashers.size());
#ifdef MULTICORE
        #pragma omp parallel for
#endif
        for(unsigned int i = 0; i < block.withdrawals.size(); i++)
        {
            withdrawals[i].generate_r1cs_witness(block.withdrawals[i]);
        }
        // Cannot be done in parallel
        for(unsigned int i = 0; i < block.withdrawals.size(); i++)
        {
            hashers[i].generate_r1cs_witness();
        }
        // printBits("WithdrawBlockHash: 0x", hashers.back().result().bits.get_bits(pb));

        // Public data
        publicData.generate_r1cs_witness();

        return true;
    }

    bool generateWitness(const json& input) override
    {
        return generateWitness(input.get<Loopring::OnchainWithdrawalBlock>());
    }

    BlockType getBlockType() override
    {
        return BlockType::OnchainWithdrawal;
    }

    unsigned int getBlockSize() override
    {
        return numWithdrawals;
    }

    void printInfo() override
    {
        std::cout << pb.num_constraints() << " constraints (" << (pb.num_constraints() / numWithdrawals) << "/onchain withdrawal)" << std::endl;
    }
};

}

#endif
