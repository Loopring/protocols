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
    VariableT constant0;

    VariableArrayT accountId;
    VariableArrayT tokenId;

    VariableArrayT uint16_padding;

    const VariableT balance_before;
    const VariableT balance_after;

    const VariableT publicKeyX_before;
    const VariableT publicKeyY_before;
    const VariableT walletId_before;
    const VariableT nonce;

    const VariableT tradingHistoryRoot_before;
    const VariableT balancesRoot_before;

    libsnark::dual_variable_gadget<FieldT> publicKeyX_after;
    libsnark::dual_variable_gadget<FieldT> publicKeyY_after;
    libsnark::dual_variable_gadget<FieldT> walletId_after;

    const VariableT tradingHistoryRoot_after;
    const VariableT balancesRoot_after;

    libsnark::dual_variable_gadget<FieldT> amount;

    UpdateBalanceGadget updateBalance;
    UpdateAccountGadget updateAccount;

    DepositGadget(
        ProtoboardT& pb,
        const VariableT& root,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        constant0(make_variable(pb, 0, FMT(prefix, ".constant0"))),
        uint16_padding(make_var_array(pb, 16 - TREE_DEPTH_TOKENS, FMT(prefix, ".uint16_padding"))),

        accountId(make_var_array(pb, TREE_DEPTH_ACCOUNTS, FMT(prefix, ".accountId"))),
        tokenId(make_var_array(pb, TREE_DEPTH_TOKENS, FMT(prefix, ".tokenId"))),

        nonce(make_variable(pb, 0, FMT(prefix, ".nonce"))),

        balance_before(make_variable(pb, 0, FMT(prefix, ".balance_before"))),
        balance_after(make_variable(pb, 0, FMT(prefix, ".balance_after"))),

        publicKeyX_before(make_variable(pb, 0, FMT(prefix, ".publicKeyX_before"))),
        publicKeyY_before(make_variable(pb, 0, FMT(prefix, ".publicKeyY_before"))),
        walletId_before(make_variable(pb, 0, FMT(prefix, ".walletId_before"))),

        tradingHistoryRoot_before(make_variable(pb, 0, FMT(prefix, ".tradingHistoryRoot_before"))),
        balancesRoot_before(make_variable(pb, 0, FMT(prefix, ".balancesRoot_before"))),

        publicKeyX_after(pb, 256, FMT(prefix, ".publicKeyX_after")),
        publicKeyY_after(pb, 256, FMT(prefix, ".publicKeyY_after")),
        walletId_after(pb, NUM_BITS_WALLETID, FMT(prefix, ".walletId_after")),

        tradingHistoryRoot_after(make_variable(pb, 0, FMT(prefix, ".tradingHistoryRoot_after"))),
        balancesRoot_after(make_variable(pb, 0, FMT(prefix, ".balancesRoot_after"))),

        amount(pb, 96, FMT(prefix, ".amount")),

        updateBalance(pb, balancesRoot_before, tokenId,
                      {balance_before, tradingHistoryRoot_before},
                      {balance_after, tradingHistoryRoot_after},
                      FMT(prefix, ".updateBalance")),

        updateAccount(pb, root, accountId,
                      {publicKeyX_before, publicKeyY_before, walletId_before, nonce, balancesRoot_before},
                      {publicKeyX_after.packed, publicKeyY_after.packed, walletId_after.packed, nonce, updateBalance.getNewRoot()},
                      FMT(prefix, ".updateAccount"))
    {

    }

    const VariableT getNewAccountsRoot() const
    {
        return updateAccount.result();
    }

    const std::vector<VariableArrayT> getOnchainData() const
    {
        return {accountId, publicKeyX_after.bits, publicKeyY_after.bits,
                walletId_after.bits, uint16_padding, tokenId,
                amount.bits};
    }

    void generate_r1cs_witness(const Deposit& deposit)
    {
        uint16_padding.fill_with_bits_of_ulong(pb, 0);

        accountId.fill_with_bits_of_field_element(pb, deposit.accountUpdate.accountId);
        tokenId.fill_with_bits_of_field_element(pb, deposit.balanceUpdate.tokenId);

        pb.val(nonce) = deposit.accountUpdate.before.nonce;

        pb.val(balance_before) = deposit.balanceUpdate.before.balance;
        pb.val(tradingHistoryRoot_before) = deposit.balanceUpdate.before.tradingHistoryRoot;
        pb.val(balancesRoot_before) = deposit.accountUpdate.before.balancesRoot;

        pb.val(publicKeyX_before) = deposit.accountUpdate.before.publicKey.x;
        pb.val(publicKeyY_before) = deposit.accountUpdate.before.publicKey.y;
        pb.val(walletId_before) = deposit.accountUpdate.before.walletId;

        publicKeyX_after.bits.fill_with_bits_of_field_element(pb, deposit.accountUpdate.after.publicKey.x);
        publicKeyX_after.generate_r1cs_witness_from_bits();
        publicKeyY_after.bits.fill_with_bits_of_field_element(pb, deposit.accountUpdate.after.publicKey.y);
        publicKeyY_after.generate_r1cs_witness_from_bits();
        walletId_after.bits.fill_with_bits_of_field_element(pb, deposit.accountUpdate.after.walletId);
        walletId_after.generate_r1cs_witness_from_bits();
        pb.val(balance_after) = deposit.balanceUpdate.after.balance;
        pb.val(tradingHistoryRoot_after) = deposit.balanceUpdate.after.tradingHistoryRoot;
        pb.val(balancesRoot_after) = deposit.accountUpdate.after.balancesRoot;

        amount.bits.fill_with_bits_of_field_element(pb, deposit.balanceUpdate.after.balance - deposit.balanceUpdate.before.balance);
        amount.generate_r1cs_witness_from_bits();

        updateBalance.generate_r1cs_witness(deposit.balanceUpdate.proof);
        updateAccount.generate_r1cs_witness(deposit.accountUpdate.proof);
    }

    void generate_r1cs_constraints()
    {
        publicKeyX_after.generate_r1cs_constraints(true);
        publicKeyY_after.generate_r1cs_constraints(true);
        walletId_after.generate_r1cs_constraints(true);

        amount.generate_r1cs_constraints(true);

        pb.add_r1cs_constraint(ConstraintT(balance_before + amount.packed, 1, balance_after), "balance_before + amount == balance_after");

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

    libsnark::dual_variable_gadget<FieldT> stateId;
    libsnark::dual_variable_gadget<FieldT> merkleRootBefore;
    libsnark::dual_variable_gadget<FieldT> merkleRootAfter;

    libsnark::dual_variable_gadget<FieldT> depositBlockHashStart;
    std::vector<VariableArrayT> depositDataBits;
    std::vector<sha256_many> hashers;

    DepositsCircuitGadget(ProtoboardT& pb, const std::string& prefix) :
        GadgetT(pb, prefix),

        publicDataHash(pb, 256, FMT(prefix, ".publicDataHash")),
        publicData(pb, publicDataHash, FMT(prefix, ".publicData")),

        stateId(pb, 32, FMT(prefix, ".stateId")),
        merkleRootBefore(pb, 256, FMT(prefix, ".merkleRootBefore")),
        merkleRootAfter(pb, 256, FMT(prefix, ".merkleRootAfter")),

        depositBlockHashStart(pb, 256, FMT(prefix, ".depositBlockHashStart"))
    {

    }

    ~DepositsCircuitGadget()
    {

    }

    void generate_r1cs_constraints(int numAccounts)
    {
        this->numAccounts = numAccounts;

        pb.set_input_sizes(1);

        stateId.generate_r1cs_constraints(true);
        merkleRootBefore.generate_r1cs_constraints(true);
        merkleRootAfter.generate_r1cs_constraints(true);

        publicData.add(stateId.bits);
        publicData.add(merkleRootBefore.bits);
        publicData.add(merkleRootAfter.bits);
        for (size_t j = 0; j < numAccounts; j++)
        {
            VariableT depositAccountsRoot = (j == 0) ? merkleRootBefore.packed : deposits.back().getNewAccountsRoot();
            deposits.emplace_back(pb, depositAccountsRoot, std::string("deposit_") + std::to_string(j));
            deposits.back().generate_r1cs_constraints();

            VariableArrayT depositBlockHash = (j == 0) ? depositBlockHashStart.bits : hashers.back().result().bits;

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
        stateId.bits.fill_with_bits_of_field_element(pb, context.stateId);
        stateId.generate_r1cs_witness_from_bits();

        merkleRootBefore.bits.fill_with_bits_of_field_element(pb, context.merkleRootBefore);
        merkleRootBefore.generate_r1cs_witness_from_bits();
        merkleRootAfter.bits.fill_with_bits_of_field_element(pb, context.merkleRootAfter);
        merkleRootAfter.generate_r1cs_witness_from_bits();

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
        printBits("DepositBlockHash: 0x", flattenReverse({hashers.back().result().bits}).get_bits(pb), true);

        publicData.generate_r1cs_witness();

        return true;
    }
};

}

#endif
