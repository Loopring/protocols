#ifndef _RINGSETTLEMENTCIRCUIT_H_
#define _RINGSETTLEMENTCIRCUIT_H_

#include "../Utils/Constants.h"
#include "../Utils/Data.h"
#include "../Utils/Utils.h"
#include "../Gadgets/MatchingGadgets.h"
#include "../Gadgets/AccountGadgets.h"
#include "../Gadgets/TradingHistoryGadgets.h"
#include "../Gadgets/MathGadgets.h"

#include "ethsnarks.hpp"
#include "utils.hpp"
#include "gadgets/subadd.hpp"

using namespace ethsnarks;

namespace Loopring
{

class RingSettlementGadget : public GadgetT
{
public:

    const Constants& constants;

    const VariableT accountsRoot;

    const VariableT tradingHistoryRootS_A;
    const VariableT tradingHistoryRootB_A;
    const VariableT tradingHistoryRootF_A;
    const VariableT tradingHistoryRootS_B;
    const VariableT tradingHistoryRootB_B;
    const VariableT tradingHistoryRootF_B;

    const VariableT balancesRootA;
    const VariableT balancesRootB;
    const VariableT balancesRootAW;
    const VariableT balancesRootBW;
    const VariableT balancesRootF;
    const VariableT balancesRootM;

    VariableT blockRealmID;

    const jubjub::VariablePointT publicKey;
    libsnark::dual_variable_gadget<FieldT> minerAccountID;
    libsnark::dual_variable_gadget<FieldT> feeRecipientAccountID;
    VariableArrayT tokenID;
    libsnark::dual_variable_gadget<FieldT> fee;
    libsnark::dual_variable_gadget<FieldT> nonce_before;
    VariableT nonce_after;

    VariableT feeRecipientNonce;

    OrderGadget orderA;
    OrderGadget orderB;

    OrderMatchingGadget orderMatching;

    libsnark::dual_variable_gadget<FieldT> fillS_A;
    libsnark::dual_variable_gadget<FieldT> fillB_A;
    libsnark::dual_variable_gadget<FieldT> fillF_A;
    libsnark::dual_variable_gadget<FieldT> fillS_B;
    libsnark::dual_variable_gadget<FieldT> fillB_B;
    libsnark::dual_variable_gadget<FieldT> fillF_B;
    libsnark::dual_variable_gadget<FieldT> margin;

    VariableT filledAfterA;
    VariableT filledAfterB;

    FeePaymentCalculator feePaymentA;
    FeePaymentCalculator feePaymentB;

    VariableT balanceS_A_before;
    VariableT balanceB_A_before;
    VariableT balanceF_A_before;

    VariableT balanceS_B_before;
    VariableT balanceB_B_before;
    VariableT balanceF_B_before;

    VariableT balanceA_W_before;
    VariableT balanceB_W_before;

    VariableT balanceA_F_before;
    VariableT balanceB_F_before;

    VariableT balanceM_M_before;
    VariableT balanceO_M_before;

    VariableT balanceF_O_before;

    subadd_gadget balanceSB_A;
    subadd_gadget balanceSB_B;

    subadd_gadget balanceF_WA;
    subadd_gadget balanceF_WB;

    subadd_gadget balanceF_MA;
    subadd_gadget balanceF_MB;

    subadd_gadget balanceS_MA;
    subadd_gadget balance_M;

    UpdateTradeHistoryGadget updateTradeHistoryA;
    UpdateTradeHistoryGadget updateTradeHistoryB;

    UpdateBalanceGadget updateBalanceS_A;
    UpdateBalanceGadget updateBalanceB_A;
    UpdateBalanceGadget updateBalanceF_A;
    VariableT nonce_A;
    UpdateAccountGadget updateAccount_A;

    UpdateBalanceGadget updateBalanceS_B;
    UpdateBalanceGadget updateBalanceB_B;
    UpdateBalanceGadget updateBalanceF_B;
    VariableT nonce_B;
    UpdateAccountGadget updateAccount_B;

    VariableT nonce_WA;
    VariableT balancesRoot_WA;
    UpdateBalanceGadget updateBalanceA_W;
    UpdateAccountGadget updateAccountA_W;
    VariableT nonce_WB;
    VariableT balancesRoot_WB;
    UpdateBalanceGadget updateBalanceB_W;
    UpdateAccountGadget updateAccountB_W;

    UpdateBalanceGadget updateBalanceA_F;
    UpdateBalanceGadget updateBalanceB_F;
    UpdateAccountGadget updateAccount_F;

    UpdateBalanceGadget updateBalanceM_M;
    UpdateBalanceGadget updateBalanceO_M;
    UpdateAccountGadget updateAccount_M;

    UpdateBalanceGadget updateBalanceF_O;

    const VariableArrayT message;
    SignatureVerifier minerSignatureVerifier;
    SignatureVerifier dualAuthASignatureVerifier;
    SignatureVerifier dualAuthBSignatureVerifier;

    RingSettlementGadget(
        ProtoboardT& pb,
        const jubjub::Params& params,
        const Constants& _constants,
        const VariableT& _realmID,
        const VariableT& _accountsRoot,
        const VariableT& _timestamp,
        const VariableT& _operatorBalancesRoot,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        constants(_constants),

        publicKey(pb, FMT(prefix, ".publicKey")),
        minerAccountID(pb, NUM_BITS_ACCOUNT, FMT(prefix, ".minerAccountID")),
        feeRecipientAccountID(pb, NUM_BITS_ACCOUNT, FMT(prefix, ".feeRecipientAccountID")),
        tokenID(make_var_array(pb, TREE_DEPTH_TOKENS, FMT(prefix, ".tokenID"))),
        fee(pb, NUM_BITS_AMOUNT, FMT(prefix, ".fee")),
        nonce_before(pb, NUM_BITS_NONCE, FMT(prefix, ".nonce_before")),
        nonce_after(make_variable(pb, FMT(prefix, ".nonce_after"))),
        feeRecipientNonce(make_variable(pb, FMT(prefix, ".feeRecipientNonce"))),

        orderA(pb, params, constants, _realmID, FMT(prefix, ".orderA")),
        orderB(pb, params, constants, _realmID, FMT(prefix, ".orderB")),

        // Match orders
        orderMatching(pb, constants, _timestamp, orderA, orderB, FMT(prefix, ".orderMatching")),

        // Fill amounts
        fillS_A(pb, NUM_BITS_AMOUNT, FMT(prefix, ".fillS_A")),
        fillB_A(pb, NUM_BITS_AMOUNT, FMT(prefix, ".fillB_A")),
        fillF_A(pb, NUM_BITS_AMOUNT, FMT(prefix, ".fillF_A")),
        fillS_B(pb, NUM_BITS_AMOUNT, FMT(prefix, ".fillS_B")),
        fillB_B(pb, NUM_BITS_AMOUNT, FMT(prefix, ".fillB_B")),
        fillF_B(pb, NUM_BITS_AMOUNT, FMT(prefix, ".fillF_B")),
        margin(pb, NUM_BITS_AMOUNT, FMT(prefix, ".margin")),

        // Filled amounts
        filledAfterA(make_variable(pb, FMT(prefix, ".filledAfterA"))),
        filledAfterB(make_variable(pb, FMT(prefix, ".filledAfterB"))),

        // Calculate fees
        feePaymentA(pb, constants, fillF_A.packed, orderA.walletSplitPercentage.value.packed, orderA.waiveFeePercentage.value.packed, FMT(prefix, "feePaymentA")),
        feePaymentB(pb, constants, fillF_B.packed, orderB.walletSplitPercentage.value.packed, orderB.waiveFeePercentage.value.packed, FMT(prefix, "feePaymentB")),

        // Balances before
        balanceS_A_before(make_variable(pb, FMT(prefix, ".balanceS_A_before"))),
        balanceB_A_before(make_variable(pb, FMT(prefix, ".balanceB_A_before"))),
        balanceF_A_before(make_variable(pb, FMT(prefix, ".balanceF_A_before"))),

        balanceS_B_before(make_variable(pb, FMT(prefix, ".balanceS_B_before"))),
        balanceB_B_before(make_variable(pb, FMT(prefix, ".balanceB_B_before"))),
        balanceF_B_before(make_variable(pb, FMT(prefix, ".balanceF_B_before"))),

        balanceA_W_before(make_variable(pb, FMT(prefix, ".balanceA_W_before"))),
        balanceB_W_before(make_variable(pb, FMT(prefix, ".balanceB_W_before"))),

        balanceA_F_before(make_variable(pb, FMT(prefix, ".balanceA_F_before"))),
        balanceB_F_before(make_variable(pb, FMT(prefix, ".balanceB_F_before"))),

        balanceM_M_before(make_variable(pb, FMT(prefix, ".balanceM_M_before"))),
        balanceO_M_before(make_variable(pb, FMT(prefix, ".balanceO_M_before"))),

        balanceF_O_before(make_variable(pb, FMT(prefix, ".balanceF_O_before"))),

        // Calculate new balances
        // fillB_B == fillS_A - margin
        balanceSB_A(pb, NUM_BITS_AMOUNT, balanceS_A_before, balanceB_B_before, fillB_B.packed, FMT(prefix, ".balanceSB_A")),
        balanceSB_B(pb, NUM_BITS_AMOUNT, balanceS_B_before, balanceB_A_before, fillS_B.packed, FMT(prefix, ".balanceSB_B")),

        balanceF_WA(pb, NUM_BITS_AMOUNT, balanceF_A_before, balanceA_W_before, feePaymentA.getWalletFee(), FMT(prefix, ".balanceF_WA")),
        balanceF_WB(pb, NUM_BITS_AMOUNT, balanceF_B_before, balanceB_W_before, feePaymentB.getWalletFee(), FMT(prefix, ".balanceF_WB")),

        balanceF_MA(pb, NUM_BITS_AMOUNT, balanceF_WA.X, balanceA_F_before, feePaymentA.getMatchingFee(), FMT(prefix, ".balanceA_F")),
        balanceF_MB(pb, NUM_BITS_AMOUNT, balanceF_WB.X, balanceB_F_before, feePaymentB.getMatchingFee(), FMT(prefix, ".balanceB_F")),

        balanceS_MA(pb, NUM_BITS_AMOUNT, balanceSB_A.X, balanceM_M_before, margin.packed, FMT(prefix, ".balanceS_MA")),

        balance_M(pb, NUM_BITS_AMOUNT, balanceO_M_before, balanceF_O_before, fee.packed, FMT(prefix, ".balance_M")),

        // Initial trading history roots
        tradingHistoryRootS_A(make_variable(pb, FMT(prefix, ".tradingHistoryRootS_A"))),
        tradingHistoryRootB_A(make_variable(pb, FMT(prefix, ".tradingHistoryRootB_A"))),
        tradingHistoryRootF_A(make_variable(pb, FMT(prefix, ".tradingHistoryRootF_A"))),
        tradingHistoryRootS_B(make_variable(pb, FMT(prefix, ".tradingHistoryRootS_B"))),
        tradingHistoryRootB_B(make_variable(pb, FMT(prefix, ".tradingHistoryRootB_B"))),
        tradingHistoryRootF_B(make_variable(pb, FMT(prefix, ".tradingHistoryRootF_B"))),

        // Initial balances roots
        balancesRootA(make_variable(pb, FMT(prefix, ".balancesRootA"))),
        balancesRootB(make_variable(pb, FMT(prefix, ".balancesRootB"))),
        balancesRootAW(make_variable(pb, FMT(prefix, ".balancesRootAW"))),
        balancesRootBW(make_variable(pb, FMT(prefix, ".balancesRootBW"))),
        balancesRootF(make_variable(pb, FMT(prefix, ".balancesRootF"))),
        balancesRootM(make_variable(pb, FMT(prefix, ".balancesRootM"))),

        // Update trading history
        updateTradeHistoryA(pb, tradingHistoryRootS_A, subArray(orderA.orderID.bits, 0, TREE_DEPTH_TRADING_HISTORY),
                            {orderA.tradeHistoryFilled, orderA.tradeHistoryCancelled, orderA.tradeHistoryOrderID},
                            {filledAfterA, orderA.tradeHistory.getCancelledToStore(), orderA.tradeHistory.getOrderIDToStore()},
                            FMT(prefix, ".updateTradeHistoryA")),
        updateTradeHistoryB(pb, tradingHistoryRootS_B, subArray(orderB.orderID.bits, 0, TREE_DEPTH_TRADING_HISTORY),
                            {orderB.tradeHistoryFilled, orderB.tradeHistoryCancelled, orderB.tradeHistoryOrderID},
                            {filledAfterB, orderB.tradeHistory.getCancelledToStore(), orderB.tradeHistory.getOrderIDToStore()},
                            FMT(prefix, ".updateTradeHistoryB")),

        accountsRoot(_accountsRoot),

        // Update OwnerA
        updateBalanceS_A(pb, balancesRootA, orderA.tokenS.bits,
                         {balanceS_A_before, tradingHistoryRootS_A},
                         {balanceS_MA.X, updateTradeHistoryA.getNewRoot()},
                         FMT(prefix, ".updateBalanceS_A")),
        updateBalanceB_A(pb, updateBalanceS_A.getNewRoot(), orderA.tokenB.bits,
                         {balanceB_A_before, tradingHistoryRootB_A},
                         {balanceSB_B.Y, tradingHistoryRootB_A},
                         FMT(prefix, ".updateBalanceB_A")),
        updateBalanceF_A(pb, updateBalanceB_A.getNewRoot(), orderA.tokenF.bits,
                         {balanceF_A_before, tradingHistoryRootF_A},
                         {balanceF_MA.X, tradingHistoryRootF_A},
                         FMT(prefix, ".updateBalanceF_A")),
        nonce_A(make_variable(pb, FMT(prefix, ".nonce_A"))),
        updateAccount_A(pb, _accountsRoot, orderA.accountID.bits,
                        {orderA.publicKey.x, orderA.publicKey.y, nonce_A, balancesRootA},
                        {orderA.publicKey.x, orderA.publicKey.y, nonce_A, updateBalanceF_A.getNewRoot()},
                        FMT(prefix, ".updateAccount_A")),

        // Update OwnerB
        updateBalanceS_B(pb, balancesRootB, orderB.tokenS.bits,
                         {balanceS_B_before, tradingHistoryRootS_B},
                         {balanceSB_B.X, updateTradeHistoryB.getNewRoot()},
                         FMT(prefix, ".updateBalanceS_B")),
        updateBalanceB_B(pb, updateBalanceS_B.getNewRoot(), orderB.tokenB.bits,
                         {balanceB_B_before, tradingHistoryRootB_B},
                         {balanceSB_A.Y, tradingHistoryRootB_B},
                         FMT(prefix, ".updateBalanceB_B")),
        updateBalanceF_B(pb, updateBalanceB_B.getNewRoot(), orderB.tokenF.bits,
                         {balanceF_B_before, tradingHistoryRootF_B},
                         {balanceF_MB.X, tradingHistoryRootF_B},
                         FMT(prefix, ".updateBalanceF_B")),
        nonce_B(make_variable(pb, FMT(prefix, ".nonce_B"))),
        updateAccount_B(pb, updateAccount_A.result(), orderB.accountID.bits,
                        {orderB.publicKey.x, orderB.publicKey.y, nonce_B, balancesRootB},
                        {orderB.publicKey.x, orderB.publicKey.y, nonce_B, updateBalanceF_B.getNewRoot()},
                        FMT(prefix, ".updateAccount_B")),

        // Update WalletA
        nonce_WA(make_variable(pb, FMT(prefix, ".nonce_WA"))),
        balancesRoot_WA(make_variable(pb, FMT(prefix, ".balancesRoot_WA"))),
        updateBalanceA_W(pb, balancesRootAW, orderA.tokenF.bits,
                        {balanceA_W_before, constants.emptyTradeHistory},
                        {balanceF_WA.Y, constants.emptyTradeHistory},
                        FMT(prefix, ".updateBalanceA_W")),
        updateAccountA_W(pb, updateAccount_B.result(), orderA.walletAccountID,
                         {constants.one, constants.one, nonce_WA, balancesRoot_WA},
                         {constants.one, constants.one, nonce_WA, updateBalanceA_W.getNewRoot()},
                         FMT(prefix, ".updateAccountA_W")),

        // Update WalletB
        nonce_WB(make_variable(pb, FMT(prefix, ".nonce_WB"))),
        balancesRoot_WB(make_variable(pb, FMT(prefix, ".balancesRoot_WB"))),
        updateBalanceB_W(pb, balancesRootBW, orderB.tokenF.bits,
                        {balanceB_W_before, constants.emptyTradeHistory},
                        {balanceF_WB.Y, constants.emptyTradeHistory},
                        FMT(prefix, ".updateBalanceB_W")),
        updateAccountB_W(pb, updateAccountA_W.result(), orderB.walletAccountID,
                         {constants.one, constants.one, nonce_WB, balancesRoot_WB},
                         {constants.one, constants.one, nonce_WB, updateBalanceB_W.getNewRoot()},
                         FMT(prefix, ".updateAccountB_W")),

        // Update FeeRecipient
        updateBalanceA_F(pb, balancesRootF, orderA.tokenF.bits,
                        {balanceA_F_before, constants.emptyTradeHistory},
                        {balanceF_MA.Y, constants.emptyTradeHistory},
                        FMT(prefix, ".updateBalanceA_F")),
        updateBalanceB_F(pb, updateBalanceA_F.getNewRoot(), orderB.tokenF.bits,
                        {balanceB_F_before, constants.emptyTradeHistory},
                        {balanceF_MB.Y, constants.emptyTradeHistory},
                        FMT(prefix, ".updateBalanceB_F")),
        updateAccount_F(pb, updateAccountB_W.result(), feeRecipientAccountID.bits,
                        {constants.one, constants.one, feeRecipientNonce, balancesRootF},
                        {constants.one, constants.one, feeRecipientNonce, updateBalanceB_F.getNewRoot()},
                        FMT(prefix, ".updateAccount_M")),

        // Update Ring-Matcher
        updateBalanceM_M(pb, balancesRootM, orderA.tokenS.bits,
                        {balanceM_M_before, constants.emptyTradeHistory},
                        {balanceS_MA.Y, constants.emptyTradeHistory},
                        FMT(prefix, ".updateBalanceF_M")),
        updateBalanceO_M(pb, updateBalanceM_M.getNewRoot(), tokenID,
                        {balanceO_M_before, constants.emptyTradeHistory},
                        {balance_M.X, constants.emptyTradeHistory},
                        FMT(prefix, ".updateBalanceO_M")),
        updateAccount_M(pb, updateAccount_F.result(), minerAccountID.bits,
                        {publicKey.x, publicKey.y, nonce_before.packed, balancesRootM},
                        {publicKey.x, publicKey.y, nonce_after, updateBalanceO_M.getNewRoot()},
                        FMT(prefix, ".updateAccount_M")),

        // Update Operator
        updateBalanceF_O(pb, _operatorBalancesRoot, tokenID,
                         {balanceF_O_before, constants.emptyTradeHistory},
                         {balance_M.Y, constants.emptyTradeHistory},
                         FMT(prefix, ".updateBalanceF_O")),

        // Signatures
        message(flatten({orderA.getHash(), orderB.getHash(),
                         orderA.waiveFeePercentage.value.bits, orderB.waiveFeePercentage.value.bits,
                         minerAccountID.bits, tokenID, fee.bits,
                         feeRecipientAccountID.bits,
                         nonce_before.bits})),
        minerSignatureVerifier(pb, params, publicKey, message, FMT(prefix, ".minerSignatureVerifier")),
        dualAuthASignatureVerifier(pb, params, orderA.dualAuthPublicKey, message, FMT(prefix, ".dualAuthASignatureVerifier")),
        dualAuthBSignatureVerifier(pb, params, orderB.dualAuthPublicKey, message, FMT(prefix, ".dualAuthBSignatureVerifier"))
    {

    }

    const VariableT getNewAccountsRoot() const
    {
        return updateAccount_M.result();
    }

    const VariableT getNewOperatorBalancesRoot() const
    {
        return updateBalanceF_O.getNewRoot();
    }

    const std::vector<VariableArrayT> getPublicData() const
    {
        return
        {
            constants.accountPadding, minerAccountID.bits,
            constants.accountPadding, feeRecipientAccountID.bits,
            constants.tokenPadding, tokenID,
            fee.bits,

            margin.bits,

            constants.accountPadding, orderA.accountID.bits,
            constants.accountPadding, orderA.walletAccountID,
            constants.tokenPadding, orderA.tokenS.bits,
            constants.tokenPadding, orderA.tokenF.bits,
            orderA.orderID.bits,
            fillS_A.bits,
            fillF_A.bits,
            constants.padding_0, orderA.walletSplitPercentage.value.bits,
            constants.padding_0, orderA.waiveFeePercentage.value.bits,

            constants.accountPadding, orderB.accountID.bits,
            constants.accountPadding, orderB.walletAccountID,
            constants.tokenPadding, orderB.tokenS.bits,
            constants.tokenPadding, orderB.tokenF.bits,
            orderB.orderID.bits,
            fillS_B.bits,
            fillF_B.bits,
            constants.padding_0, orderB.walletSplitPercentage.value.bits,
            constants.padding_0, orderB.waiveFeePercentage.value.bits
        };
    }

    void generate_r1cs_witness (const RingSettlement& ringSettlement)
    {
        pb.val(publicKey.x) = ringSettlement.accountUpdate_M.before.publicKey.x;
        pb.val(publicKey.y) = ringSettlement.accountUpdate_M.before.publicKey.y;

        minerAccountID.bits.fill_with_bits_of_field_element(pb, ringSettlement.ring.minerAccountID);
        minerAccountID.generate_r1cs_witness_from_bits();
        feeRecipientAccountID.bits.fill_with_bits_of_field_element(pb, ringSettlement.ring.feeRecipientAccountID);
        feeRecipientAccountID.generate_r1cs_witness_from_bits();
        tokenID.fill_with_bits_of_field_element(pb, ringSettlement.ring.tokenID);
        fee.bits.fill_with_bits_of_field_element(pb, ringSettlement.ring.fee);
        fee.generate_r1cs_witness_from_bits();
        nonce_before.bits.fill_with_bits_of_field_element(pb, ringSettlement.ring.nonce);
        nonce_before.generate_r1cs_witness_from_bits();
        pb.val(nonce_after) = ringSettlement.ring.nonce + 1;
        pb.val(feeRecipientNonce) = ringSettlement.accountUpdate_F.before.nonce;

        orderA.generate_r1cs_witness(ringSettlement.ring.orderA);
        orderB.generate_r1cs_witness(ringSettlement.ring.orderB);

        // Match orders
        orderMatching.generate_r1cs_witness();

        // Fill amounts
        fillS_A.bits.fill_with_bits_of_field_element(pb, ringSettlement.ring.fillS_A);
        fillS_A.generate_r1cs_witness_from_bits();
        fillB_A.bits.fill_with_bits_of_field_element(pb, ringSettlement.ring.fillB_A);
        fillB_A.generate_r1cs_witness_from_bits();
        fillF_A.bits.fill_with_bits_of_field_element(pb, ringSettlement.ring.fillF_A);
        fillF_A.generate_r1cs_witness_from_bits();
        fillS_B.bits.fill_with_bits_of_field_element(pb, ringSettlement.ring.fillS_B);
        fillS_B.generate_r1cs_witness_from_bits();
        fillB_B.bits.fill_with_bits_of_field_element(pb, ringSettlement.ring.fillB_B);
        fillB_B.generate_r1cs_witness_from_bits();
        fillF_B.bits.fill_with_bits_of_field_element(pb, ringSettlement.ring.fillF_B);
        fillF_B.generate_r1cs_witness_from_bits();
        margin.bits.fill_with_bits_of_field_element(pb, ringSettlement.ring.margin);
        margin.generate_r1cs_witness_from_bits();

        // Filled amounts
        pb.val(filledAfterA) = pb.val(orderA.tradeHistory.getFilled()) + pb.val(fillS_A.packed);
        pb.val(filledAfterB) = pb.val(orderB.tradeHistory.getFilled()) + pb.val(fillS_B.packed);

        // Calculate fees
        feePaymentA.generate_r1cs_witness();
        feePaymentB.generate_r1cs_witness();

        // Balances before
        pb.val(balanceS_A_before) = ringSettlement.balanceUpdateS_A.before.balance;
        pb.val(balanceB_A_before) = ringSettlement.balanceUpdateB_A.before.balance;
        pb.val(balanceF_A_before) = ringSettlement.balanceUpdateF_A.before.balance;

        pb.val(balanceS_B_before) = ringSettlement.balanceUpdateS_B.before.balance;
        pb.val(balanceB_B_before) = ringSettlement.balanceUpdateB_B.before.balance;
        pb.val(balanceF_B_before) = ringSettlement.balanceUpdateF_B.before.balance;

        pb.val(balanceA_W_before) = ringSettlement.balanceUpdateA_W.before.balance;
        pb.val(balanceB_W_before) = ringSettlement.balanceUpdateB_W.before.balance;

        pb.val(balanceA_F_before) = ringSettlement.balanceUpdateA_F.before.balance;
        pb.val(balanceB_F_before) = ringSettlement.balanceUpdateB_F.before.balance;

        pb.val(balanceM_M_before) = ringSettlement.balanceUpdateM_M.before.balance;
        pb.val(balanceO_M_before) = ringSettlement.balanceUpdateO_M.before.balance;

        pb.val(balanceF_O_before) = ringSettlement.balanceUpdateF_O.before.balance;

        // Calculate new balances
        balanceSB_A.generate_r1cs_witness();
        balanceSB_B.generate_r1cs_witness();
        balanceF_WA.generate_r1cs_witness();
        balanceF_MA.generate_r1cs_witness();
        balanceF_WB.generate_r1cs_witness();
        balanceF_MB.generate_r1cs_witness();
        balanceS_MA.generate_r1cs_witness();
        balance_M.generate_r1cs_witness();

        // Initial trading history roots
        pb.val(tradingHistoryRootS_A) = ringSettlement.balanceUpdateS_A.before.tradingHistoryRoot;
        pb.val(tradingHistoryRootB_A) = ringSettlement.balanceUpdateB_A.before.tradingHistoryRoot;
        pb.val(tradingHistoryRootF_A) = ringSettlement.balanceUpdateF_A.before.tradingHistoryRoot;
        pb.val(tradingHistoryRootS_B) = ringSettlement.balanceUpdateS_B.before.tradingHistoryRoot;
        pb.val(tradingHistoryRootB_B) = ringSettlement.balanceUpdateB_B.before.tradingHistoryRoot;
        pb.val(tradingHistoryRootF_B) = ringSettlement.balanceUpdateF_B.before.tradingHistoryRoot;

        // Initial balances roots
        pb.val(balancesRootA) = ringSettlement.balanceUpdateS_A.rootBefore;
        pb.val(balancesRootB) = ringSettlement.balanceUpdateS_B.rootBefore;
        pb.val(balancesRootAW) = ringSettlement.balanceUpdateA_W.rootBefore;
        pb.val(balancesRootBW) = ringSettlement.balanceUpdateB_W.rootBefore;
        pb.val(balancesRootF) = ringSettlement.balanceUpdateA_F.rootBefore;
        pb.val(balancesRootM) = ringSettlement.balanceUpdateM_M.rootBefore;

        // Update trading history
        updateTradeHistoryA.generate_r1cs_witness(ringSettlement.tradeHistoryUpdate_A.proof);
        updateTradeHistoryB.generate_r1cs_witness(ringSettlement.tradeHistoryUpdate_B.proof);

        // Update OwnerA
        pb.val(nonce_A) = ringSettlement.accountUpdate_A.before.nonce;
        updateBalanceS_A.generate_r1cs_witness(ringSettlement.balanceUpdateS_A.proof);
        updateBalanceB_A.generate_r1cs_witness(ringSettlement.balanceUpdateB_A.proof);
        updateBalanceF_A.generate_r1cs_witness(ringSettlement.balanceUpdateF_A.proof);
        updateAccount_A.generate_r1cs_witness(ringSettlement.accountUpdate_A.proof);

        // Update OwnerB
        pb.val(nonce_B) = ringSettlement.accountUpdate_B.before.nonce;
        updateBalanceS_B.generate_r1cs_witness(ringSettlement.balanceUpdateS_B.proof);
        updateBalanceB_B.generate_r1cs_witness(ringSettlement.balanceUpdateB_B.proof);
        updateBalanceF_B.generate_r1cs_witness(ringSettlement.balanceUpdateF_B.proof);
        updateAccount_B.generate_r1cs_witness(ringSettlement.accountUpdate_B.proof);

        // Update WalletA
        pb.val(nonce_WA) = ringSettlement.accountUpdateA_W.before.nonce;
        pb.val(balancesRoot_WA) = ringSettlement.accountUpdateA_W.before.balancesRoot;
        updateBalanceA_W.generate_r1cs_witness(ringSettlement.balanceUpdateA_W.proof);
        updateAccountA_W.generate_r1cs_witness(ringSettlement.accountUpdateA_W.proof);

        // Update WalletB
        pb.val(nonce_WB) = ringSettlement.accountUpdateB_W.before.nonce;
        pb.val(balancesRoot_WB) = ringSettlement.accountUpdateB_W.before.balancesRoot;
        updateBalanceB_W.generate_r1cs_witness(ringSettlement.balanceUpdateB_W.proof);
        updateAccountB_W.generate_r1cs_witness(ringSettlement.accountUpdateB_W.proof);

        // Update FeeRecipient
        updateBalanceA_F.generate_r1cs_witness(ringSettlement.balanceUpdateA_F.proof);
        updateBalanceB_F.generate_r1cs_witness(ringSettlement.balanceUpdateB_F.proof);
        updateAccount_F.generate_r1cs_witness(ringSettlement.accountUpdate_F.proof);

        // Update Ring-Matcher
        updateBalanceM_M.generate_r1cs_witness(ringSettlement.balanceUpdateM_M.proof);
        updateBalanceO_M.generate_r1cs_witness(ringSettlement.balanceUpdateO_M.proof);
        updateAccount_M.generate_r1cs_witness(ringSettlement.accountUpdate_M.proof);

        // Update Operator
        updateBalanceF_O.generate_r1cs_witness(ringSettlement.balanceUpdateF_O.proof);

        // Signatures
        minerSignatureVerifier.generate_r1cs_witness(ringSettlement.ring.minerSignature);
        dualAuthASignatureVerifier.generate_r1cs_witness(ringSettlement.ring.dualAuthASignature);
        dualAuthBSignatureVerifier.generate_r1cs_witness(ringSettlement.ring.dualAuthBSignature);
    }


    void generate_r1cs_constraints()
    {
        minerAccountID.generate_r1cs_constraints(true);
        feeRecipientAccountID.generate_r1cs_constraints(true);
        fee.generate_r1cs_constraints(true);
        nonce_before.generate_r1cs_constraints(true);

        orderA.generate_r1cs_constraints();
        orderB.generate_r1cs_constraints();

        // Match orders
        orderMatching.generate_r1cs_constraints();

        // Fill amounts
        pb.add_r1cs_constraint(ConstraintT(orderMatching.getFillAmountS_A(), orderMatching.isValid(), fillS_A.packed), "FillAmountS_A == fillS_A");
        pb.add_r1cs_constraint(ConstraintT(orderMatching.getFillAmountB_A(), orderMatching.isValid(), fillB_A.packed), "FillAmountB_A == fillB_A");
        pb.add_r1cs_constraint(ConstraintT(orderMatching.getFillAmountF_A(), orderMatching.isValid(), fillF_A.packed), "FillAmountF_A == fillF_A");
        pb.add_r1cs_constraint(ConstraintT(orderMatching.getFillAmountS_B(), orderMatching.isValid(), fillS_B.packed), "FillAmountS_B == fillS_B");
        pb.add_r1cs_constraint(ConstraintT(orderMatching.getFillAmountB_B(), orderMatching.isValid(), fillB_B.packed), "FillAmountB_B == fillB_B");
        pb.add_r1cs_constraint(ConstraintT(orderMatching.getFillAmountF_B(), orderMatching.isValid(), fillF_B.packed), "FillAmountF_B == fillF_B");
        pb.add_r1cs_constraint(ConstraintT(orderMatching.getMargin(), orderMatching.isValid(), margin.packed), "Margin == margin");

        fillS_A.generate_r1cs_constraints(true);
        fillB_A.generate_r1cs_constraints(true);
        fillF_A.generate_r1cs_constraints(true);
        fillS_B.generate_r1cs_constraints(true);
        fillB_B.generate_r1cs_constraints(true);
        fillF_B.generate_r1cs_constraints(true);
        margin.generate_r1cs_constraints(true);

        // Filled amounts
        pb.add_r1cs_constraint(ConstraintT(orderA.tradeHistory.getFilled() + fillS_A.packed, 1, filledAfterA), "filledBeforeA + fillA = filledAfterA");
        pb.add_r1cs_constraint(ConstraintT(orderB.tradeHistory.getFilled() + fillS_B.packed, 1, filledAfterB), "filledBeforeB + fillB = filledAfterB");

        // Calculate new balances
        balanceSB_A.generate_r1cs_constraints();
        balanceSB_B.generate_r1cs_constraints();
        balanceF_WA.generate_r1cs_constraints();
        balanceF_MA.generate_r1cs_constraints();
        balanceF_WB.generate_r1cs_constraints();
        balanceF_MB.generate_r1cs_constraints();
        balanceS_MA.generate_r1cs_constraints();
        balance_M.generate_r1cs_constraints();

        // Calculate fees
        feePaymentA.generate_r1cs_constraints();
        feePaymentB.generate_r1cs_constraints();

        // Update trading history
        updateTradeHistoryA.generate_r1cs_constraints();
        updateTradeHistoryB.generate_r1cs_constraints();

        // Update OwnerA
        updateBalanceS_A.generate_r1cs_constraints();
        updateBalanceB_A.generate_r1cs_constraints();
        updateBalanceF_A.generate_r1cs_constraints();
        updateAccount_A.generate_r1cs_constraints();

        // Update OwnerB
        updateBalanceS_B.generate_r1cs_constraints();
        updateBalanceB_B.generate_r1cs_constraints();
        updateBalanceF_B.generate_r1cs_constraints();
        updateAccount_B.generate_r1cs_constraints();

        // Update WalletA
        updateBalanceA_W.generate_r1cs_constraints();
        updateAccountA_W.generate_r1cs_constraints();

        // Update WalletB
        updateBalanceB_W.generate_r1cs_constraints();
        updateAccountB_W.generate_r1cs_constraints();

        // Update FeeRecipient
        updateBalanceA_F.generate_r1cs_constraints();
        updateBalanceB_F.generate_r1cs_constraints();
        updateAccount_F.generate_r1cs_constraints();

        // Update Ring-Matcher
        updateBalanceM_M.generate_r1cs_constraints();
        updateBalanceO_M.generate_r1cs_constraints();
        updateAccount_M.generate_r1cs_constraints();

        // Update Operator
        updateBalanceF_O.generate_r1cs_constraints();

        // Signatures
        minerSignatureVerifier.generate_r1cs_constraints();
        dualAuthASignatureVerifier.generate_r1cs_constraints();
        dualAuthBSignatureVerifier.generate_r1cs_constraints();

        // Update the nonce of the ring-matcher
        pb.add_r1cs_constraint(ConstraintT(nonce_before.packed + FieldT::one(), FieldT::one(), nonce_after), "nonce_before + 1 == nonce_after");
    }
};

class RingSettlementCircuit : public GadgetT
{
public:

    bool onchainDataAvailability;
    unsigned int numRings;
    jubjub::Params params;
    std::vector<RingSettlementGadget*> ringSettlements;

    libsnark::dual_variable_gadget<FieldT> publicDataHash;
    PublicDataGadget publicData;

    Constants constants;

    libsnark::dual_variable_gadget<FieldT> realmID;
    libsnark::dual_variable_gadget<FieldT> merkleRootBefore;
    libsnark::dual_variable_gadget<FieldT> merkleRootAfter;
    libsnark::dual_variable_gadget<FieldT> timestamp;

    // Operator
    libsnark::dual_variable_gadget<FieldT> operatorAccountID;
    const jubjub::VariablePointT publicKey;
    const VariableT balancesRoot_before;
    UpdateAccountGadget* updateAccount_O;

    RingSettlementCircuit(ProtoboardT& pb, const std::string& prefix) :
        GadgetT(pb, prefix),

        publicDataHash(pb, 256, FMT(prefix, ".publicDataHash")),
        publicData(pb, publicDataHash, FMT(prefix, ".publicData")),

        constants(pb, FMT(prefix, ".constants")),

        realmID(pb, 32, FMT(prefix, ".realmID")),

        merkleRootBefore(pb, 256, FMT(prefix, ".merkleRootBefore")),
        merkleRootAfter(pb, 256, FMT(prefix, ".merkleRootAfter")),

        operatorAccountID(pb, TREE_DEPTH_ACCOUNTS, FMT(prefix, ".operatorAccountID")),
        publicKey(pb, FMT(prefix, ".publicKey")),
        balancesRoot_before(make_variable(pb, FMT(prefix, ".balancesRoot_before"))),
        timestamp(pb, NUM_BITS_TIMESTAMP, FMT(prefix, ".timestamp"))
    {
        this->updateAccount_O = nullptr;
    }

    ~RingSettlementCircuit()
    {
        if (updateAccount_O)
        {
            delete updateAccount_O;
        }

        for(unsigned int i = 0; i < ringSettlements.size(); i++)
        {
            delete ringSettlements[i];
        }
    }

    void generate_r1cs_constraints(bool onchainDataAvailability, int numRings)
    {
        this->onchainDataAvailability = onchainDataAvailability;
        this->numRings = numRings;

        pb.set_input_sizes(1);

        constants.generate_r1cs_constraints();

        realmID.generate_r1cs_constraints(true);
        merkleRootBefore.generate_r1cs_constraints(true);
        merkleRootAfter.generate_r1cs_constraints(true);
        timestamp.generate_r1cs_constraints(true);

        publicData.add(realmID.bits);
        publicData.add(merkleRootBefore.bits);
        publicData.add(merkleRootAfter.bits);
        publicData.add(timestamp.bits);
        if (onchainDataAvailability)
        {
            publicData.add(constants.accountPadding);
            publicData.add(operatorAccountID.bits);
        }
        for (size_t j = 0; j < numRings; j++)
        {
            const VariableT ringAccountsRoot = (j == 0) ? merkleRootBefore.packed : ringSettlements.back()->getNewAccountsRoot();
            const VariableT& ringOperatorBalancesRoot = (j == 0) ? balancesRoot_before : ringSettlements.back()->getNewOperatorBalancesRoot();
            ringSettlements.push_back(new RingSettlementGadget(
                pb,
                params,
                constants,
                realmID.packed,
                ringAccountsRoot,
                timestamp.packed,
                ringOperatorBalancesRoot,
                std::string("trade_") + std::to_string(j)
            ));
            ringSettlements.back()->generate_r1cs_constraints();

            if (onchainDataAvailability)
            {
                // Store data from ring settlement
                publicData.add(ringSettlements.back()->getPublicData());
            }
        }

        // Pay the operator
        updateAccount_O = new UpdateAccountGadget(pb, ringSettlements.back()->getNewAccountsRoot(), operatorAccountID.bits,
                      {publicKey.x, publicKey.y, constants.zero, balancesRoot_before},
                      {publicKey.x, publicKey.y, constants.zero, ringSettlements.back()->getNewOperatorBalancesRoot()},
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
        std::cout << pb.num_constraints() << " constraints (" << (pb.num_constraints() / numRings) << "/ring)" << std::endl;
    }

    bool generateWitness(const RingSettlementBlock& block)
    {
        if (block.ringSettlements.size() != numRings)
        {
            std::cout << "Invalid number of rings: " << block.ringSettlements.size()  << std::endl;
            return false;
        }

        constants.generate_r1cs_witness();

        realmID.bits.fill_with_bits_of_field_element(pb, block.realmID);
        realmID.generate_r1cs_witness_from_bits();

        merkleRootBefore.bits.fill_with_bits_of_field_element(pb, block.merkleRootBefore);
        merkleRootBefore.generate_r1cs_witness_from_bits();
        merkleRootAfter.bits.fill_with_bits_of_field_element(pb, block.merkleRootAfter);
        merkleRootAfter.generate_r1cs_witness_from_bits();

        timestamp.bits.fill_with_bits_of_field_element(pb, block.timestamp);
        timestamp.generate_r1cs_witness_from_bits();

        operatorAccountID.bits.fill_with_bits_of_field_element(pb, block.operatorAccountID);
        operatorAccountID.generate_r1cs_witness_from_bits();
        pb.val(publicKey.x) = block.accountUpdate_O.before.publicKey.x;
        pb.val(publicKey.y) = block.accountUpdate_O.before.publicKey.y;
        pb.val(balancesRoot_before) = block.accountUpdate_O.before.balancesRoot;

        for(unsigned int i = 0; i < block.ringSettlements.size(); i++)
        {
            ringSettlements[i]->generate_r1cs_witness(block.ringSettlements[i]);
        }

        updateAccount_O->generate_r1cs_witness(block.accountUpdate_O.proof);

        publicData.generate_r1cs_witness();

        return true;
    }
};

}

#endif
