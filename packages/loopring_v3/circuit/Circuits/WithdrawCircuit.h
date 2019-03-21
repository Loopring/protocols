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
    VariableT emptyTradeHistory;
    libsnark::dual_variable_gadget<FieldT> padding;
    VariableArrayT uint16_padding;
    VariableArrayT percentage_padding;

    bool onchain;

    const jubjub::VariablePointT publicKey;
    const jubjub::VariablePointT walletPublicKey;

    VariableArrayT accountId;
    VariableArrayT tokenId;
    libsnark::dual_variable_gadget<FieldT> amountRequested;
    libsnark::dual_variable_gadget<FieldT> amountWithdrawn;
    VariableArrayT dualAuthAccountId;
    VariableArrayT feeTokenID;
    libsnark::dual_variable_gadget<FieldT> fee;
    libsnark::dual_variable_gadget<FieldT> walletSplitPercentage;

    VariableT walletId;

    libsnark::dual_variable_gadget<FieldT> nonce_before;
    VariableT nonce_after;

    VariableT balancesRoot_before;

    VariableT tradingHistoryRootF_A;
    VariableT balanceF_A_before;

    VariableT tradingHistoryRootW_A;
    VariableT balanceW_A_before;
    VariableT balanceW_A_after;

    VariableT balancesRoot_W_before;
    VariableT balanceF_W_before;
    VariableT nonce_W;
    VariableT dualAuthorWalletID;

    VariableT maxNumWallets;
    LeqGadget walletId_lt_MaxNumWallets;
    VariableT dualAuthorWalletID_T;
    TernaryGadget expectedDualAuthorWalletID;

    VariableT tradingHistoryRootF_O;
    VariableT balanceF_O_before;

    MulDivGadget feeToWallet;
    VariableT feeToOperator;

    subadd_gadget feePaymentWallet;
    subadd_gadget feePaymentOperator;

    MinGadget amountToWithdraw;

    UpdateBalanceGadget updateBalanceF_A;
    UpdateBalanceGadget updateBalanceW_A;
    UpdateAccountGadget updateAccount_A;

    UpdateBalanceGadget updateBalanceF_W;
    UpdateAccountGadget updateAccount_W;

    UpdateBalanceGadget updateBalanceF_O;

    const VariableArrayT message;
    SignatureVerifier signatureVerifier;
    SignatureVerifier walletSignatureVerifier;

    WithdrawGadget(
        ProtoboardT& pb,
        const jubjub::Params& params,
        bool _onchain,
        const VariableT& _accountsMerkleRoot,
        const VariableT& _operatorBalancesRoot,
        const VariableArrayT& _stateId,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        onchain(_onchain),

        constant0(make_variable(pb, 0, FMT(prefix, ".constant0"))),
        constant100(make_variable(pb, 100, FMT(prefix, ".constant100"))),
        emptyTradeHistory(make_variable(pb, ethsnarks::FieldT("6534726031924637156958436868622484975370199861911592821911265735257245326584"), FMT(prefix, ".emptyTradeHistory"))),
        padding(pb, 1, FMT(prefix, ".padding")),
        uint16_padding(make_var_array(pb, 16 - TREE_DEPTH_TOKENS, FMT(prefix, ".uint16_padding"))),
        percentage_padding(make_var_array(pb, 1, FMT(prefix, ".percentage_padding"))),

        publicKey(pb, FMT(prefix, ".publicKey")),
        walletPublicKey(pb, FMT(prefix, ".walletPublicKey")),

        accountId(make_var_array(pb, TREE_DEPTH_ACCOUNTS, FMT(prefix, ".accountId"))),
        tokenId(make_var_array(pb, TREE_DEPTH_TOKENS, FMT(prefix, ".tokenId"))),
        amountRequested(pb, 96, FMT(prefix, ".amountRequested")),
        dualAuthAccountId(make_var_array(pb, TREE_DEPTH_ACCOUNTS, FMT(prefix, ".dualAuthAccountId"))),
        feeTokenID(make_var_array(pb, TREE_DEPTH_TOKENS, FMT(prefix, ".feeTokenID"))),
        fee(pb, 96, FMT(prefix, ".fee")),
        walletSplitPercentage(pb, 7, FMT(prefix, ".walletSplitPercentage")),

        walletId(make_variable(pb, FMT(prefix, ".walletId"))),

        nonce_before(pb, 32, FMT(prefix, ".nonce_before")),
        nonce_after(make_variable(pb, FMT(prefix, ".nonce_after"))),

        balancesRoot_before(make_variable(pb, FMT(prefix, ".balancesRoot_before"))),

        tradingHistoryRootF_A(make_variable(pb, FMT(prefix, ".tradingHistoryRootF_A"))),
        balanceF_A_before(make_variable(pb, FMT(prefix, ".balanceF_A_before"))),

        tradingHistoryRootW_A(make_variable(pb, FMT(prefix, ".tradingHistoryRootW_A"))),
        balanceW_A_before(make_variable(pb, FMT(prefix, ".balanceW_A_before"))),
        balanceW_A_after(make_variable(pb, FMT(prefix, ".balanceW_A_after"))),

        balancesRoot_W_before(make_variable(pb, FMT(prefix, ".balancesRoot_W_before"))),
        balanceF_W_before(make_variable(pb, FMT(prefix, ".balanceF_W_before"))),
        nonce_W(make_variable(pb, FMT(prefix, ".nonce_W"))),

        dualAuthorWalletID(make_variable(pb, FMT(prefix, ".dualAuthorWalletID"))),
        maxNumWallets(make_variable(pb, MAX_NUM_WALLETS, FMT(prefix, ".maxNumWallets"))),
        walletId_lt_MaxNumWallets(pb, walletId, maxNumWallets, FMT(prefix, ".walletId < MAX_NUM_WALLETS")),
        dualAuthorWalletID_T(make_variable(pb, FMT(prefix, ".dualAuthorWalletID_T"))),
        expectedDualAuthorWalletID(pb, walletId_lt_MaxNumWallets.lt(), dualAuthorWalletID_T, walletId, FMT(prefix, ".expectedDualAuthorWalletID")),

        tradingHistoryRootF_O(make_variable(pb, FMT(prefix, ".tradingHistoryRootF_O"))),
        balanceF_O_before(make_variable(pb, FMT(prefix, ".balanceF_O_before"))),

        feeToWallet(pb, fee.packed, walletSplitPercentage.packed, constant100, FMT(prefix, ".feeToWallet")),
        feeToOperator(make_variable(pb, 1, FMT(prefix, ".feeToOperator"))),

        feePaymentWallet(pb, 96, balanceF_A_before, balanceF_W_before, feeToWallet.result(), FMT(prefix, ".feePaymentWallet")),
        feePaymentOperator(pb, 96, feePaymentWallet.X, balanceF_O_before, feeToOperator, FMT(prefix, ".feePaymentOperator")),

        amountToWithdraw(pb, amountRequested.packed, balanceW_A_before, FMT(prefix, ".min(amountRequested, balance)")),
        amountWithdrawn(pb, 96, FMT(prefix, ".amountWithdrawn")),

        updateBalanceF_A(pb, balancesRoot_before, tokenId,
                         {balanceF_A_before, tradingHistoryRootF_A},
                         {feePaymentOperator.X, tradingHistoryRootF_A},
                         FMT(prefix, ".updateBalanceF_A")),

        updateBalanceW_A(pb, updateBalanceF_A.getNewRoot(), feeTokenID,
                         {balanceW_A_before, tradingHistoryRootW_A},
                         {balanceW_A_after, tradingHistoryRootW_A},
                         FMT(prefix, ".updateBalanceW_A")),

        updateAccount_A(pb, _accountsMerkleRoot, accountId,
                        {publicKey.x, publicKey.y, walletId, nonce_before.packed, balancesRoot_before},
                        {publicKey.x, publicKey.y, walletId, nonce_after, updateBalanceW_A.getNewRoot()},
                        FMT(prefix, ".updateAccount_A")),


        updateBalanceF_W(pb, balancesRoot_W_before, feeTokenID,
                         {balanceF_W_before, emptyTradeHistory},
                         {feePaymentWallet.Y, emptyTradeHistory},
                         FMT(prefix, ".updateBalanceF_W")),

        updateAccount_W(pb, updateAccount_A.result(), dualAuthAccountId,
                        {walletPublicKey.x, walletPublicKey.y, dualAuthorWalletID, nonce_W, balancesRoot_W_before},
                        {walletPublicKey.x, walletPublicKey.y, dualAuthorWalletID, nonce_W, updateBalanceF_W.getNewRoot()},
                        FMT(prefix, ".updateAccount_W")),


        updateBalanceF_O(pb, _operatorBalancesRoot, feeTokenID,
                         {balanceF_O_before, tradingHistoryRootF_O},
                         {feePaymentOperator.Y, tradingHistoryRootF_O},
                         FMT(prefix, ".updateBalanceF_O")),


        message(flatten({_stateId, accountId, tokenId, amountRequested.bits, dualAuthAccountId,
                         feeTokenID, fee.bits, walletSplitPercentage.bits, nonce_before.bits})),
        signatureVerifier(pb, params, publicKey, message, FMT(prefix, ".signatureVerifier")),
        walletSignatureVerifier(pb, params, walletPublicKey, message, FMT(prefix, ".walletSignatureVerifier"))
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
        return {accountId, uint16_padding, tokenId, amountWithdrawn.bits};
    }

    const std::vector<VariableArrayT> getPublicDataOffchain() const
    {
        return {dualAuthAccountId, uint16_padding, feeTokenID, fee.bits, percentage_padding, walletSplitPercentage.bits};
    }

    const std::vector<VariableArrayT> getOnchainData() const
    {
        return {accountId, uint16_padding, tokenId, amountRequested.bits};
    }

    void generate_r1cs_witness(const Withdrawal& withdrawal)
    {
        uint16_padding.fill_with_bits_of_ulong(pb, 0);

        pb.val(publicKey.x) = withdrawal.publicKey.x;
        pb.val(publicKey.y) = withdrawal.publicKey.y;

        pb.val(walletPublicKey.x) = withdrawal.walletPublicKey.x;
        pb.val(walletPublicKey.y) = withdrawal.walletPublicKey.y;

        accountId.fill_with_bits_of_field_element(pb, withdrawal.accountUpdate_A.accountId);
        tokenId.fill_with_bits_of_field_element(pb, withdrawal.balanceUpdateW_A.tokenId);
        dualAuthAccountId.fill_with_bits_of_field_element(pb, withdrawal.accountUpdate_W.accountId);
        feeTokenID.fill_with_bits_of_field_element(pb, withdrawal.balanceUpdateF_A.tokenId);
        fee.bits.fill_with_bits_of_field_element(pb, withdrawal.fee);
        fee.generate_r1cs_witness_from_bits();
        walletSplitPercentage.bits.fill_with_bits_of_field_element(pb, withdrawal.walletSplitPercentage);
        walletSplitPercentage.generate_r1cs_witness_from_bits();

        amountRequested.bits.fill_with_bits_of_field_element(pb, withdrawal.amount);
        amountRequested.generate_r1cs_witness_from_bits();

        padding.bits.fill_with_bits_of_field_element(pb, 0);
        padding.generate_r1cs_witness_from_bits();

        pb.val(walletId) = withdrawal.accountUpdate_A.before.walletId;

        nonce_before.bits.fill_with_bits_of_field_element(pb, withdrawal.accountUpdate_A.before.nonce);
        nonce_before.generate_r1cs_witness_from_bits();
        pb.val(nonce_after) = withdrawal.accountUpdate_A.after.nonce;

        pb.val(balancesRoot_before) = withdrawal.accountUpdate_A.before.balancesRoot;

        pb.val(tradingHistoryRootF_A) = withdrawal.balanceUpdateF_A.before.tradingHistoryRoot;
        pb.val(balanceF_A_before) = withdrawal.balanceUpdateF_A.before.balance;

        pb.val(tradingHistoryRootW_A) = withdrawal.balanceUpdateW_A.before.tradingHistoryRoot;
        pb.val(balanceW_A_before) = withdrawal.balanceUpdateW_A.before.balance;
        pb.val(balanceW_A_after) = withdrawal.balanceUpdateW_A.after.balance;

        pb.val(balancesRoot_W_before) = withdrawal.accountUpdate_W.before.balancesRoot;
        pb.val(balanceF_W_before) = withdrawal.balanceUpdateF_W.before.balance;
        pb.val(nonce_W) = withdrawal.accountUpdate_W.before.nonce;

        pb.val(dualAuthorWalletID) = withdrawal.accountUpdate_W.before.walletId;
        walletId_lt_MaxNumWallets.generate_r1cs_witness();
        pb.val(dualAuthorWalletID_T) = pb.val(walletId) + MAX_NUM_WALLETS;
        expectedDualAuthorWalletID.generate_r1cs_witness();

        pb.val(tradingHistoryRootF_O) = withdrawal.balanceUpdateF_O.before.tradingHistoryRoot;
        pb.val(balanceF_O_before) = withdrawal.balanceUpdateF_O.before.balance;

        feeToWallet.generate_r1cs_witness();
        pb.val(feeToOperator) = pb.val(fee.packed) - pb.val(feeToWallet.result());

        feePaymentWallet.generate_r1cs_witness();
        feePaymentOperator.generate_r1cs_witness();

        amountToWithdraw.generate_r1cs_witness();

        amountWithdrawn.bits.fill_with_bits_of_field_element(pb, (pb.val(balanceW_A_before) - pb.val(balanceW_A_after)));
        amountWithdrawn.generate_r1cs_witness_from_bits();

        updateBalanceF_A.generate_r1cs_witness(withdrawal.balanceUpdateF_A.proof);
        updateBalanceW_A.generate_r1cs_witness(withdrawal.balanceUpdateW_A.proof);
        updateAccount_A.generate_r1cs_witness(withdrawal.accountUpdate_A.proof);

        updateBalanceF_W.generate_r1cs_witness(withdrawal.balanceUpdateF_W.proof);
        updateAccount_W.generate_r1cs_witness(withdrawal.accountUpdate_W.proof);

        updateBalanceF_O.generate_r1cs_witness(withdrawal.balanceUpdateF_O.proof);

        if (!onchain)
        {
            signatureVerifier.generate_r1cs_witness(withdrawal.signature);
            walletSignatureVerifier.generate_r1cs_witness(withdrawal.walletSignature);
        }
    }

    void generate_r1cs_constraints()
    {
        padding.generate_r1cs_constraints(true);

        fee.generate_r1cs_constraints(true);
        nonce_before.generate_r1cs_constraints(true);

        feeToWallet.generate_r1cs_constraints();
        pb.add_r1cs_constraint(ConstraintT(feeToWallet.result() + feeToOperator, FieldT::one(), fee.packed), "feeToWallet + feeToOperator == fee");

        feePaymentWallet.generate_r1cs_constraints();
        feePaymentOperator.generate_r1cs_constraints();

        amountRequested.generate_r1cs_constraints(true);
        amountWithdrawn.generate_r1cs_constraints(true);

        amountToWithdraw.generate_r1cs_constraints();

        pb.add_r1cs_constraint(ConstraintT(balanceW_A_before, 1, balanceW_A_after + amountToWithdraw.result()), "balance_before == balance_after + amountToWithdraw");

        updateBalanceW_A.generate_r1cs_constraints();
        updateAccount_A.generate_r1cs_constraints();

        if (!onchain)
        {
            updateBalanceF_A.generate_r1cs_constraints();
            updateBalanceF_W.generate_r1cs_constraints();
            updateAccount_W.generate_r1cs_constraints();
            updateBalanceF_O.generate_r1cs_constraints();

            signatureVerifier.generate_r1cs_constraints();
            walletSignatureVerifier.generate_r1cs_constraints();
            pb.add_r1cs_constraint(ConstraintT(nonce_before.packed + FieldT::one(), FieldT::one(), nonce_after), "nonce_before + 1 == nonce_after");

            walletId_lt_MaxNumWallets.generate_r1cs_constraints();
            pb.add_r1cs_constraint(ConstraintT(walletId + MAX_NUM_WALLETS, FieldT::one(), dualAuthorWalletID_T), "feeToWallet + feeToOperator == dualAuthorWalletID_T");
            expectedDualAuthorWalletID.generate_r1cs_constraints();
            pb.add_r1cs_constraint(ConstraintT(dualAuthorWalletID, FieldT::one(), expectedDualAuthorWalletID.result()), "dualAuthorWalletID == expectedDualAuthorWalletID");
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

    libsnark::dual_variable_gadget<FieldT> stateId;
    libsnark::dual_variable_gadget<FieldT> merkleRootBefore;
    libsnark::dual_variable_gadget<FieldT> merkleRootAfter;

    VariableT constant0;
    VariableT nonce;

    libsnark::dual_variable_gadget<FieldT> withdrawalBlockHashStart;
    std::vector<VariableArrayT> withdrawalDataBits;
    std::vector<sha256_many> hashers;

    const jubjub::VariablePointT publicKey;
    libsnark::dual_variable_gadget<FieldT> operatorAccountId;
    VariableT balancesRoot_before;

    UpdateAccountGadget* updateAccount_O = nullptr;

    WithdrawCircuitGadget(ProtoboardT& pb, bool _onchain, const std::string& prefix) :
        GadgetT(pb, prefix),

        onchain(_onchain),

        publicDataHash(pb, 256, FMT(prefix, ".publicDataHash")),
        publicData(pb, publicDataHash, FMT(prefix, ".publicData")),

        stateId(pb, 32, FMT(prefix, ".stateId")),
        merkleRootBefore(pb, 256, FMT(prefix, ".merkleRootBefore")),
        merkleRootAfter(pb, 256, FMT(prefix, ".merkleRootAfter")),

        constant0(make_variable(pb, 0, FMT(prefix, ".constant0"))),
        operatorAccountId(pb, TREE_DEPTH_ACCOUNTS, FMT(prefix, ".operatorAccountId")),
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

        stateId.generate_r1cs_constraints(true);
        merkleRootBefore.generate_r1cs_constraints(true);
        merkleRootAfter.generate_r1cs_constraints(true);

        publicData.add(stateId.bits);
        publicData.add(merkleRootBefore.bits);
        publicData.add(merkleRootAfter.bits);
        publicData.add(operatorAccountId.bits);
        for (size_t j = 0; j < numAccounts; j++)
        {
            VariableT withdrawalAccountsRoot = (j == 0) ? merkleRootBefore.packed : withdrawals.back().getNewAccountsRoot();
            VariableT withdrawalOperatorBalancesRoot = (j == 0) ? balancesRoot_before : withdrawals.back().getNewOperatorBalancesRoot();
            withdrawals.emplace_back(pb, params, onchain, withdrawalAccountsRoot, withdrawalOperatorBalancesRoot, stateId.bits, std::string("withdrawals_") + std::to_string(j));
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

        operatorAccountId.generate_r1cs_constraints(true);

        if (onchain)
        {
             // Add the block hash
            publicData.add(flattenReverse({hashers.back().result().bits}));
        }
        else
        {
            publicData.add(withdrawalBlockHashStart.bits);

            updateAccount_O = new UpdateAccountGadget(pb, withdrawals.back().getNewAccountsRoot(), operatorAccountId.bits,
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
        stateId.bits.fill_with_bits_of_field_element(pb, context.stateId);
        stateId.generate_r1cs_witness_from_bits();

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

        operatorAccountId.bits.fill_with_bits_of_field_element(pb, context.operatorAccountId);
        operatorAccountId.generate_r1cs_witness_from_bits();

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
