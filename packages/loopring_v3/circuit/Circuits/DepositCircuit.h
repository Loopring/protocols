#ifndef _DEPOSITCIRCUIT_H_
#define _DEPOSITCIRCUIT_H_

#include "Circuit.h"
#include "../Utils/Constants.h"
#include "../Utils/Data.h"

#include "../ThirdParty/BigIntHeader.hpp"
#include "ethsnarks.hpp"
#include "utils.hpp"
#include "gadgets/sha256_many.hpp"

using namespace ethsnarks;

namespace Loopring
{

class DepositGadget : public GadgetT
{
public:

    const Constants& constants;

    // User state
    BalanceGadget balanceBefore;
    AccountGadget accountBefore;

    // Inputs
    DualVariableGadget accountID;
    DualVariableGadget tokenID;
    DualVariableGadget amount;
    DualVariableGadget publicKeyX;
    DualVariableGadget publicKeyY;

    // Calculate the new balance
    UnsafeAddGadget uncappedBalanceAfter;
    MinGadget balanceAfter;

    // Update User
    UpdateBalanceGadget updateBalance;
    UpdateAccountGadget updateAccount;

    DepositGadget(
        ProtoboardT& pb,
        const Constants& _constants,
        const VariableT& root,
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
        amount(pb, NUM_BITS_AMOUNT, FMT(prefix, ".amount")),
        publicKeyX(pb, 256, FMT(prefix, ".publicKeyX")),
        publicKeyY(pb, 256, FMT(prefix, ".publicKeyY")),

        // Calculate the new balance
        // We can't let the deposit fail (it's onchain so it needs to be included),
        // and we do want to cap the balance to NUM_BITS_AMOUNT bits max, so cap the balance even
        // if it means that the user loses some tokens (NUM_BITS_AMOUNT bits should be more than enough).
        uncappedBalanceAfter(pb, balanceBefore.balance, amount.packed, FMT(prefix, ".uncappedBalanceAfter")),
        balanceAfter(pb, uncappedBalanceAfter.result(), constants.maxAmount, NUM_BITS_AMOUNT + 1, FMT(prefix, ".balanceAfter")),

        // Update User
        updateBalance(pb, accountBefore.balancesRoot, tokenID.bits,
                      {balanceBefore.balance, balanceBefore.tradingHistory},
                      {balanceAfter.result(), balanceBefore.tradingHistory},
                      FMT(prefix, ".updateBalance")),
        updateAccount(pb, root, accountID.bits,
                      {accountBefore.publicKey.x, accountBefore.publicKey.y, accountBefore.nonce, accountBefore.balancesRoot},
                      {publicKeyX.packed, publicKeyY.packed, accountBefore.nonce, updateBalance.result()},
                      FMT(prefix, ".updateAccount"))
    {

    }

    void generate_r1cs_witness(const Deposit& deposit)
    {
        // User state
        balanceBefore.generate_r1cs_witness(deposit.balanceUpdate.before);
        accountBefore.generate_r1cs_witness(deposit.accountUpdate.before);

        // Inputs
        accountID.generate_r1cs_witness(pb, deposit.accountUpdate.accountID);
        tokenID.generate_r1cs_witness(pb, deposit.balanceUpdate.tokenID);
        amount.generate_r1cs_witness(pb, deposit.amount);
        publicKeyX.generate_r1cs_witness(pb, deposit.accountUpdate.after.publicKey.x);
        publicKeyY.generate_r1cs_witness(pb, deposit.accountUpdate.after.publicKey.y);

        // Calculate the new balance
        uncappedBalanceAfter.generate_r1cs_witness();
        balanceAfter.generate_r1cs_witness();

        // Update User
        updateBalance.generate_r1cs_witness(deposit.balanceUpdate.proof);
        updateAccount.generate_r1cs_witness(deposit.accountUpdate.proof);
    }

    void generate_r1cs_constraints()
    {
        // Inputs
        accountID.generate_r1cs_constraints(true);
        tokenID.generate_r1cs_constraints(true);
        amount.generate_r1cs_constraints(true);
        publicKeyX.generate_r1cs_constraints(true);
        publicKeyY.generate_r1cs_constraints(true);

        // Calculate the new balance
        uncappedBalanceAfter.generate_r1cs_constraints();
        balanceAfter.generate_r1cs_constraints();

        // Update User
        updateBalance.generate_r1cs_constraints();
        updateAccount.generate_r1cs_constraints();
    }

    const std::vector<VariableArrayT> getOnchainData() const
    {
        return {accountID.bits,
                publicKeyX.bits, publicKeyY.bits,
                VariableArrayT(6, constants.zero), tokenID.bits,
                amount.bits};
    }

    const VariableT& getNewAccountsRoot() const
    {
        return updateAccount.result();
    }
};

class DepositCircuit : public Circuit
{
public:

    PublicDataGadget publicData;
    Constants constants;

    // Inputs
    DualVariableGadget exchangeID;
    DualVariableGadget merkleRootBefore;
    DualVariableGadget merkleRootAfter;
    DualVariableGadget depositBlockHashStart;
    DualVariableGadget startIndex;
    DualVariableGadget count;

    // Deposits
    unsigned int numDeposits;
    std::vector<DepositGadget> deposits;
    std::vector<sha256_many> hashers;

    DepositCircuit(ProtoboardT& pb, const std::string& prefix) :
        Circuit(pb, prefix),

        publicData(pb, FMT(prefix, ".publicData")),
        constants(pb, FMT(prefix, ".constants")),

        // Inputs
        exchangeID(pb, NUM_BITS_EXCHANGE_ID, FMT(prefix, ".exchangeID")),
        merkleRootBefore(pb, 256, FMT(prefix, ".merkleRootBefore")),
        merkleRootAfter(pb, 256, FMT(prefix, ".merkleRootAfter")),
        depositBlockHashStart(pb, 256, FMT(prefix, ".depositBlockHashStart")),
        startIndex(pb, 32, FMT(prefix, ".startIndex")),
        count(pb, 32, FMT(prefix, ".count"))
    {

    }

    void generateConstraints(bool onchainDataAvailability, unsigned int blockSize) override
    {
        this->numDeposits = blockSize;

        constants.generate_r1cs_constraints();

        // Inputs
        exchangeID.generate_r1cs_constraints(true);
        merkleRootBefore.generate_r1cs_constraints(true);
        merkleRootAfter.generate_r1cs_constraints(true);
        depositBlockHashStart.generate_r1cs_constraints(true);
        startIndex.generate_r1cs_constraints(true);
        count.generate_r1cs_constraints(true);

        // Deposits
        deposits.reserve(numDeposits);
        hashers.reserve(numDeposits);
        for (size_t j = 0; j < numDeposits; j++)
        {
            VariableT depositAccountsRoot = (j == 0) ? merkleRootBefore.packed : deposits.back().getNewAccountsRoot();
            deposits.emplace_back(
                pb,
                constants,
                depositAccountsRoot,
                std::string("deposit_") + std::to_string(j)
            );
            deposits.back().generate_r1cs_constraints();

            // Hash data from deposit
            std::vector<VariableArrayT> depositData = deposits.back().getOnchainData();
            std::vector<VariableArrayT> hashBits;
            hashBits.push_back(reverse((j == 0) ? depositBlockHashStart.bits : hashers.back().result().bits));
            hashBits.insert(hashBits.end(), depositData.begin(), depositData.end());
            hashers.emplace_back(pb, flattenReverse(hashBits), std::string("hash_") + std::to_string(j));
            hashers.back().generate_r1cs_constraints();
        }

        // Public data
        publicData.add(exchangeID.bits);
        publicData.add(merkleRootBefore.bits);
        publicData.add(merkleRootAfter.bits);
        publicData.add(reverse(depositBlockHashStart.bits));
        publicData.add(reverse(hashers.back().result().bits));
        publicData.add(startIndex.bits);
        publicData.add(count.bits);
        publicData.generate_r1cs_constraints();

        // Check the new merkle root
        requireEqual(pb, deposits.back().getNewAccountsRoot(), merkleRootAfter.packed, "newMerkleRoot");
    }

    bool generateWitness(const DepositBlock& block)
    {
        constants.generate_r1cs_witness();

        // Inputs
        exchangeID.generate_r1cs_witness(pb, block.exchangeID);
        merkleRootBefore.generate_r1cs_witness(pb, block.merkleRootBefore);
        merkleRootAfter.generate_r1cs_witness(pb, block.merkleRootAfter);
        depositBlockHashStart.generate_r1cs_witness(pb, block.startHash);
        startIndex.generate_r1cs_witness(pb, block.startIndex);
        count.generate_r1cs_witness(pb, block.count);
        // printBits("start hash input: 0x", depositBlockHashStart.get_bits(pb), true);

        // Deposits
        assert(deposits.size() == hashers.size());
#ifdef MULTICORE
        #pragma omp parallel for
#endif
        for(unsigned int i = 0; i < block.deposits.size(); i++)
        {
            deposits[i].generate_r1cs_witness(block.deposits[i]);
        }
        // Cannot be done in parallel
        for(unsigned int i = 0; i < block.deposits.size(); i++)
        {
            hashers[i].generate_r1cs_witness();
        }
        // printBits("DepositBlockHash: 0x", hashers.back().result().bits.get_bits(pb));

        // Public data
        publicData.generate_r1cs_witness();

        return true;
    }

    bool generateWitness(const json& input) override
    {
        return generateWitness(input.get<Loopring::DepositBlock>());
    }

    BlockType getBlockType() override
    {
        return BlockType::Deposit;
    }

    unsigned int getBlockSize() override
    {
        return numDeposits;
    }

    void printInfo() override
    {
        std::cout << pb.num_constraints() << " constraints (" << (pb.num_constraints() / numDeposits) << "/deposit)" << std::endl;
    }
};

}

#endif
