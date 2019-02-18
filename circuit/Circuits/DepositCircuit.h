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

    VariableArrayT accountID;
    VariableArrayT tokenID;

    VariableArrayT uint16_padding;

    const VariableT balance_before;
    const VariableT balance_after;

    const VariableT publicKeyX_before;
    const VariableT publicKeyY_before;
    const VariableT walletID_before;
    const VariableT nonce_before;

    const VariableT tradingHistoryRoot_before;
    const VariableT balancesRoot_before;

    libsnark::dual_variable_gadget<FieldT> publicKeyX_after;
    libsnark::dual_variable_gadget<FieldT> publicKeyY_after;
    libsnark::dual_variable_gadget<FieldT> walletID_after;
    const VariableT nonce_after;

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

        accountID(make_var_array(pb, TREE_DEPTH_ACCOUNTS, FMT(prefix, ".accountID"))),
        tokenID(make_var_array(pb, TREE_DEPTH_BALANCES, FMT(prefix, ".tokenID"))),

        uint16_padding(make_var_array(pb, 16 - NUM_BITS_WALLETID, FMT(prefix, ".uint16_padding"))),

        balance_before(make_variable(pb, 0, FMT(prefix, ".balance_before"))),
        balance_after(make_variable(pb, 0, FMT(prefix, ".balance_after"))),

        publicKeyX_before(make_variable(pb, 0, FMT(prefix, ".publicKeyX_before"))),
        publicKeyY_before(make_variable(pb, 0, FMT(prefix, ".publicKeyY_before"))),
        walletID_before(make_variable(pb, 0, FMT(prefix, ".walletID_before"))),
        nonce_before(make_variable(pb, 0, FMT(prefix, ".nonce_before"))),
        tradingHistoryRoot_before(make_variable(pb, 0, FMT(prefix, ".tradingHistoryRoot_before"))),
        balancesRoot_before(make_variable(pb, 0, FMT(prefix, ".balancesRoot_before"))),

        publicKeyX_after(pb, 256, FMT(prefix, ".publicKeyX_after")),
        publicKeyY_after(pb, 256, FMT(prefix, ".publicKeyY_after")),
        walletID_after(pb, NUM_BITS_WALLETID, FMT(prefix, ".walletID_after")),
        nonce_after(make_variable(pb, 0, FMT(prefix, ".nonce_after"))),

        tradingHistoryRoot_after(make_variable(pb, 0, FMT(prefix, ".tradingHistoryRoot_after"))),
        balancesRoot_after(make_variable(pb, 0, FMT(prefix, ".balancesRoot_after"))),

        amount(pb, 96, FMT(prefix, ".amount")),

        updateBalance(pb, balancesRoot_before, tokenID,
                      {balance_before, tradingHistoryRoot_before},
                      {balance_after, tradingHistoryRoot_after},
                      FMT(prefix, ".updateBalance")),

        updateAccount(pb, root, accountID,
                      {publicKeyX_before, publicKeyY_before, walletID_before, nonce_before, balancesRoot_before},
                      {publicKeyX_after.packed, publicKeyY_after.packed, walletID_after.packed, nonce_after, updateBalance.getNewRoot()},
                      FMT(prefix, ".updateAccount"))
    {

    }

    const VariableT getNewAccountsRoot() const
    {
        return updateAccount.result();
    }

    const std::vector<VariableArrayT> getPublicData() const
    {
        return {accountID, publicKeyX_after.bits, publicKeyY_after.bits,
                uint16_padding, walletID_after.bits,
                uint16_padding, tokenID,
                amount.bits};
    }

    void generate_r1cs_witness(const Deposit& deposit)
    {
        accountID.fill_with_bits_of_field_element(pb, deposit.accountUpdate.accountID);
        tokenID.fill_with_bits_of_field_element(pb, deposit.balanceUpdate.tokenID);

        pb.val(balance_before) = deposit.balanceUpdate.before.balance;
        pb.val(tradingHistoryRoot_before) = deposit.balanceUpdate.before.tradingHistoryRoot;
        pb.val(balancesRoot_before) = deposit.accountUpdate.before.balancesRoot;

        pb.val(publicKeyX_before) = deposit.accountUpdate.before.publicKey.x;
        pb.val(publicKeyY_before) = deposit.accountUpdate.before.publicKey.y;
        pb.val(walletID_before) = deposit.accountUpdate.before.walletID;

        publicKeyX_after.bits.fill_with_bits_of_field_element(pb, deposit.accountUpdate.after.publicKey.x);
        publicKeyX_after.generate_r1cs_witness_from_bits();
        publicKeyY_after.bits.fill_with_bits_of_field_element(pb, deposit.accountUpdate.after.publicKey.y);
        publicKeyY_after.generate_r1cs_witness_from_bits();
        walletID_after.bits.fill_with_bits_of_field_element(pb, deposit.accountUpdate.after.walletID);
        walletID_after.generate_r1cs_witness_from_bits();
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
        walletID_after.generate_r1cs_constraints(true);

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
    libsnark::dual_variable_gadget<FieldT> stateID;
    libsnark::dual_variable_gadget<FieldT> merkleRootBefore;
    libsnark::dual_variable_gadget<FieldT> merkleRootAfter;

    std::vector<VariableArrayT> publicDataBits;

    libsnark::dual_variable_gadget<FieldT> depositBlockHashStart;
    std::vector<VariableArrayT> depositDataBits;
    std::vector<sha256_many> hashers;

    MiMC_hash_gadget* hashRootsBefore;
    MiMC_hash_gadget* hashRootsAfter;

    const VariableT accountsRootBefore;
    const VariableT feesRoot;

    sha256_many* publicDataHasher;

    DepositsCircuitGadget(ProtoboardT& pb, const std::string& prefix) :
        GadgetT(pb, prefix),

        stateID(pb, 16, FMT(prefix, ".stateID")),
        merkleRootBefore(pb, 256, FMT(prefix, ".merkleRootBefore")),
        merkleRootAfter(pb, 256, FMT(prefix, ".merkleRootAfter")),

        depositBlockHashStart(pb, 256, FMT(prefix, ".depositBlockHashStart")),

        accountsRootBefore(make_variable(pb, FMT(prefix, ".accountsRootBefore"))),
        feesRoot(make_variable(pb, FMT(prefix, ".feesRoot"))),

        publicDataHash(pb, 256, FMT(prefix, ".publicDataHash"))
    {
        this->publicDataHasher = nullptr;
    }

    ~DepositsCircuitGadget()
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
            VariableT depositAccountsRoot = (j == 0) ? accountsRootBefore : deposits.back().getNewAccountsRoot();
            deposits.emplace_back(pb, depositAccountsRoot, std::string("deposit_") + std::to_string(j));

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

        hashRootsBefore = new MiMC_hash_gadget(pb, libsnark::ONE, {accountsRootBefore, feesRoot}, FMT(annotation_prefix, ".rootBefore"));
        hashRootsBefore->generate_r1cs_constraints();
        hashRootsAfter = new MiMC_hash_gadget(pb, libsnark::ONE, {deposits.back().getNewAccountsRoot(), feesRoot}, FMT(annotation_prefix, ".rootAfter"));
        hashRootsAfter->generate_r1cs_constraints();

        // Make sure the merkle roots are correctly passed in
        pb.add_r1cs_constraint(ConstraintT(hashRootsBefore->result(), 1, merkleRootBefore.packed), "oldMerkleRoot");
        pb.add_r1cs_constraint(ConstraintT(hashRootsAfter->result(), 1, merkleRootAfter.packed), "newMerkleRoot");
    }

    void printInfo()
    {
        std::cout << pb.num_constraints() << " constraints (" << (pb.num_constraints() / numAccounts) << "/deposit)" << std::endl;
    }

    bool generateWitness(const DepositContext& context)
    {
        stateID.bits.fill_with_bits_of_field_element(pb, context.stateID);
        stateID.generate_r1cs_witness_from_bits();

        merkleRootBefore.bits.fill_with_bits_of_field_element(pb, context.merkleRootBefore);
        merkleRootBefore.generate_r1cs_witness_from_bits();
        merkleRootAfter.bits.fill_with_bits_of_field_element(pb, context.merkleRootAfter);
        merkleRootAfter.generate_r1cs_witness_from_bits();

        pb.val(accountsRootBefore) = context.deposits[0].accountUpdate.rootBefore;
        pb.val(feesRoot) = context.feesRoot;

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

        /*for (auto& hasher : hashers)
        {
            printBits("Deposit block hash bits: ", hasher.result().bits.get_bits(pb), true);
        }*/

        printBits("publicDataHash: 0x", flattenReverse({publicDataHasher->result().bits}).get_bits(pb), true);

        return true;
    }
};

}

#endif
