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

class WithdrawGadget : public GadgetT
{
public:

    VariableT constant0;
    VariableT constant100;
    VariableArrayT uint16_padding;

    bool onchain;

    const jubjub::VariablePointT publicKey;
    VariableArrayT accountID;
    VariableArrayT tokenID;
    libsnark::dual_variable_gadget<FieldT> amountRequested;
    libsnark::dual_variable_gadget<FieldT> amountWithdrawn;
    libsnark::dual_variable_gadget<FieldT> padding;
    libsnark::dual_variable_gadget<FieldT> burnPercentage;
    VariableArrayT feeTokenID;
    libsnark::dual_variable_gadget<FieldT> fee;

    VariableT walletID;

    libsnark::dual_variable_gadget<FieldT> nonce_before;
    VariableT nonce_after;

    VariableT balancesRoot_before;

    VariableT tradingHistoryRootF_A;
    VariableT balanceF_A_before;
    VariableT burnBalanceF_A;

    VariableT tradingHistoryRootW_A;
    VariableT balanceW_A_before;
    VariableT balanceW_A_after;
    VariableT burnBalanceW_A_before;

    VariableT tradingHistoryRootF_O;
    VariableT balanceF_O_before;

    subadd_gadget feePayment;

    MinGadget amountToWithdraw;

    MulDivGadget burnPercentageCalc;

    UpdateBalanceGadget updateBalanceF_A;
    UpdateBalanceGadget updateBalanceW_A;
    UpdateAccountGadget updateAccount_A;

    UpdateBalanceGadget updateBalanceF_O;

    SignatureVerifier signatureVerifier;

    WithdrawGadget(
        ProtoboardT& pb,
        const jubjub::Params& params,
        bool _onchain,
        const VariableT& _accountsMerkleRoot,
        const VariableT& _operatorBalancesRoot,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        onchain(_onchain),

        constant0(make_variable(pb, 0, FMT(prefix, ".constant0"))),
        constant100(make_variable(pb, 100, FMT(prefix, ".constant100"))),
        uint16_padding(make_var_array(pb, 16 - TREE_DEPTH_TOKENS, FMT(prefix, ".uint16_padding"))),

        publicKey(pb, FMT(prefix, ".publicKey")),

        accountID(make_var_array(pb, TREE_DEPTH_ACCOUNTS, FMT(prefix, ".accountID"))),
        tokenID(make_var_array(pb, TREE_DEPTH_TOKENS, FMT(prefix, ".tokenID"))),
        amountRequested(pb, 96, FMT(prefix, ".amountRequested")),
        padding(pb, 2, FMT(prefix, ".padding")),
        burnPercentage(pb, 8, FMT(prefix, ".burnPercentage")),
        feeTokenID(make_var_array(pb, TREE_DEPTH_TOKENS, FMT(prefix, ".feeTokenID"))),
        fee(pb, 96, FMT(prefix, ".fee")),

        walletID(make_variable(pb, FMT(prefix, ".walletID"))),

        nonce_before(pb, 32, FMT(prefix, ".nonce_before")),
        nonce_after(make_variable(pb, FMT(prefix, ".nonce_after"))),

        balancesRoot_before(make_variable(pb, FMT(prefix, ".balancesRoot_before"))),

        tradingHistoryRootF_A(make_variable(pb, FMT(prefix, ".tradingHistoryRootF_A"))),
        balanceF_A_before(make_variable(pb, FMT(prefix, ".balanceF_A_before"))),
        burnBalanceF_A(make_variable(pb, FMT(prefix, ".burnBalanceF_A"))),

        tradingHistoryRootW_A(make_variable(pb, FMT(prefix, ".tradingHistoryRootW_A"))),
        balanceW_A_before(make_variable(pb, FMT(prefix, ".balanceW_A_before"))),
        balanceW_A_after(make_variable(pb, FMT(prefix, ".balanceW_A_after"))),
        burnBalanceW_A_before(make_variable(pb, FMT(prefix, ".burnBalanceW_A_before"))),

        tradingHistoryRootF_O(make_variable(pb, FMT(prefix, ".tradingHistoryRootF_O"))),
        balanceF_O_before(make_variable(pb, FMT(prefix, ".balanceF_O_before"))),

        feePayment(pb, 96, balanceF_A_before, balanceF_O_before, fee.packed, FMT(prefix, ".feePayment")),

        amountToWithdraw(pb, amountRequested.packed, balanceW_A_before, FMT(prefix, ".min(amountRequested, balance)")),
        amountWithdrawn(pb, 96, FMT(prefix, ".amountWithdrawn")),

        burnPercentageCalc(pb, burnBalanceW_A_before, constant100, amountWithdrawn.packed, FMT(prefix, "(burnBalance * 100) / amountWithdrawn == burnPercentage")),

        updateBalanceF_A(pb, balancesRoot_before, tokenID,
                         {balanceF_A_before, burnBalanceF_A, tradingHistoryRootF_A},
                         {feePayment.X, burnBalanceF_A, tradingHistoryRootF_A},
                         FMT(prefix, ".updateBalanceF_A")),

        updateBalanceW_A(pb, updateBalanceF_A.getNewRoot(), feeTokenID,
                         {balanceW_A_before, burnBalanceW_A_before, tradingHistoryRootW_A},
                         {balanceW_A_after, constant0, tradingHistoryRootW_A},
                         FMT(prefix, ".updateBalanceW_A")),

        updateAccount_A(pb, _accountsMerkleRoot, accountID,
                        {publicKey.x, publicKey.y, walletID, nonce_before.packed, balancesRoot_before},
                        {publicKey.x, publicKey.y, walletID, nonce_after, updateBalanceW_A.getNewRoot()},
                        FMT(prefix, ".updateAccount_A")),

        updateBalanceF_O(pb, _operatorBalancesRoot, feeTokenID,
                         {balanceF_O_before, constant0, tradingHistoryRootF_O},
                         {feePayment.Y, constant0, tradingHistoryRootF_O},
                         FMT(prefix, ".updateBalanceF_O")),

        signatureVerifier(pb, params, publicKey,
                          flatten({accountID, tokenID, amountRequested.bits, feeTokenID, fee.bits, nonce_before.bits}),
                          FMT(prefix, ".signatureVerifier"))
    {

    }

    const VariableT getNewAccountsRoot() const
    {
        return updateAccount_A.result();
    }

    const VariableT getNewOperatorBalancesRoot() const
    {
        return updateBalanceF_O.getNewRoot();
    }

    const std::vector<VariableArrayT> getPublicDataGeneral() const
    {
        return {accountID, uint16_padding, tokenID, amountWithdrawn.bits, burnPercentage.bits};
    }

    const std::vector<VariableArrayT> getPublicDataOffchain() const
    {
        return {uint16_padding, feeTokenID, fee.bits};
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

        accountID.fill_with_bits_of_field_element(pb, withdrawal.accountUpdate_A.accountID);
        tokenID.fill_with_bits_of_field_element(pb, withdrawal.balanceUpdateW_A.tokenID);
        feeTokenID.fill_with_bits_of_field_element(pb, withdrawal.balanceUpdateF_A.tokenID);
        fee.bits.fill_with_bits_of_field_element(pb, withdrawal.fee);
        fee.generate_r1cs_witness_from_bits();

        amountRequested.bits.fill_with_bits_of_field_element(pb, withdrawal.amount);
        amountRequested.generate_r1cs_witness_from_bits();

        padding.bits.fill_with_bits_of_field_element(pb, 0);
        padding.generate_r1cs_witness_from_bits();

        burnPercentage.bits.fill_with_bits_of_field_element(pb, withdrawal.burnPercentage);
        burnPercentage.generate_r1cs_witness_from_bits();

        pb.val(walletID) = withdrawal.accountUpdate_A.before.walletID;

        nonce_before.bits.fill_with_bits_of_field_element(pb, withdrawal.accountUpdate_A.before.nonce);
        nonce_before.generate_r1cs_witness_from_bits();
        pb.val(nonce_after) = withdrawal.accountUpdate_A.after.nonce;

        pb.val(balancesRoot_before) = withdrawal.accountUpdate_A.before.balancesRoot;

        pb.val(tradingHistoryRootF_A) = withdrawal.balanceUpdateF_A.before.tradingHistoryRoot;
        pb.val(balanceF_A_before) = withdrawal.balanceUpdateF_A.before.balance;
        pb.val(burnBalanceF_A) = withdrawal.balanceUpdateF_A.before.burnBalance;

        pb.val(tradingHistoryRootW_A) = withdrawal.balanceUpdateW_A.before.tradingHistoryRoot;
        pb.val(balanceW_A_before) = withdrawal.balanceUpdateW_A.before.balance;
        pb.val(balanceW_A_after) = withdrawal.balanceUpdateW_A.after.balance;
        pb.val(burnBalanceW_A_before) = withdrawal.balanceUpdateW_A.before.burnBalance;

        pb.val(tradingHistoryRootF_O) = withdrawal.balanceUpdateF_O.before.tradingHistoryRoot;
        pb.val(balanceF_O_before) = withdrawal.balanceUpdateF_O.before.balance;

        feePayment.generate_r1cs_witness();

        amountToWithdraw.generate_r1cs_witness();

        amountWithdrawn.bits.fill_with_bits_of_field_element(pb, (pb.val(balanceW_A_before) - pb.val(balanceW_A_after)) + pb.val(burnBalanceW_A_before));
        amountWithdrawn.generate_r1cs_witness_from_bits();

        burnPercentageCalc.generate_r1cs_witness();

        updateBalanceF_A.generate_r1cs_witness(withdrawal.balanceUpdateF_A.proof);
        updateBalanceW_A.generate_r1cs_witness(withdrawal.balanceUpdateW_A.proof);
        updateAccount_A.generate_r1cs_witness(withdrawal.accountUpdate_A.proof);
        updateBalanceF_O.generate_r1cs_witness(withdrawal.balanceUpdateF_O.proof);

        if (!onchain)
        {
            signatureVerifier.generate_r1cs_witness(withdrawal.signature);
        }
    }

    void generate_r1cs_constraints()
    {
        padding.generate_r1cs_constraints(true);

        fee.generate_r1cs_constraints(true);
        nonce_before.generate_r1cs_constraints(true);

        amountRequested.generate_r1cs_constraints(true);
        amountWithdrawn.generate_r1cs_constraints(true);

        amountToWithdraw.generate_r1cs_constraints();

        burnPercentageCalc.generate_r1cs_constraints();

        pb.add_r1cs_constraint(ConstraintT(amountToWithdraw.result() + burnBalanceW_A_before, 1, amountWithdrawn.packed), "amountToWithdraw + burnBalance == amountWithdrawn");
        pb.add_r1cs_constraint(ConstraintT(balanceW_A_before, 1, balanceW_A_after + amountToWithdraw.result()), "balance_before == balance_after + amountToWithdraw");

        pb.add_r1cs_constraint(ConstraintT(amountToWithdraw.result() + burnBalanceW_A_before, 1, amountWithdrawn.packed), "amountToWithdraw + burnBalance == amountWithdrawn");
        forceEqual(pb, burnPercentageCalc.result(), burnPercentage.packed, FMT(annotation_prefix, "burnPercentageCalc == burnPercentage"));

        updateBalanceF_A.generate_r1cs_constraints();
        updateBalanceW_A.generate_r1cs_constraints();
        updateAccount_A.generate_r1cs_constraints();
        updateBalanceF_O.generate_r1cs_constraints();

        if (!onchain)
        {
            signatureVerifier.generate_r1cs_constraints();
            pb.add_r1cs_constraint(ConstraintT(nonce_before.packed + FieldT::one(), FieldT::one(), nonce_after), "nonce_before + 1 == nonce_after");
        }
        else
        {
            pb.add_r1cs_constraint(ConstraintT(nonce_before.packed, FieldT::one(), nonce_after), "nonce_before == nonce_after");
        }
    }
};

class WithdrawCircuitGadget : public GadgetT
{
public:
    jubjub::Params params;

    unsigned int numAccounts;
    bool onchain;
    std::vector<WithdrawGadget> withdrawals;

    libsnark::dual_variable_gadget<FieldT> publicDataHash;
    PublicDataGadget publicData;

    libsnark::dual_variable_gadget<FieldT> stateID;
    libsnark::dual_variable_gadget<FieldT> merkleRootBefore;
    libsnark::dual_variable_gadget<FieldT> merkleRootAfter;

    VariableT constant0;
    VariableT nonce;

    libsnark::dual_variable_gadget<FieldT> withdrawalBlockHashStart;
    std::vector<VariableArrayT> withdrawalDataBits;
    std::vector<sha256_many> hashers;

    const jubjub::VariablePointT publicKey;
    libsnark::dual_variable_gadget<FieldT> operatorAccountID;
    VariableT balancesRoot_before;

    UpdateAccountGadget* updateAccount_O = nullptr;

    WithdrawCircuitGadget(ProtoboardT& pb, bool _onchain, const std::string& prefix) :
        GadgetT(pb, prefix),

        onchain(_onchain),

        publicDataHash(pb, 256, FMT(prefix, ".publicDataHash")),
        publicData(pb, publicDataHash, FMT(prefix, ".publicData")),

        stateID(pb, 16, FMT(prefix, ".stateID")),
        merkleRootBefore(pb, 256, FMT(prefix, ".merkleRootBefore")),
        merkleRootAfter(pb, 256, FMT(prefix, ".merkleRootAfter")),

        constant0(make_variable(pb, 0, FMT(prefix, ".constant0"))),
        operatorAccountID(pb, TREE_DEPTH_ACCOUNTS, FMT(prefix, ".operatorAccountID")),
        publicKey(pb, FMT(prefix, ".publicKey")),
        nonce(make_variable(pb, 0, FMT(prefix, ".nonce"))),
        balancesRoot_before(make_variable(pb, 0, FMT(prefix, ".balancesRoot_before"))),

        withdrawalBlockHashStart(pb, 256, FMT(prefix, ".withdrawalBlockHashStart"))
    {

    }

    ~WithdrawCircuitGadget()
    {
        if (updateAccount_O)
        {
            delete updateAccount_O;
        }
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
            VariableT withdrawalAccountsRoot = (j == 0) ? merkleRootBefore.packed : withdrawals.back().getNewAccountsRoot();
            VariableT withdrawalOperatorBalancesRoot = (j == 0) ? balancesRoot_before : withdrawals.back().getNewOperatorBalancesRoot();
            withdrawals.emplace_back(pb, params, onchain, withdrawalAccountsRoot, withdrawalOperatorBalancesRoot, std::string("withdrawals_") + std::to_string(j));
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

            operatorAccountID.generate_r1cs_constraints(true);
            updateAccount_O = new UpdateAccountGadget(pb, withdrawals.back().getNewAccountsRoot(), operatorAccountID.bits,
                {publicKey.x, publicKey.y, constant0, nonce, balancesRoot_before},
                {publicKey.x, publicKey.y, constant0, nonce, withdrawals.back().getNewOperatorBalancesRoot()},
                FMT(annotation_prefix, ".updateAccount_O"));
            updateAccount_O->generate_r1cs_constraints();
        }

        // First store the data for all withdrawals (onchain and offchain)
        for (auto& withdrawal : withdrawals)
        {
            publicData.add(withdrawal.getPublicDataGeneral());
        }
        if (!onchain)
        {
            // Now store the data specifically for offchain withdrawals
            for (auto& withdrawal : withdrawals)
            {
                publicData.add(withdrawal.getPublicDataOffchain());
            }
        }

        // Check the input hash
        publicDataHash.generate_r1cs_constraints(true);
        publicData.generate_r1cs_constraints();

        // Check the new merkle root
        if (onchain)
        {
            forceEqual(pb, withdrawals.back().getNewAccountsRoot(), merkleRootAfter.packed, "newMerkleRoot");
        }
        else
        {
            forceEqual(pb, updateAccount_O->result(), merkleRootAfter.packed, "newMerkleRoot");
        }
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

        pb.val(balancesRoot_before) = context.accountUpdate_O.before.balancesRoot;

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
        else
        {
            operatorAccountID.bits.fill_with_bits_of_field_element(pb, context.operatorAccountID);
            operatorAccountID.generate_r1cs_witness_from_bits();

            pb.val(publicKey.x) = context.accountUpdate_O.before.publicKey.x;
            pb.val(publicKey.y) = context.accountUpdate_O.before.publicKey.y;

            pb.val(nonce) = context.accountUpdate_O.before.nonce;

            updateAccount_O->generate_r1cs_witness(context.accountUpdate_O.proof);
        }

        publicData.generate_r1cs_witness();

        return true;
    }
};

}

#endif
