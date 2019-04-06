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

    const Constants& constants;

    bool onchain;

    VariableArrayT accountID;
    VariableArrayT tokenID;
    libsnark::dual_variable_gadget<FieldT> amountRequested;
    libsnark::dual_variable_gadget<FieldT> amountWithdrawn;
    VariableArrayT walletAccountID;
    VariableArrayT feeTokenID;
    libsnark::dual_variable_gadget<FieldT> fee;
    libsnark::dual_variable_gadget<FieldT> walletSplitPercentage;

    BalanceState balanceFBefore;
    BalanceState balanceBefore;
    libsnark::dual_variable_gadget<FieldT> nonce_before;
    AccountState accountBefore;

    BalanceState balanceWalletBefore;
    AccountState accountWalletBefore;

    VariableT balanceF_O_before;

    MulDivGadget feeToWallet;
    VariableT feeToOperator;
    subadd_gadget feePaymentWallet;
    subadd_gadget feePaymentOperator;
    MinGadget amountToWithdraw;

    BalanceState balanceFAfter;
    UpdateBalanceGadget updateBalanceF_A;
    BalanceState balanceAfter;
    UpdateBalanceGadget updateBalance_A;
    AccountState accountAfter;
    UpdateAccountGadget updateAccount_A;

    BalanceState balanceWalletAfter;
    UpdateBalanceGadget updateBalance_W;
    AccountState accountWalletAfter;
    UpdateAccountGadget updateAccount_W;

    UpdateBalanceGadget updateBalanceF_O;

    const VariableArrayT message;
    SignatureVerifier signatureVerifier;

    WithdrawGadget(
        ProtoboardT& pb,
        const jubjub::Params& params,
        bool _onchain,
        const Constants& _constants,
        const VariableT& _accountsMerkleRoot,
        const VariableT& _operatorBalancesRoot,
        const VariableArrayT& _realmID,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        onchain(_onchain),

        constants(_constants),

        accountID(make_var_array(pb, TREE_DEPTH_ACCOUNTS, FMT(prefix, ".accountID"))),
        tokenID(make_var_array(pb, TREE_DEPTH_TOKENS, FMT(prefix, ".tokenID"))),
        amountRequested(pb, NUM_BITS_AMOUNT, FMT(prefix, ".amountRequested")),
        walletAccountID(make_var_array(pb, TREE_DEPTH_ACCOUNTS, FMT(prefix, ".walletAccountID"))),
        feeTokenID(make_var_array(pb, TREE_DEPTH_TOKENS, FMT(prefix, ".feeTokenID"))),
        fee(pb, NUM_BITS_AMOUNT, FMT(prefix, ".fee")),
        walletSplitPercentage(pb, 7, FMT(prefix, ".walletSplitPercentage")),

        // User
        balanceFBefore({
            make_variable(pb, FMT(prefix, ".beforeF.balance")),
            make_variable(pb, FMT(prefix, ".beforeF.tradingHistory"))
        }),
        balanceBefore({
            make_variable(pb, FMT(prefix, ".before.balance")),
            make_variable(pb, FMT(prefix, ".before.tradingHistory"))
        }),
        nonce_before(pb, NUM_BITS_NONCE, FMT(prefix, ".nonce_before")),
        accountBefore({
            make_variable(pb, FMT(prefix, ".publicKeyX")),
            make_variable(pb, FMT(prefix, ".publicKeyY")),
            nonce_before.packed,
            make_variable(pb, FMT(prefix, ".before.balancesRoot"))
        }),

        // Wallet
        balanceWalletBefore({
            make_variable(pb, FMT(prefix, ".beforeWallet.balance")),
            constants.emptyTradeHistory
        }),
        accountWalletBefore({
            constants.one,
            constants.one,
            make_variable(pb, FMT(prefix, ".nonce")),
            make_variable(pb, FMT(prefix, ".before.balancesRoot"))
        }),

        // Operator
        balanceF_O_before(make_variable(pb, FMT(prefix, ".balanceF_O_before"))),

        // Split the fee between wallet and operator
        feeToWallet(pb, constants, fee.packed, walletSplitPercentage.packed, constants._100, FMT(prefix, ".feeToWallet")),
        feeToOperator(make_variable(pb, 1, FMT(prefix, ".feeToOperator"))),

        // Calculate the balances after fee payment of the wallet and operator
        feePaymentWallet(pb, NUM_BITS_AMOUNT, balanceFBefore.balance, balanceWalletBefore.balance, feeToWallet.result(), FMT(prefix, ".feePaymentWallet")),
        feePaymentOperator(pb, NUM_BITS_AMOUNT, feePaymentWallet.X, balanceF_O_before, feeToOperator, FMT(prefix, ".feePaymentOperator")),

        // Calculate how much can be withdrawn
        amountToWithdraw(pb, amountRequested.packed, balanceBefore.balance, NUM_BITS_AMOUNT, FMT(prefix, ".min(amountRequested, balance)")),
        amountWithdrawn(pb, NUM_BITS_AMOUNT, FMT(prefix, ".amountWithdrawn")),

        // Update User
        balanceFAfter({
            feePaymentOperator.X,
            balanceFBefore.tradingHistory
        }),
        updateBalanceF_A(pb, accountBefore.balancesRoot, tokenID, balanceFBefore, balanceFAfter, FMT(prefix, ".updateBalanceF_A")),
        balanceAfter({
            make_variable(pb, FMT(prefix, ".after.balance")),
            balanceBefore.tradingHistory
        }),
        updateBalance_A(pb, updateBalanceF_A.getNewRoot(), feeTokenID, balanceBefore, balanceAfter, FMT(prefix, ".updateBalance_A")),
        accountAfter({
            accountBefore.publicKeyX,
            accountBefore.publicKeyY,
            make_variable(pb, FMT(prefix, ".after.nonce")),
            updateBalance_A.getNewRoot()
        }),
        updateAccount_A(pb, _accountsMerkleRoot, accountID, accountBefore, accountAfter, FMT(prefix, ".updateAccount_A")),

        // Update Wallet
        balanceWalletAfter({
            feePaymentWallet.Y,
            balanceWalletBefore.tradingHistory
        }),
        updateBalance_W(pb, accountWalletBefore.balancesRoot, feeTokenID, balanceWalletBefore, balanceWalletAfter, FMT(prefix, ".updateBalance_W")),
        accountWalletAfter({
            accountWalletBefore.publicKeyX,
            accountWalletBefore.publicKeyY,
            accountWalletBefore.nonce,
            updateBalance_W.getNewRoot()
        }),
        updateAccount_W(pb, updateAccount_A.result(), walletAccountID, accountWalletBefore, accountWalletAfter, FMT(prefix, ".updateAccount_W")),

        // Update Operator
        updateBalanceF_O(pb, _operatorBalancesRoot, feeTokenID,
                         {balanceF_O_before, constants.emptyTradeHistory},
                         {feePaymentOperator.Y, constants.emptyTradeHistory},
                         FMT(prefix, ".updateBalanceF_O")),

        // Signature
        message(flatten({_realmID, accountID, tokenID, amountRequested.bits, walletAccountID,
                         feeTokenID, fee.bits, walletSplitPercentage.bits, nonce_before.bits, constants.padding_0})),
        signatureVerifier(pb, params, jubjub::VariablePointT(accountBefore.publicKeyX, accountBefore.publicKeyY), message, FMT(prefix, ".signatureVerifier"))
    {

    }

    const VariableT getNewAccountsRoot() const
    {
        return updateAccount_W.result();
    }

    const VariableT getNewOperatorBalancesRoot() const
    {
        return updateBalanceF_O.getNewRoot();
    }

    const std::vector<VariableArrayT> getPublicDataGeneral() const
    {
        return {constants.accountPadding, accountID,
                constants.tokenPadding, tokenID,
                amountWithdrawn.bits};
    }

    const std::vector<VariableArrayT> getPublicDataOffchain() const
    {
        return {constants.accountPadding, walletAccountID,
                constants.tokenPadding, feeTokenID,
                fee.bits,
                constants.padding_0, walletSplitPercentage.bits};
    }

    const std::vector<VariableArrayT> getOnchainData() const
    {
        return {constants.accountPadding, accountID,
                constants.tokenPadding, tokenID,
                amountRequested.bits};
    }

    void generate_r1cs_witness(const Withdrawal& withdrawal)
    {
        accountID.fill_with_bits_of_field_element(pb, withdrawal.accountUpdate_A.accountID);
        tokenID.fill_with_bits_of_field_element(pb, withdrawal.balanceUpdateW_A.tokenID);
        walletAccountID.fill_with_bits_of_field_element(pb, withdrawal.accountUpdate_W.accountID);
        feeTokenID.fill_with_bits_of_field_element(pb, withdrawal.balanceUpdateF_A.tokenID);
        fee.bits.fill_with_bits_of_field_element(pb, withdrawal.fee);
        fee.generate_r1cs_witness_from_bits();
        walletSplitPercentage.bits.fill_with_bits_of_field_element(pb, withdrawal.walletSplitPercentage);
        walletSplitPercentage.generate_r1cs_witness_from_bits();
        amountRequested.bits.fill_with_bits_of_field_element(pb, withdrawal.amount);
        amountRequested.generate_r1cs_witness_from_bits();

        // User
        pb.val(balanceFBefore.tradingHistory) = withdrawal.balanceUpdateF_A.before.tradingHistoryRoot;
        pb.val(balanceFBefore.balance) = withdrawal.balanceUpdateF_A.before.balance;
        pb.val(balanceBefore.tradingHistory) = withdrawal.balanceUpdateW_A.before.tradingHistoryRoot;
        pb.val(balanceBefore.balance) = withdrawal.balanceUpdateW_A.before.balance;
        pb.val(balanceAfter.balance) = withdrawal.balanceUpdateW_A.after.balance;
        pb.val(accountBefore.publicKeyX) = withdrawal.accountUpdate_A.before.publicKey.x;
        pb.val(accountBefore.publicKeyY) = withdrawal.accountUpdate_A.before.publicKey.y;
        pb.val(accountBefore.balancesRoot) = withdrawal.accountUpdate_A.before.balancesRoot;
        nonce_before.bits.fill_with_bits_of_field_element(pb, withdrawal.accountUpdate_A.before.nonce);
        nonce_before.generate_r1cs_witness_from_bits();
        pb.val(accountAfter.nonce) = withdrawal.accountUpdate_A.after.nonce;

        // Wallet
        pb.val(balanceWalletBefore.balance) = withdrawal.balanceUpdateF_W.before.balance;
        pb.val(accountWalletBefore.balancesRoot) = withdrawal.accountUpdate_W.before.balancesRoot;
        pb.val(accountWalletBefore.nonce) = withdrawal.accountUpdate_W.before.nonce;

        // Operator
        pb.val(balanceF_O_before) = withdrawal.balanceUpdateF_O.before.balance;

        // Fee payments calculations
        feeToWallet.generate_r1cs_witness();
        pb.val(feeToOperator) = pb.val(fee.packed) - pb.val(feeToWallet.result());
        feePaymentWallet.generate_r1cs_witness();
        feePaymentOperator.generate_r1cs_witness();
        amountToWithdraw.generate_r1cs_witness();
        amountWithdrawn.bits.fill_with_bits_of_field_element(pb, (pb.val(balanceBefore.balance) - pb.val(balanceAfter.balance)));
        amountWithdrawn.generate_r1cs_witness_from_bits();

        // Update User
        updateBalanceF_A.generate_r1cs_witness(withdrawal.balanceUpdateF_A.proof);
        updateBalance_A.generate_r1cs_witness(withdrawal.balanceUpdateW_A.proof);
        updateAccount_A.generate_r1cs_witness(withdrawal.accountUpdate_A.proof);

        // Update Wallet
        updateBalance_W.generate_r1cs_witness(withdrawal.balanceUpdateF_W.proof);
        updateAccount_W.generate_r1cs_witness(withdrawal.accountUpdate_W.proof);

        // Update operator
        updateBalanceF_O.generate_r1cs_witness(withdrawal.balanceUpdateF_O.proof);

        if (!onchain)
        {
            signatureVerifier.generate_r1cs_witness(withdrawal.signature);
        }
    }

    void generate_r1cs_constraints()
    {
        fee.generate_r1cs_constraints(true);
        nonce_before.generate_r1cs_constraints(true);

        feeToWallet.generate_r1cs_constraints();
        pb.add_r1cs_constraint(ConstraintT(feeToWallet.result() + feeToOperator, FieldT::one(), fee.packed), "feeToWallet + feeToOperator == fee");

        feePaymentWallet.generate_r1cs_constraints();
        feePaymentOperator.generate_r1cs_constraints();

        amountRequested.generate_r1cs_constraints(true);
        amountWithdrawn.generate_r1cs_constraints(true);

        amountToWithdraw.generate_r1cs_constraints();

        pb.add_r1cs_constraint(ConstraintT(balanceBefore.balance, 1, balanceAfter.balance + amountToWithdraw.result()), "balance_before == balance_after + amountToWithdraw");

        updateBalance_A.generate_r1cs_constraints();
        updateAccount_A.generate_r1cs_constraints();

        // TODO: acctually split this circuit up, this only estimates the number of contraints
        if (!onchain)
        {
            updateBalanceF_A.generate_r1cs_constraints();
            updateBalance_W.generate_r1cs_constraints();
            updateAccount_W.generate_r1cs_constraints();
            updateBalanceF_O.generate_r1cs_constraints();

            signatureVerifier.generate_r1cs_constraints();
            pb.add_r1cs_constraint(ConstraintT(nonce_before.packed + FieldT::one(), FieldT::one(), accountAfter.nonce), "nonce_before + 1 == nonce_after");
        }
        else
        {
            pb.add_r1cs_constraint(ConstraintT(nonce_before.packed, FieldT::one(), accountAfter.nonce), "nonce_before == nonce_after");
        }
    }
};

class WithdrawCircuitGadget : public GadgetT
{
public:
    jubjub::Params params;

    bool onchainDataAvailability;
    unsigned int numAccounts;
    bool onchain;
    std::vector<WithdrawGadget> withdrawals;

    libsnark::dual_variable_gadget<FieldT> publicDataHash;
    PublicDataGadget publicData;

    Constants constants;

    libsnark::dual_variable_gadget<FieldT> realmID;
    libsnark::dual_variable_gadget<FieldT> merkleRootBefore;
    libsnark::dual_variable_gadget<FieldT> merkleRootAfter;

    VariableT nonce;

    VariableArrayT withdrawalBlockHashStart;
    std::vector<VariableArrayT> withdrawalDataBits;
    std::vector<sha256_many> hashers;

    libsnark::dual_variable_gadget<FieldT> startIndex;
    libsnark::dual_variable_gadget<FieldT> count;

    const jubjub::VariablePointT publicKey;
    libsnark::dual_variable_gadget<FieldT> operatorAccountID;
    VariableT balancesRoot_before;

    UpdateAccountGadget* updateAccount_O = nullptr;

    WithdrawCircuitGadget(ProtoboardT& pb, bool _onchain, const std::string& prefix) :
        GadgetT(pb, prefix),

        onchain(_onchain),

        publicDataHash(pb, 256, FMT(prefix, ".publicDataHash")),
        publicData(pb, publicDataHash, FMT(prefix, ".publicData")),

        constants(pb, FMT(prefix, ".constants")),

        realmID(pb, 32, FMT(prefix, ".realmID")),
        merkleRootBefore(pb, 256, FMT(prefix, ".merkleRootBefore")),
        merkleRootAfter(pb, 256, FMT(prefix, ".merkleRootAfter")),

        operatorAccountID(pb, TREE_DEPTH_ACCOUNTS, FMT(prefix, ".operatorAccountID")),
        publicKey(pb, FMT(prefix, ".publicKey")),
        nonce(make_variable(pb, 0, FMT(prefix, ".nonce"))),
        balancesRoot_before(make_variable(pb, 0, FMT(prefix, ".balancesRoot_before"))),

        withdrawalBlockHashStart(make_var_array(pb, 256, FMT(prefix, ".withdrawalBlockHashStart"))),

        startIndex(pb, 32, FMT(prefix, ".startIndex")),
        count(pb, 32, FMT(prefix, ".count"))
    {

    }

    ~WithdrawCircuitGadget()
    {
        if (updateAccount_O)
        {
            delete updateAccount_O;
        }
    }

    void generate_r1cs_constraints(bool onchainDataAvailability, int numAccounts)
    {
        this->onchainDataAvailability = onchainDataAvailability;
        this->numAccounts = numAccounts;

        pb.set_input_sizes(1);

        constants.generate_r1cs_witness();

        realmID.generate_r1cs_constraints(true);
        merkleRootBefore.generate_r1cs_constraints(true);
        merkleRootAfter.generate_r1cs_constraints(true);

        publicData.add(realmID.bits);
        publicData.add(merkleRootBefore.bits);
        publicData.add(merkleRootAfter.bits);
        for (size_t j = 0; j < numAccounts; j++)
        {
            VariableT withdrawalAccountsRoot = (j == 0) ? merkleRootBefore.packed : withdrawals.back().getNewAccountsRoot();
            VariableT withdrawalOperatorBalancesRoot = (j == 0) ? balancesRoot_before : withdrawals.back().getNewOperatorBalancesRoot();
            withdrawals.emplace_back(
                pb,
                params,
                onchain,
                constants,
                withdrawalAccountsRoot,
                withdrawalOperatorBalancesRoot,
                realmID.bits,
                std::string("withdrawals_") + std::to_string(j)
            );
            withdrawals.back().generate_r1cs_constraints();

            if (onchain)
            {
                VariableArrayT withdrawalBlockHash = (j == 0) ? withdrawalBlockHashStart : hashers.back().result().bits;

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

        operatorAccountID.generate_r1cs_constraints(true);

        if (onchain)
        {
             // Add the block hash
            publicData.add(flattenReverse({withdrawalBlockHashStart}));
            publicData.add(flattenReverse({hashers.back().result().bits}));
            publicData.add(startIndex.bits);
            publicData.add(count.bits);
        }
        else
        {
            updateAccount_O = new UpdateAccountGadget(pb, withdrawals.back().getNewAccountsRoot(), operatorAccountID.bits,
                {publicKey.x, publicKey.y, nonce, balancesRoot_before},
                {publicKey.x, publicKey.y, nonce, withdrawals.back().getNewOperatorBalancesRoot()},
                FMT(annotation_prefix, ".updateAccount_O"));
            updateAccount_O->generate_r1cs_constraints();
        }

        // First store the data for all withdrawals (onchain and offchain)
        for (auto& withdrawal : withdrawals)
        {
            publicData.add(withdrawal.getPublicDataGeneral());
        }
        if (!onchain && onchainDataAvailability)
        {
            // Now store the data specifically for offchain withdrawals
            publicData.add(constants.accountPadding);
            publicData.add(operatorAccountID.bits);
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
        constants.generate_r1cs_witness();

        realmID.bits.fill_with_bits_of_field_element(pb, context.realmID);
        realmID.generate_r1cs_witness_from_bits();

        merkleRootBefore.bits.fill_with_bits_of_field_element(pb, context.merkleRootBefore);
        merkleRootBefore.generate_r1cs_witness_from_bits();
        merkleRootAfter.bits.fill_with_bits_of_field_element(pb, context.merkleRootAfter);
        merkleRootAfter.generate_r1cs_witness_from_bits();

        pb.val(balancesRoot_before) = context.accountUpdate_O.before.balancesRoot;

        // Store the starting hash
        for (unsigned int i = 0; i < 256; i++)
        {
            pb.val(withdrawalBlockHashStart[255 - i]) = context.startHash.test_bit(i);
        }
        // printBits("start hash input: 0x", depositBlockHashStart.get_bits(pb), true);

        startIndex.bits.fill_with_bits_of_field_element(pb, context.startIndex);
        startIndex.generate_r1cs_witness_from_bits();

        count.bits.fill_with_bits_of_field_element(pb, context.count);
        count.generate_r1cs_witness_from_bits();

        for(unsigned int i = 0; i < context.withdrawals.size(); i++)
        {
            withdrawals[i].generate_r1cs_witness(context.withdrawals[i]);
        }

        operatorAccountID.bits.fill_with_bits_of_field_element(pb, context.operatorAccountID);
        operatorAccountID.generate_r1cs_witness_from_bits();

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
