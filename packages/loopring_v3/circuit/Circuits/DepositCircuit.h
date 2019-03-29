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
    VariableArrayT accountID;
    VariableArrayT tokenID;

    VariableArrayT uint16_padding;

    libsnark::dual_variable_gadget<FieldT> amount;
    libsnark::dual_variable_gadget<FieldT> publicKeyX;
    libsnark::dual_variable_gadget<FieldT> publicKeyY;

    BalanceState balanceBefore;
    AccountState accountBefore;
    BalanceState balanceAfter;
    UpdateBalanceGadget updateBalance;
    AccountState accountAfter;
    UpdateAccountGadget updateAccount;

    DepositGadget(
        ProtoboardT& pb,
        const Constants& constants,
        const VariableT& root,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        uint16_padding(make_var_array(pb, 16 - TREE_DEPTH_TOKENS, FMT(prefix, ".uint16_padding"))),

        accountID(make_var_array(pb, TREE_DEPTH_ACCOUNTS, FMT(prefix, ".accountID"))),
        tokenID(make_var_array(pb, TREE_DEPTH_TOKENS, FMT(prefix, ".tokenID"))),

        amount(pb, NUM_BITS_AMOUNT, FMT(prefix, ".amount")),
        publicKeyX(pb, 256, FMT(prefix, ".publicKeyX")),
        publicKeyY(pb, 256, FMT(prefix, ".publicKeyY")),

        balanceBefore({
            make_variable(pb, FMT(prefix, ".before.balance")),
            make_variable(pb, FMT(prefix, ".tradingHistoryRoot"))
        }),
        accountBefore({
            make_variable(pb, FMT(prefix, ".publicKeyX_before")),
            make_variable(pb, FMT(prefix, ".publicKeyY_before")),
            make_variable(pb, FMT(prefix, ".nonce")),
            make_variable(pb, FMT(prefix, ".balancesRoot_before"))
        }),
        balanceAfter({
            make_variable(pb, FMT(prefix, ".after.balance")),
            balanceBefore.tradingHistory
        }),
        updateBalance(pb, accountBefore.balancesRoot, tokenID, balanceBefore, balanceAfter, FMT(prefix, ".updateBalance")),
        accountAfter({
            publicKeyX.packed,
            publicKeyY.packed,
            accountBefore.nonce,
            updateBalance.getNewRoot()
        }),
        updateAccount(pb, root, accountID, accountBefore, accountAfter, FMT(prefix, ".updateAccount"))
    {

    }

    const VariableT getNewAccountsRoot() const
    {
        return updateAccount.result();
    }

    const std::vector<VariableArrayT> getOnchainData() const
    {
        return {accountID, publicKeyX.bits, publicKeyY.bits,
                uint16_padding, tokenID,
                amount.bits};
    }

    void generate_r1cs_witness(const Deposit& deposit)
    {
        uint16_padding.fill_with_bits_of_ulong(pb, 0);

        accountID.fill_with_bits_of_field_element(pb, deposit.accountUpdate.accountID);
        tokenID.fill_with_bits_of_field_element(pb, deposit.balanceUpdate.tokenID);

        amount.bits.fill_with_bits_of_field_element(pb, deposit.balanceUpdate.after.balance - deposit.balanceUpdate.before.balance);
        amount.generate_r1cs_witness_from_bits();
        publicKeyX.bits.fill_with_bits_of_field_element(pb, deposit.accountUpdate.after.publicKey.x);
        publicKeyX.generate_r1cs_witness_from_bits();
        publicKeyY.bits.fill_with_bits_of_field_element(pb, deposit.accountUpdate.after.publicKey.y);
        publicKeyY.generate_r1cs_witness_from_bits();

        pb.val(balanceBefore.balance) = deposit.balanceUpdate.before.balance;
        pb.val(balanceBefore.tradingHistory) = deposit.balanceUpdate.before.tradingHistoryRoot;
        pb.val(balanceAfter.balance) = deposit.balanceUpdate.after.balance;

        pb.val(accountBefore.publicKeyX) = deposit.accountUpdate.before.publicKey.x;
        pb.val(accountBefore.publicKeyY) = deposit.accountUpdate.before.publicKey.y;
        pb.val(accountBefore.nonce) = deposit.accountUpdate.before.nonce;
        pb.val(accountBefore.balancesRoot) = deposit.accountUpdate.before.balancesRoot;

        updateBalance.generate_r1cs_witness(deposit.balanceUpdate.proof);
        updateAccount.generate_r1cs_witness(deposit.accountUpdate.proof);
    }

    void generate_r1cs_constraints()
    {
        amount.generate_r1cs_constraints(true);
        publicKeyX.generate_r1cs_constraints(true);
        publicKeyY.generate_r1cs_constraints(true);

        pb.add_r1cs_constraint(ConstraintT(balanceBefore.balance + amount.packed, 1, balanceAfter.balance), "balanceBefore + amount == balanceAfter");

        updateBalance.generate_r1cs_constraints();
        updateAccount.generate_r1cs_constraints();
    }
};

class DepositsCircuitGadget : public GadgetT
{
public:

    unsigned int numAccounts;
    std::vector<DepositGadget> deposits;

    libsnark::dual_variable_gadget<FieldT> publicDataHash;
    PublicDataGadget publicData;

    Constants constants;

    libsnark::dual_variable_gadget<FieldT> realmID;
    libsnark::dual_variable_gadget<FieldT> merkleRootBefore;
    libsnark::dual_variable_gadget<FieldT> merkleRootAfter;

    VariableArrayT depositBlockHashStart;
    std::vector<VariableArrayT> depositDataBits;
    std::vector<sha256_many> hashers;

    libsnark::dual_variable_gadget<FieldT> startIndex;
    libsnark::dual_variable_gadget<FieldT> count;

    DepositsCircuitGadget(ProtoboardT& pb, const std::string& prefix) :
        GadgetT(pb, prefix),

        publicDataHash(pb, 256, FMT(prefix, ".publicDataHash")),
        publicData(pb, publicDataHash, FMT(prefix, ".publicData")),

        constants(pb, FMT(prefix, ".constants")),

        realmID(pb, 32, FMT(prefix, ".realmID")),
        merkleRootBefore(pb, 256, FMT(prefix, ".merkleRootBefore")),
        merkleRootAfter(pb, 256, FMT(prefix, ".merkleRootAfter")),

        depositBlockHashStart(make_var_array(pb, 256, FMT(prefix, ".depositBlockHashStart"))),

        startIndex(pb, 32, FMT(prefix, ".startIndex")),
        count(pb, 32, FMT(prefix, ".count"))
    {

    }

    ~DepositsCircuitGadget()
    {

    }

    void generate_r1cs_constraints(int numAccounts)
    {
        this->numAccounts = numAccounts;

        pb.set_input_sizes(1);

        constants.generate_r1cs_constraints();

        realmID.generate_r1cs_constraints(true);
        merkleRootBefore.generate_r1cs_constraints(true);
        merkleRootAfter.generate_r1cs_constraints(true);

        publicData.add(realmID.bits);
        publicData.add(merkleRootBefore.bits);
        publicData.add(merkleRootAfter.bits);
        publicData.add(flattenReverse({depositBlockHashStart}));
        for (size_t j = 0; j < numAccounts; j++)
        {
            VariableT depositAccountsRoot = (j == 0) ? merkleRootBefore.packed : deposits.back().getNewAccountsRoot();
            deposits.emplace_back(
                pb,
                constants,
                depositAccountsRoot,
                std::string("deposit_") + std::to_string(j)
            );
            deposits.back().generate_r1cs_constraints();

            VariableArrayT depositBlockHash = (j == 0) ? depositBlockHashStart : hashers.back().result().bits;

            // Hash data from deposit
            std::vector<VariableArrayT> depositData = deposits.back().getOnchainData();
            std::vector<VariableArrayT> hashBits;
            hashBits.push_back(flattenReverse({depositBlockHash}));
            hashBits.insert(hashBits.end(), depositData.begin(), depositData.end());
            depositDataBits.push_back(flattenReverse(hashBits));
            hashers.emplace_back(pb, depositDataBits.back(), std::string("hash_") + std::to_string(j));
            hashers.back().generate_r1cs_constraints();
        }

        // Add the block hash
        publicData.add(flattenReverse({hashers.back().result().bits}));
        publicData.add(startIndex.bits);
        publicData.add(count.bits);

        // Check the input hash
        publicDataHash.generate_r1cs_constraints(true);
        publicData.generate_r1cs_constraints();

        // Check the new merkle root
        forceEqual(pb, deposits.back().getNewAccountsRoot(), merkleRootAfter.packed, "newMerkleRoot");
    }

    void printInfo()
    {
        std::cout << pb.num_constraints() << " constraints (" << (pb.num_constraints() / numAccounts) << "/deposit)" << std::endl;
    }

    bool generateWitness(const DepositContext& context)
    {
        constants.generate_r1cs_witness();

        realmID.bits.fill_with_bits_of_field_element(pb, context.realmID);
        realmID.generate_r1cs_witness_from_bits();

        merkleRootBefore.bits.fill_with_bits_of_field_element(pb, context.merkleRootBefore);
        merkleRootBefore.generate_r1cs_witness_from_bits();
        merkleRootAfter.bits.fill_with_bits_of_field_element(pb, context.merkleRootAfter);
        merkleRootAfter.generate_r1cs_witness_from_bits();

        // Store the starting hash
        for (unsigned int i = 0; i < 256; i++)
        {
            pb.val(depositBlockHashStart[255 - i]) = context.startHash.test_bit(i);
        }
        // printBits("start hash input: 0x", depositBlockHashStart.get_bits(pb), true);

        startIndex.bits.fill_with_bits_of_field_element(pb, context.startIndex);
        startIndex.generate_r1cs_witness_from_bits();
        count.bits.fill_with_bits_of_field_element(pb, context.count);
        count.generate_r1cs_witness_from_bits();

        for(unsigned int i = 0; i < context.deposits.size(); i++)
        {
            deposits[i].generate_r1cs_witness(context.deposits[i]);
        }

        for (auto& hasher : hashers)
        {
            hasher.generate_r1cs_witness();
        }
        printBits("DepositBlockHash: 0x", hashers.back().result().bits.get_bits(pb));

        publicData.generate_r1cs_witness();

        return true;
    }
};

}

#endif
