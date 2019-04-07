#ifndef _ORDERCANCELLATIONCIRCUIT_H_
#define _ORDERCANCELLATIONCIRCUIT_H_

#include "../Utils/Constants.h"
#include "../Utils/Data.h"
#include "../Gadgets/AccountGadgets.h"
#include "../Gadgets/TradingHistoryGadgets.h"

#include "../ThirdParty/BigInt.hpp"
#include "ethsnarks.hpp"
#include "utils.hpp"
#include "jubjub/point.hpp"
#include "jubjub/eddsa.hpp"
#include "gadgets/sha256_many.hpp"

using namespace ethsnarks;

namespace Loopring
{

class OrderCancellationGadget : public GadgetT
{
public:

    const Constants& constants;

    const jubjub::VariablePointT publicKey;

    VariableArrayT accountID;
    VariableArrayT orderTokenID;
    libsnark::dual_variable_gadget<FieldT> orderID;
    VariableArrayT walletAccountID;
    VariableArrayT feeTokenID;
    libsnark::dual_variable_gadget<FieldT> fee;
    PercentageGadget walletSplitPercentage;

    VariableT filled;
    VariableT cancelled_before;
    VariableT cancelled_after;
    VariableT orderID_before;

    VariableT balanceT_A;
    VariableT tradingHistoryRootT_A_before;

    VariableT balanceF_A_before;
    VariableT tradingHistoryRootF_A;

    VariableT balancesRoot_W_before;
    VariableT balanceF_W_before;
    VariableT nonce_W;

    VariableT balanceF_O_before;
    VariableT tradingHistoryRootF_O;

    libsnark::dual_variable_gadget<FieldT> nonce_before;
    VariableT nonce_after;
    VariableT balancesRoot_before;

    MulDivGadget feeToWallet;
    VariableT feeToOperator;

    subadd_gadget feePaymentWallet;
    subadd_gadget feePaymentOperator;

    UpdateTradeHistoryGadget updateTradeHistory_A;
    UpdateBalanceGadget updateBalanceT_A;
    UpdateBalanceGadget updateBalanceF_A;
    UpdateAccountGadget updateAccount_A;

    UpdateBalanceGadget updateBalanceF_W;
    UpdateAccountGadget updateAccount_W;

    UpdateBalanceGadget updateBalanceF_O;

    ForceLeqGadget checkOrderID;

    const VariableArrayT message;
    SignatureVerifier signatureVerifier;

    OrderCancellationGadget(
        ProtoboardT& pb,
        const jubjub::Params& params,
        const Constants& _constants,
        const VariableT& _accountsMerkleRoot,
        const VariableT& _operatorBalancesRoot,
        const VariableArrayT& _realmID,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        constants(_constants),

        publicKey(pb, FMT(prefix, ".publicKey")),

        accountID(make_var_array(pb, TREE_DEPTH_ACCOUNTS, FMT(prefix, ".account"))),
        orderTokenID(make_var_array(pb, TREE_DEPTH_TOKENS, FMT(prefix, ".orderTokenID"))),
        orderID(pb, NUM_BITS_ORDERID, FMT(prefix, ".orderID")),
        walletAccountID(make_var_array(pb, TREE_DEPTH_ACCOUNTS, FMT(prefix, ".walletAccountID"))),
        feeTokenID(make_var_array(pb, TREE_DEPTH_TOKENS, FMT(prefix, ".feeTokenID"))),
        fee(pb, NUM_BITS_AMOUNT, FMT(prefix, ".fee")),
        walletSplitPercentage(pb, constants, FMT(prefix, ".walletSplitPercentage")),

        filled(make_variable(pb, 0, FMT(prefix, ".filled"))),
        cancelled_before(make_variable(pb, 0, FMT(prefix, ".cancelled_before"))),
        cancelled_after(make_variable(pb, 1, FMT(prefix, ".cancelled_after"))),
        orderID_before(make_variable(pb, 0, FMT(prefix, ".orderID_before"))),

        balanceT_A(make_variable(pb, FMT(prefix, ".balanceT_A"))),
        tradingHistoryRootT_A_before(make_variable(pb, FMT(prefix, ".tradingHistoryRootT_A_before"))),

        balanceF_A_before(make_variable(pb, FMT(prefix, ".balanceF_A_before"))),
        tradingHistoryRootF_A(make_variable(pb, FMT(prefix, ".tradingHistoryRootF_A"))),

        balancesRoot_W_before(make_variable(pb, FMT(prefix, ".balancesRoot_W_before"))),
        balanceF_W_before(make_variable(pb, FMT(prefix, ".balanceF_W_before"))),
        nonce_W(make_variable(pb, FMT(prefix, ".nonce_W"))),

        balanceF_O_before(make_variable(pb, FMT(prefix, ".balanceF_O_before"))),
        tradingHistoryRootF_O(make_variable(pb, FMT(prefix, ".tradingHistoryRootF_O"))),

        nonce_before(pb, NUM_BITS_NONCE, FMT(prefix, ".nonce_before")),
        nonce_after(make_variable(pb, 1, FMT(prefix, ".cancelled_after"))),
        balancesRoot_before(make_variable(pb, FMT(prefix, ".balancesRoot_before"))),

        // Fee payment calculations
        feeToWallet(pb, constants, fee.packed, walletSplitPercentage.value.packed, constants._100, FMT(prefix, ".feeToWallet")),
        feeToOperator(make_variable(pb, 1, FMT(prefix, ".feeToOperator"))),
        feePaymentWallet(pb, NUM_BITS_AMOUNT, balanceF_A_before, balanceF_W_before, feeToWallet.result(), FMT(prefix, ".feePaymentWallet")),
        feePaymentOperator(pb, NUM_BITS_AMOUNT, feePaymentWallet.X, balanceF_O_before, feeToOperator, FMT(prefix, ".feePaymentOperator")),

        // Trade history
        updateTradeHistory_A(pb, tradingHistoryRootT_A_before, subArray(orderID.bits, 0, TREE_DEPTH_TRADING_HISTORY),
                             {filled, cancelled_before, orderID_before},
                             {filled, cancelled_after, orderID.packed},
                             FMT(prefix, ".updateTradeHistory_A")),
        // Balance
        updateBalanceT_A(pb, balancesRoot_before, orderTokenID,
                         {balanceT_A, tradingHistoryRootT_A_before},
                         {balanceT_A, updateTradeHistory_A.getNewRoot()},
                         FMT(prefix, ".updateBalanceT_A")),
        // Balance Fee
        updateBalanceF_A(pb, updateBalanceT_A.getNewRoot(), feeTokenID,
                         {balanceF_A_before, tradingHistoryRootF_A},
                         {feePaymentOperator.X, tradingHistoryRootF_A},
                         FMT(prefix, ".updateBalanceF_A")),
        // Account
        updateAccount_A(pb, _accountsMerkleRoot, accountID,
                        {publicKey.x, publicKey.y, nonce_before.packed, balancesRoot_before},
                        {publicKey.x, publicKey.y, nonce_after, updateBalanceF_A.getNewRoot()},
                        FMT(prefix, ".updateAccount_A")),


        // Wallet balance
        updateBalanceF_W(pb, balancesRoot_W_before, feeTokenID,
                         {balanceF_W_before, constants.emptyTradeHistory},
                         {feePaymentWallet.Y, constants.emptyTradeHistory},
                         FMT(prefix, ".updateBalanceF_W")),
        // Wallet account
        updateAccount_W(pb, updateAccount_A.result(), walletAccountID,
                        {constants.one, constants.one, nonce_W, balancesRoot_W_before},
                        {constants.one, constants.one, nonce_W, updateBalanceF_W.getNewRoot()},
                        FMT(prefix, ".updateAccount_W")),

        // Operator balance
        updateBalanceF_O(pb, _operatorBalancesRoot, feeTokenID,
                         {balanceF_O_before, tradingHistoryRootF_O},
                         {feePaymentOperator.Y, tradingHistoryRootF_O},
                         FMT(prefix, ".updateBalanceF_O")),

        // OrderID check
        checkOrderID(pb, orderID_before, orderID.packed, NUM_BITS_ORDERID, FMT(prefix, ".checkOrderID")),

        // Signature
        message(flatten({_realmID, accountID, orderTokenID, orderID.bits, walletAccountID,
                         feeTokenID, fee.bits, walletSplitPercentage.value.bits,
                         nonce_before.bits, constants.padding_00})),
        signatureVerifier(pb, params, publicKey, message, FMT(prefix, ".signatureVerifier"))
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

    const std::vector<VariableArrayT> getPublicData() const
    {
        return {constants.accountPadding, accountID,
                constants.tokenPadding, orderTokenID,
                orderID.bits,
                constants.accountPadding, walletAccountID,
                constants.tokenPadding, feeTokenID,
                fee.bits,
                constants.padding_0, walletSplitPercentage.value.bits};
    }

    void generate_r1cs_witness(const Cancellation& cancellation)
    {
        pb.val(publicKey.x) = cancellation.accountUpdate_A.before.publicKey.x;
        pb.val(publicKey.y) = cancellation.accountUpdate_A.before.publicKey.y;

        accountID.fill_with_bits_of_field_element(pb, cancellation.accountUpdate_A.accountID);
        orderTokenID.fill_with_bits_of_field_element(pb, cancellation.balanceUpdateT_A.tokenID);
        orderID.bits.fill_with_bits_of_field_element(pb, cancellation.tradeHistoryUpdate_A.orderID);
        orderID.generate_r1cs_witness_from_bits();
        walletAccountID.fill_with_bits_of_field_element(pb, cancellation.accountUpdate_W.accountID);
        feeTokenID.fill_with_bits_of_field_element(pb, cancellation.balanceUpdateF_A.tokenID);
        fee.bits.fill_with_bits_of_field_element(pb, cancellation.fee);
        fee.generate_r1cs_witness_from_bits();
        walletSplitPercentage.generate_r1cs_witness(cancellation.walletSplitPercentage);

        pb.val(filled) = cancellation.tradeHistoryUpdate_A.before.filled;
        pb.val(cancelled_before) = cancellation.tradeHistoryUpdate_A.before.cancelled;
        pb.val(cancelled_after) = FieldT::one();
        pb.val(orderID_before) = cancellation.tradeHistoryUpdate_A.before.orderID;

        pb.val(balanceT_A) = cancellation.balanceUpdateT_A.before.balance;
        pb.val(tradingHistoryRootT_A_before) = cancellation.balanceUpdateT_A.before.tradingHistoryRoot;

        pb.val(balanceF_A_before) = cancellation.balanceUpdateF_A.before.balance;
        pb.val(tradingHistoryRootF_A) = cancellation.balanceUpdateF_A.before.tradingHistoryRoot;

        pb.val(balancesRoot_W_before) = cancellation.accountUpdate_W.before.balancesRoot;
        pb.val(balanceF_W_before) = cancellation.balanceUpdateF_W.before.balance;
        pb.val(nonce_W) = cancellation.accountUpdate_W.before.nonce;

        pb.val(balanceF_O_before) = cancellation.balanceUpdateF_O.before.balance;
        pb.val(tradingHistoryRootF_O) = cancellation.balanceUpdateF_O.before.tradingHistoryRoot;

        nonce_before.bits.fill_with_bits_of_field_element(pb, cancellation.accountUpdate_A.before.nonce);
        nonce_before.generate_r1cs_witness_from_bits();
        pb.val(nonce_after) = cancellation.accountUpdate_A.after.nonce;
        pb.val(balancesRoot_before) = cancellation.accountUpdate_A.before.balancesRoot;

        feeToWallet.generate_r1cs_witness();
        pb.val(feeToOperator) = pb.val(fee.packed) - pb.val(feeToWallet.result());

        feePaymentWallet.generate_r1cs_witness();
        feePaymentOperator.generate_r1cs_witness();

        updateTradeHistory_A.generate_r1cs_witness(cancellation.tradeHistoryUpdate_A.proof);
        updateBalanceT_A.generate_r1cs_witness(cancellation.balanceUpdateT_A.proof);
        updateBalanceF_A.generate_r1cs_witness(cancellation.balanceUpdateF_A.proof);
        updateAccount_A.generate_r1cs_witness(cancellation.accountUpdate_A.proof);

        updateBalanceF_W.generate_r1cs_witness(cancellation.balanceUpdateF_W.proof);
        updateAccount_W.generate_r1cs_witness(cancellation.accountUpdate_W.proof);

        updateBalanceF_O.generate_r1cs_witness(cancellation.balanceUpdateF_O.proof);

        checkOrderID.generate_r1cs_witness();

        signatureVerifier.generate_r1cs_witness(cancellation.signature);
    }

    void generate_r1cs_constraints()
    {
        fee.generate_r1cs_constraints(true);
        nonce_before.generate_r1cs_constraints(true);
        walletSplitPercentage.generate_r1cs_constraints();

        // Fee payment calculations
        feeToWallet.generate_r1cs_constraints();
        pb.add_r1cs_constraint(ConstraintT(feeToWallet.result() + feeToOperator, FieldT::one(), fee.packed), "feeToWallet + feeToOperator == fee");
        feePaymentWallet.generate_r1cs_constraints();
        feePaymentOperator.generate_r1cs_constraints();

        // Account
        updateTradeHistory_A.generate_r1cs_constraints();
        updateBalanceT_A.generate_r1cs_constraints();
        updateBalanceF_A.generate_r1cs_constraints();
        updateAccount_A.generate_r1cs_constraints();

        // Wallet
        updateBalanceF_W.generate_r1cs_constraints();
        updateAccount_W.generate_r1cs_constraints();

        // Operator
        updateBalanceF_O.generate_r1cs_constraints();

        // Signature
        signatureVerifier.generate_r1cs_constraints();

        // request.orderID >= tradeHistory.orderID
        checkOrderID.generate_r1cs_constraints();
        // Cancelled set to true
        pb.add_r1cs_constraint(ConstraintT(cancelled_after, FieldT::one(), FieldT::one()), "cancelled_after == 1");
        // Nonce increased by 1
        pb.add_r1cs_constraint(ConstraintT(nonce_before.packed + FieldT::one(), FieldT::one(), nonce_after), "nonce_before + 1 == nonce_after");
    }
};

class OrderCancellationCircuit : public GadgetT
{
public:
    jubjub::Params params;

    bool onchainDataAvailability;
    unsigned int numCancels;
    std::vector<OrderCancellationGadget> cancels;

    libsnark::dual_variable_gadget<FieldT> publicDataHash;
    PublicDataGadget publicData;

    Constants constants;

    libsnark::dual_variable_gadget<FieldT> realmID;
    libsnark::dual_variable_gadget<FieldT> merkleRootBefore;
    libsnark::dual_variable_gadget<FieldT> merkleRootAfter;

    libsnark::dual_variable_gadget<FieldT> operatorAccountID;
    const jubjub::VariablePointT publicKey;
    VariableT nonce;
    VariableT balancesRoot_before;
    UpdateAccountGadget* updateAccount_O = nullptr;

    OrderCancellationCircuit(ProtoboardT& pb, const std::string& prefix) :
        GadgetT(pb, prefix),

        publicDataHash(pb, 256, FMT(prefix, ".publicDataHash")),
        publicData(pb, publicDataHash, FMT(prefix, ".publicData")),

        constants(pb, FMT(prefix, ".constants")),

        realmID(pb, 32, FMT(prefix, ".realmID")),
        merkleRootBefore(pb, 256, FMT(prefix, ".merkleRootBefore")),
        merkleRootAfter(pb, 256, FMT(prefix, ".merkleRootAfter")),

        operatorAccountID(pb, TREE_DEPTH_ACCOUNTS, FMT(prefix, ".operatorAccountID")),
        publicKey(pb, FMT(prefix, ".publicKey")),
        nonce(make_variable(pb, 0, FMT(prefix, ".nonce"))),
        balancesRoot_before(make_variable(pb, 0, FMT(prefix, ".balancesRoot_before")))
    {

    }

    ~OrderCancellationCircuit()
    {
        if (updateAccount_O)
        {
            delete updateAccount_O;
        }
    }

    void generate_r1cs_constraints(bool onchainDataAvailability, int numCancels)
    {
        this->onchainDataAvailability = onchainDataAvailability;
        this->numCancels = numCancels;

        pb.set_input_sizes(1);

        constants.generate_r1cs_constraints();

        publicData.add(realmID.bits);
        publicData.add(merkleRootBefore.bits);
        publicData.add(merkleRootAfter.bits);
        if (onchainDataAvailability)
        {
            publicData.add(constants.accountPadding);
            publicData.add(operatorAccountID.bits);
        }
        for (size_t j = 0; j < numCancels; j++)
        {
            VariableT cancelAccountsRoot = (j == 0) ? merkleRootBefore.packed : cancels.back().getNewAccountsRoot();
            VariableT cancelOperatorBalancesRoot = (j == 0) ? balancesRoot_before : cancels.back().getNewOperatorBalancesRoot();
            cancels.emplace_back(
                pb,
                params,
                constants,
                cancelAccountsRoot,
                cancelOperatorBalancesRoot,
                realmID.bits,
                std::string("cancels_") + std::to_string(j)
            );
            cancels.back().generate_r1cs_constraints();

            if (onchainDataAvailability)
            {
                // Store data from cancellation
                std::vector<VariableArrayT> ringPublicData = cancels.back().getPublicData();
                publicData.add(cancels.back().getPublicData());
            }
        }

        // Update operator account
        operatorAccountID.generate_r1cs_constraints(true);
        updateAccount_O = new UpdateAccountGadget(pb, cancels.back().getNewAccountsRoot(), operatorAccountID.bits,
                {publicKey.x, publicKey.y, nonce, balancesRoot_before},
                {publicKey.x, publicKey.y, nonce, cancels.back().getNewOperatorBalancesRoot()},
                FMT(annotation_prefix, ".updateAccount_O"));
        updateAccount_O->generate_r1cs_constraints();

        // Check the input hash
        publicDataHash.generate_r1cs_constraints(true);
        publicData.generate_r1cs_constraints();

        // Check the new merkle root
        forceEqual(pb, updateAccount_O->result(), merkleRootAfter.packed, "newMerkleRoot");
    }

    void printInfo()
    {
        std::cout << pb.num_constraints() << " constraints (" << (pb.num_constraints() / numCancels) << "/cancel)" << std::endl;
    }

    bool generateWitness(const Loopring::OrderCancellationBlock& block)
    {
        constants.generate_r1cs_witness();

        realmID.bits.fill_with_bits_of_field_element(pb, block.realmID);
        realmID.generate_r1cs_witness_from_bits();

        merkleRootBefore.bits.fill_with_bits_of_field_element(pb, block.merkleRootBefore);
        merkleRootBefore.generate_r1cs_witness_from_bits();
        merkleRootAfter.bits.fill_with_bits_of_field_element(pb, block.merkleRootAfter);
        merkleRootAfter.generate_r1cs_witness_from_bits();

        pb.val(balancesRoot_before) = block.accountUpdate_O.before.balancesRoot;

        for(unsigned int i = 0; i < block.cancels.size(); i++)
        {
            cancels[i].generate_r1cs_witness(block.cancels[i]);
        }

        operatorAccountID.bits.fill_with_bits_of_field_element(pb, block.operatorAccountID);
        operatorAccountID.generate_r1cs_witness_from_bits();
        pb.val(publicKey.x) = block.accountUpdate_O.before.publicKey.x;
        pb.val(publicKey.y) = block.accountUpdate_O.before.publicKey.y;
        pb.val(nonce) = block.accountUpdate_O.before.nonce;

        updateAccount_O->generate_r1cs_witness(block.accountUpdate_O.proof);

        publicData.generate_r1cs_witness();

        return true;
    }
};

}

#endif
