#ifndef _TRADECIRCUIT_H_
#define _TRADECIRCUIT_H_

#include "../Utils/Constants.h"
#include "../Utils/Data.h"
#include "../Utils/Utils.h"
#include "../Gadgets/MatchingGadgets.h"
#include "../Gadgets/AccountGadgets.h"
#include "../Gadgets/TradingHistoryGadgets.h"
#include "../Gadgets/MathGadgets.h"

#include "../ThirdParty/BigInt.hpp"
#include "ethsnarks.hpp"
#include "utils.hpp"
#include "gadgets/sha256_many.hpp"
#include "gadgets/subadd.hpp"

using namespace ethsnarks;

namespace Loopring
{

class RingSettlementGadget : public GadgetT
{
public:
    const VariableT accountsRoot;

    const VariableT tradingHistoryRootS_A;
    const VariableT tradingHistoryRootB_A;
    const VariableT tradingHistoryRootF_A;
    const VariableT tradingHistoryRootS_B;
    const VariableT tradingHistoryRootB_B;
    const VariableT tradingHistoryRootF_B;
    const VariableT tradingHistoryRoot_M;

    const VariableT balancesRootA;
    const VariableT balancesRootB;
    const VariableT balancesRootM;

    const VariableT walletsRootF_A;
    const VariableT ringmatchersRootF_A;

    const VariableT walletsRootF_B;
    const VariableT ringmatchersRootF_B;

    const VariableT walletsRootS_A;
    const VariableT ringmatchersRootS_A;

    VariableT constant0;
    VariableT constant1;
    VariableArrayT lrcTokenID;

    VariableT blockStateID;

    const jubjub::VariablePointT publicKey;
    libsnark::dual_variable_gadget<FieldT> minerID;
    libsnark::dual_variable_gadget<FieldT> minerAccountID;
    libsnark::dual_variable_gadget<FieldT> fee;
    libsnark::dual_variable_gadget<FieldT> nonce;

    OrderGadget orderA;
    OrderGadget orderB;

    OrderMatchingGadget orderMatching;

    VariableT ordersValid;
    VariableT valid;

    libsnark::dual_variable_gadget<FieldT> fillS_A;
    libsnark::dual_variable_gadget<FieldT> fillB_A;
    libsnark::dual_variable_gadget<FieldT> fillF_A;
    libsnark::dual_variable_gadget<FieldT> fillS_B;
    libsnark::dual_variable_gadget<FieldT> fillB_B;
    libsnark::dual_variable_gadget<FieldT> fillF_B;
    libsnark::dual_variable_gadget<FieldT> margin;

    VariableT filledAfterA;
    VariableT filledAfterB;

    VariableT burnRateF_A;
    VariableT burnRateF_B;

    //CheckBurnRateGadget checkBurnRateF_A;
    //CheckBurnRateGadget checkBurnRateF_B;

    FeePaymentCalculator feePaymentA;
    FeePaymentCalculator feePaymentB;

    VariableT balanceS_A_before;
    VariableT balanceB_A_before;
    VariableT balanceF_A_before;

    VariableT balanceF_WA_before;
    VariableT balanceF_MA_before;
    VariableT balanceF_BA_before;
    VariableT balanceS_WA_before;
    VariableT balanceS_MA_before;
    VariableT balanceS_BA_before;

    VariableT balanceS_B_before;
    VariableT balanceB_B_before;
    VariableT balanceF_B_before;
    VariableT balanceF_WB_before;
    VariableT balanceF_MB_before;
    VariableT balanceF_BB_before;
    VariableT balanceS_M_before;
    VariableT balanceS_MB_before;
    VariableT balance_M_before;

    subadd_gadget balanceSB_A;
    subadd_gadget balanceSB_B;
    subadd_gadget balanceF_WA;
    subadd_gadget balanceF_MA;
    subadd_gadget balanceF_BA;
    subadd_gadget balanceF_WB;
    subadd_gadget balanceF_MB;
    subadd_gadget balanceF_BB;
    subadd_gadget balanceS_MA;
    subadd_gadget balance_M;

    UpdateTradeHistoryGadget updateTradeHistoryA;
    UpdateTradeHistoryGadget updateTradeHistoryB;

    UpdateBalanceGadget updateBalanceS_A;
    UpdateBalanceGadget updateBalanceB_A;
    UpdateBalanceGadget updateBalanceF_A;
    UpdateAccountGadget updateAccount_A;

    UpdateBalanceGadget updateBalanceS_B;
    UpdateBalanceGadget updateBalanceB_B;
    UpdateBalanceGadget updateBalanceF_B;
    UpdateAccountGadget updateAccount_B;

    UpdateBalanceGadget updateBalance_M;
    UpdateAccountGadget updateAccount_M;

    UpdateFeeBalanceGadget updateWalletFeeF_A;
    UpdateFeeBalanceGadget updateRingmatcherFeeF_A;
    UpdateFeeTokenLeaf updateFeeTokenLeafF_A;

    UpdateFeeBalanceGadget updateWalletFeeF_B;
    UpdateFeeBalanceGadget updateRingmatcherFeeF_B;
    UpdateFeeTokenLeaf updateFeeTokenLeafF_B;

    UpdateFeeBalanceGadget updateRingmatcherFeeS_A;
    UpdateFeeTokenLeaf updateFeeTokenLeafS_A;

    const VariableArrayT ringMessage;
    SignatureVerifier minerSignatureVerifier;
    SignatureVerifier walletASignatureVerifier;
    SignatureVerifier walletBSignatureVerifier;

    RingSettlementGadget(
        ProtoboardT& pb,
        const jubjub::Params& params,
        const VariableT& _stateID,
        const VariableT& _accountsRoot,
        const VariableT& _feesRoot,
        const VariableT& _burnRateRoot,
        const VariableT& _timestamp,
        const VariableT& _operatorBalance,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        constant0(make_variable(pb, 0, FMT(prefix, ".constant0"))),
        constant1(make_variable(pb, 1, FMT(prefix, ".constant1"))),

        lrcTokenID(make_var_array(pb, TREE_DEPTH_BALANCES, FMT(prefix, ".lrcTokenID"))),

        publicKey(pb, FMT(prefix, ".publicKey")),
        minerID(pb, 12, FMT(prefix, ".minerID")),
        minerAccountID(pb, 24, FMT(prefix, ".minerAccountID")),
        fee(pb, 96, FMT(prefix, ".fee")),
        nonce(pb, 32, FMT(prefix, ".nonce")),

        orderA(pb, params, _stateID, _timestamp, FMT(prefix, ".orderA")),
        orderB(pb, params, _stateID, _timestamp, FMT(prefix, ".orderB")),

        orderMatching(pb, orderA, orderB, FMT(prefix, ".orderMatching")),

        ordersValid(make_variable(pb, FMT(prefix, ".ordersValid"))),
        valid(make_variable(pb, FMT(prefix, ".valid"))),

        fillS_A(pb, 96, FMT(prefix, ".fillS_A")),
        fillB_A(pb, 96, FMT(prefix, ".fillB_A")),
        fillF_A(pb, 96, FMT(prefix, ".fillF_A")),
        fillS_B(pb, 96, FMT(prefix, ".fillS_B")),
        fillB_B(pb, 96, FMT(prefix, ".fillB_B")),
        fillF_B(pb, 96, FMT(prefix, ".fillF_B")),
        margin(pb, 96, FMT(prefix, ".margin")),

        filledAfterA(make_variable(pb, FMT(prefix, ".filledAfterA"))),
        filledAfterB(make_variable(pb, FMT(prefix, ".filledAfterB"))),

        burnRateF_A(make_variable(pb, FMT(prefix, ".burnRateF_A"))),
        burnRateF_B(make_variable(pb, FMT(prefix, ".burnRateF_B"))),

        //checkBurnRateF_A(pb, _burnRateMerkleRoot, orderA.tokenF.bits, burnRateF_A, FMT(prefix, ".checkBurnRateF_A")),
        //checkBurnRateF_B(pb, _burnRateMerkleRoot, orderB.tokenF.bits, burnRateF_B, FMT(prefix, ".checkBurnRateF_B")),

        feePaymentA(pb, fillF_A.packed, burnRateF_A, orderA.walletSplitPercentage.packed, orderA.waiveFeePercentage.packed, FMT(prefix, "feePaymentA")),
        feePaymentB(pb, fillF_B.packed, burnRateF_B, orderB.walletSplitPercentage.packed, orderB.waiveFeePercentage.packed, FMT(prefix, "feePaymentB")),

        balanceS_A_before(make_variable(pb, FMT(prefix, ".balanceS_A_before"))),
        balanceB_A_before(make_variable(pb, FMT(prefix, ".balanceB_A_before"))),
        balanceF_A_before(make_variable(pb, FMT(prefix, ".balanceF_A_before"))),
        balanceF_WA_before(make_variable(pb, FMT(prefix, ".balanceF_WA_before"))),
        balanceF_MA_before(make_variable(pb, FMT(prefix, ".balanceF_MA_before"))),
        balanceF_BA_before(make_variable(pb, FMT(prefix, ".balanceF_BA_before"))),
        balanceS_WA_before(make_variable(pb, FMT(prefix, ".balanceS_WA_before"))),
        balanceS_MA_before(make_variable(pb, FMT(prefix, ".balanceS_MA_before"))),
        balanceS_BA_before(make_variable(pb, FMT(prefix, ".balanceS_BA_before"))),

        balanceS_B_before(make_variable(pb, FMT(prefix, ".balanceS_B_before"))),
        balanceB_B_before(make_variable(pb, FMT(prefix, ".balanceB_B_before"))),
        balanceF_B_before(make_variable(pb, FMT(prefix, ".balanceF_B_before"))),
        balanceF_WB_before(make_variable(pb, FMT(prefix, ".balanceF_WB_before"))),
        balanceF_MB_before(make_variable(pb, FMT(prefix, ".balanceF_MB_before"))),
        balanceF_BB_before(make_variable(pb, FMT(prefix, ".balanceF_BB_before"))),
        balanceS_M_before(make_variable(pb, FMT(prefix, ".balanceS_M_before"))),
        balanceS_MB_before(make_variable(pb, FMT(prefix, ".balanceS_MB_before"))),
        balance_M_before(make_variable(pb, FMT(prefix, ".balance_M_before"))),

        // fillB_B == fillS_A - margin
        balanceSB_A(pb, 96, balanceS_A_before, balanceB_B_before, fillB_B.packed, FMT(prefix, ".balanceSB_A")),
        balanceSB_B(pb, 96, balanceS_B_before, balanceB_A_before, fillS_B.packed, FMT(prefix, ".balanceSB_B")),

        balanceF_WA(pb, 96, balanceF_A_before, balanceF_WA_before, feePaymentA.getWalletFee(), FMT(prefix, ".balanceF_WA")),
        balanceF_MA(pb, 96, balanceF_WA.X, balanceF_MA_before, feePaymentA.getMatchingFee(), FMT(prefix, ".balanceF_MA")),
        balanceF_BA(pb, 96, balanceF_MA.X, balanceF_BA_before, feePaymentA.getBurnFee(), FMT(prefix, ".balanceF_BA")),

        balanceF_WB(pb, 96, balanceF_B_before, balanceF_WB_before, feePaymentB.getWalletFee(), FMT(prefix, ".balanceF_WB")),
        balanceF_MB(pb, 96, balanceF_WB.X, balanceF_MB_before, feePaymentB.getMatchingFee(), FMT(prefix, ".balanceF_MB")),
        balanceF_BB(pb, 96, balanceF_MB.X, balanceF_BB_before, feePaymentB.getBurnFee(), FMT(prefix, ".balanceF_BB")),

        balanceS_MA(pb, 96, balanceSB_A.X, balanceS_M_before, margin.packed, FMT(prefix, ".balanceS_MA")),

        balance_M(pb, 96, balance_M_before, _operatorBalance, fee.packed, FMT(prefix, ".balance_M")),

        tradingHistoryRootS_A(make_variable(pb, FMT(prefix, ".tradingHistoryRootS_A"))),
        tradingHistoryRootB_A(make_variable(pb, FMT(prefix, ".tradingHistoryRootB_A"))),
        tradingHistoryRootF_A(make_variable(pb, FMT(prefix, ".tradingHistoryRootF_A"))),
        tradingHistoryRootS_B(make_variable(pb, FMT(prefix, ".tradingHistoryRootS_B"))),
        tradingHistoryRootB_B(make_variable(pb, FMT(prefix, ".tradingHistoryRootB_B"))),
        tradingHistoryRootF_B(make_variable(pb, FMT(prefix, ".tradingHistoryRootF_B"))),
        tradingHistoryRoot_M(make_variable(pb, FMT(prefix, ".tradingHistoryRoot_M"))),

        balancesRootA(make_variable(pb, FMT(prefix, ".balancesRootA"))),
        balancesRootB(make_variable(pb, FMT(prefix, ".balancesRootB"))),
        balancesRootM(make_variable(pb, FMT(prefix, ".balancesRootM"))),

        walletsRootF_A(make_variable(pb, FMT(prefix, ".walletsRootF_A"))),
        ringmatchersRootF_A(make_variable(pb, FMT(prefix, ".ringmatchersRootF_A"))),

        walletsRootF_B(make_variable(pb, FMT(prefix, ".walletsRootF_B"))),
        ringmatchersRootF_B(make_variable(pb, FMT(prefix, ".ringmatchersRootF_B"))),

        walletsRootS_A(make_variable(pb, FMT(prefix, ".walletsRootS_A"))),
        ringmatchersRootS_A(make_variable(pb, FMT(prefix, ".ringmatchersRootS_A"))),


        updateTradeHistoryA(pb, tradingHistoryRootS_A, orderA.orderID.bits,
                            orderA.filledBefore, orderA.cancelled, filledAfterA, orderA.cancelled, FMT(prefix, ".updateTradeHistoryA")),
        updateTradeHistoryB(pb, tradingHistoryRootS_B, orderB.orderID.bits,
                            orderB.filledBefore, orderB.cancelled, filledAfterB, orderB.cancelled, FMT(prefix, ".updateTradeHistoryB")),

        accountsRoot(_accountsRoot),

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
                         {balanceF_BA.X, tradingHistoryRootF_A},
                         FMT(prefix, ".updateBalanceF_A")),
        updateAccount_A(pb, _accountsRoot, orderA.accountID.bits,
                        {orderA.publicKey.x, orderA.publicKey.y, orderA.walletID.packed, constant0, balancesRootA},
                        {orderA.publicKey.x, orderA.publicKey.y, orderA.walletID.packed, constant0, updateBalanceF_A.getNewRoot()},
                        FMT(prefix, ".updateAccount_A")),

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
                         {balanceF_BB.X, tradingHistoryRootF_B},
                         FMT(prefix, ".updateBalanceF_B")),
        updateAccount_B(pb, updateAccount_A.result(), orderB.accountID.bits,
                        {orderB.publicKey.x, orderB.publicKey.y, orderB.walletID.packed, constant0, balancesRootB},
                        {orderB.publicKey.x, orderB.publicKey.y, orderB.walletID.packed, constant0, updateBalanceF_B.getNewRoot()},
                        FMT(prefix, ".updateAccount_B")),

        updateBalance_M(pb, balancesRootM, lrcTokenID,
                        {balance_M_before, tradingHistoryRoot_M},
                        {balance_M.X, tradingHistoryRoot_M},
                        FMT(prefix, ".updateBalance_M")),
        updateAccount_M(pb, updateAccount_B.result(), minerAccountID.bits,
                        {publicKey.x, publicKey.y, constant0, constant0, balancesRootM},
                        {publicKey.x, publicKey.y, constant0, constant0, updateBalance_M.getNewRoot()},
                        FMT(prefix, ".updateAccount_M")),

        updateWalletFeeF_A(pb, walletsRootF_A, orderA.walletID.bits,
                             {balanceF_WA_before},
                             {balanceF_WA.Y},
                             FMT(prefix, ".updateWalletFeeF_A")),
        updateRingmatcherFeeF_A(pb, ringmatchersRootF_A, minerID.bits,
                             {balanceF_MA_before},
                             {balanceF_MA.Y},
                             FMT(prefix, ".updateRingmatcherFeeF_A")),
        updateFeeTokenLeafF_A(pb, _feesRoot, orderA.tokenF.bits,
                              {balanceF_BA_before, walletsRootF_A, ringmatchersRootF_A},
                              {balanceF_BA.Y, updateWalletFeeF_A.getNewRoot(), updateRingmatcherFeeF_A.getNewRoot()},
                              FMT(prefix, ".updateFeeTokenLeafF_A")),

        updateWalletFeeF_B(pb, walletsRootF_B, orderB.walletID.bits,
                             {balanceF_WB_before},
                             {balanceF_WB.Y},
                             FMT(prefix, ".updateWalletFeeF_B")),
        updateRingmatcherFeeF_B(pb, ringmatchersRootF_B, minerID.bits,
                             {balanceF_MB_before},
                             {balanceF_MB.Y},
                             FMT(prefix, ".updateRingmatcherFeeF_B")),
        updateFeeTokenLeafF_B(pb, updateFeeTokenLeafF_A.getNewRoot(), orderB.tokenF.bits,
                              {balanceF_BB_before, walletsRootF_B, ringmatchersRootF_B},
                              {balanceF_BB.Y, updateWalletFeeF_B.getNewRoot(), updateRingmatcherFeeF_B.getNewRoot()},
                              FMT(prefix, ".updateFeeTokenLeafF_B")),

        updateRingmatcherFeeS_A(pb, ringmatchersRootS_A, minerID.bits,
                             {balanceS_M_before},
                             {balanceS_MA.Y,},
                             FMT(prefix, ".updateRingmatcherFeeS_A")),
        updateFeeTokenLeafS_A(pb, updateFeeTokenLeafF_B.getNewRoot(), orderA.tokenS.bits,
                              {balanceS_MB_before, walletsRootS_A, ringmatchersRootS_A},
                              {balanceS_MB_before, walletsRootS_A, updateRingmatcherFeeS_A.getNewRoot()},
                              FMT(prefix, ".updateFeeTokenLeafS_A")),

        ringMessage(flatten({orderA.getHash(), orderB.getHash(),
                             orderA.waiveFeePercentage.bits, orderB.waiveFeePercentage.bits,
                             minerID.bits, minerAccountID.bits,
                             fee.bits,
                             nonce.bits})),
        minerSignatureVerifier(pb, params, publicKey, ringMessage, FMT(prefix, ".minerSignatureVerifier")),
        walletASignatureVerifier(pb, params, orderA.walletPublicKey, ringMessage, FMT(prefix, ".walletASignatureVerifier")),
        walletBSignatureVerifier(pb, params, orderB.walletPublicKey, ringMessage, FMT(prefix, ".walletBSignatureVerifier"))
    {

    }

    const VariableT getNewAccountsRoot() const
    {
        return updateAccount_M.result();
    }

    const VariableT getNewFeesRoot() const
    {
        return updateFeeTokenLeafS_A.getNewRoot();
    }

    const VariableT& getOperatorBalance() const
    {
        return balance_M.Y;
    }

    const std::vector<VariableArrayT> getPublicData() const
    {
        return {
                orderA.accountID.bits, orderA.orderID.bits,
                fillS_A.bits, fillF_A.bits,

                orderB.accountID.bits, orderB.orderID.bits,
                fillS_B.bits, fillF_B.bits
               };
    }

    void generate_r1cs_witness (const RingSettlement& ringSettlement)
    {
        lrcTokenID.fill_with_bits_of_ulong(pb, 1);

        pb.val(publicKey.x) = ringSettlement.ring.publicKey.x;
        pb.val(publicKey.y) = ringSettlement.ring.publicKey.y;

        minerID.bits.fill_with_bits_of_field_element(pb, ringSettlement.ring.minerID);
        minerID.generate_r1cs_witness_from_bits();
        minerAccountID.bits.fill_with_bits_of_field_element(pb, ringSettlement.ring.minerAccountID);
        minerAccountID.generate_r1cs_witness_from_bits();
        fee.bits.fill_with_bits_of_field_element(pb, ringSettlement.ring.fee);
        fee.generate_r1cs_witness_from_bits();
        nonce.bits.fill_with_bits_of_field_element(pb, ringSettlement.ring.nonce);
        nonce.generate_r1cs_witness_from_bits();

        orderA.generate_r1cs_witness(ringSettlement.ring.orderA);
        orderB.generate_r1cs_witness(ringSettlement.ring.orderB);

        orderMatching.generate_r1cs_witness();

        pb.val(ordersValid) = pb.val(orderA.isValid()) * pb.val(orderB.isValid());
        pb.val(valid) = ringSettlement.ring.valid;

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

        pb.val(filledAfterA) = pb.val(orderA.filledBefore) + pb.val(fillS_A.packed);
        pb.val(filledAfterB) = pb.val(orderB.filledBefore) + pb.val(fillS_B.packed);

        pb.val(burnRateF_A) = ringSettlement.burnRateCheckF_A.burnRateData.burnRate;
        pb.val(burnRateF_B) = ringSettlement.burnRateCheckF_B.burnRateData.burnRate;
        //checkBurnRateF_A.generate_r1cs_witness(ringSettlement.burnRateCheckF_A.proof);
        //checkBurnRateF_B.generate_r1cs_witness(ringSettlement.burnRateCheckF_B.proof);

        feePaymentA.generate_r1cs_witness();
        feePaymentB.generate_r1cs_witness();

        pb.val(balanceS_A_before) = ringSettlement.balanceUpdateS_A.before.balance;
        pb.val(balanceB_A_before) = ringSettlement.balanceUpdateB_A.before.balance;
        pb.val(balanceF_A_before) = ringSettlement.balanceUpdateF_A.before.balance;

        pb.val(balanceS_B_before) = ringSettlement.balanceUpdateS_B.before.balance;
        pb.val(balanceB_B_before) = ringSettlement.balanceUpdateB_B.before.balance;
        pb.val(balanceF_B_before) = ringSettlement.balanceUpdateF_B.before.balance;

        pb.val(balanceF_WA_before) = ringSettlement.feeBalanceUpdateF_WA.before.balance;
        pb.val(balanceF_MA_before) = ringSettlement.feeBalanceUpdateF_MA.before.balance;
        pb.val(balanceF_BA_before) = ringSettlement.feeTokenUpdate_FA.before.balance;

        pb.val(balanceF_WB_before) = ringSettlement.feeBalanceUpdateF_WB.before.balance;
        pb.val(balanceF_MB_before) = ringSettlement.feeBalanceUpdateF_MB.before.balance;
        pb.val(balanceF_BB_before) = ringSettlement.feeTokenUpdate_FB.before.balance;

        pb.val(balanceS_M_before) = ringSettlement.feeBalanceUpdateS_MA.before.balance;
        pb.val(balanceS_MB_before) = ringSettlement.feeTokenUpdate_SA.before.balance;

        pb.val(balance_M_before) = ringSettlement.balanceUpdate_M.before.balance;

        balanceSB_A.generate_r1cs_witness();
        balanceSB_B.generate_r1cs_witness();
        balanceF_WA.generate_r1cs_witness();
        balanceF_MA.generate_r1cs_witness();
        balanceF_BA.generate_r1cs_witness();
        balanceF_WB.generate_r1cs_witness();
        balanceF_MB.generate_r1cs_witness();
        balanceF_BB.generate_r1cs_witness();
        balanceS_MA.generate_r1cs_witness();
        balance_M.generate_r1cs_witness();

        //
        // Update trading history
        //

        pb.val(tradingHistoryRootS_A) = ringSettlement.balanceUpdateS_A.before.tradingHistoryRoot;
        pb.val(tradingHistoryRootB_A) = ringSettlement.balanceUpdateB_A.before.tradingHistoryRoot;
        pb.val(tradingHistoryRootF_A) = ringSettlement.balanceUpdateF_A.before.tradingHistoryRoot;
        pb.val(tradingHistoryRootS_B) = ringSettlement.balanceUpdateS_B.before.tradingHistoryRoot;
        pb.val(tradingHistoryRootB_B) = ringSettlement.balanceUpdateB_B.before.tradingHistoryRoot;
        pb.val(tradingHistoryRootF_B) = ringSettlement.balanceUpdateF_B.before.tradingHistoryRoot;
        pb.val(tradingHistoryRoot_M) = ringSettlement.balanceUpdate_M.before.tradingHistoryRoot;

        updateTradeHistoryA.generate_r1cs_witness(ringSettlement.tradeHistoryUpdate_A.proof);
        updateTradeHistoryB.generate_r1cs_witness(ringSettlement.tradeHistoryUpdate_B.proof);

        pb.val(balancesRootA) = ringSettlement.balanceUpdateS_A.rootBefore;
        pb.val(balancesRootB) = ringSettlement.balanceUpdateS_B.rootBefore;
        pb.val(balancesRootM) = ringSettlement.balanceUpdate_M.rootBefore;

        pb.val(walletsRootF_A) = ringSettlement.feeTokenUpdate_FA.before.walletsRoot;
        pb.val(ringmatchersRootF_A) = ringSettlement.feeTokenUpdate_FA.before.ringmatchersRoot;

        pb.val(walletsRootF_B) = ringSettlement.feeTokenUpdate_FB.before.walletsRoot;
        pb.val(ringmatchersRootF_B) = ringSettlement.feeTokenUpdate_FB.before.ringmatchersRoot;

        pb.val(walletsRootS_A) = ringSettlement.feeTokenUpdate_SA.before.walletsRoot;
        pb.val(ringmatchersRootS_A) = ringSettlement.feeTokenUpdate_SA.before.ringmatchersRoot;


        //
        // Update accounts
        //
        updateBalanceS_A.generate_r1cs_witness(ringSettlement.balanceUpdateS_A.proof);
        updateBalanceB_A.generate_r1cs_witness(ringSettlement.balanceUpdateB_A.proof);
        updateBalanceF_A.generate_r1cs_witness(ringSettlement.balanceUpdateF_A.proof);
        updateAccount_A.generate_r1cs_witness(ringSettlement.accountUpdate_A.proof);

        updateBalanceS_B.generate_r1cs_witness(ringSettlement.balanceUpdateS_B.proof);
        updateBalanceB_B.generate_r1cs_witness(ringSettlement.balanceUpdateB_B.proof);
        updateBalanceF_B.generate_r1cs_witness(ringSettlement.balanceUpdateF_B.proof);
        updateAccount_B.generate_r1cs_witness(ringSettlement.accountUpdate_B.proof);

        updateBalance_M.generate_r1cs_witness(ringSettlement.balanceUpdate_M.proof);
        updateAccount_M.generate_r1cs_witness(ringSettlement.accountUpdate_M.proof);


        updateWalletFeeF_A.generate_r1cs_witness(ringSettlement.feeBalanceUpdateF_WA.proof);
        updateRingmatcherFeeF_A.generate_r1cs_witness(ringSettlement.feeBalanceUpdateF_MA.proof);
        updateFeeTokenLeafF_A.generate_r1cs_witness(ringSettlement.feeTokenUpdate_FA.proof);

        assert(pb.val(updateWalletFeeF_A.getNewRoot()) == ringSettlement.feeBalanceUpdateF_WA.rootAfter);
        assert(pb.val(updateRingmatcherFeeF_A.getNewRoot()) == ringSettlement.feeBalanceUpdateF_MA.rootAfter);
        assert(pb.val(updateFeeTokenLeafF_A.getNewRoot()) == ringSettlement.feeTokenUpdate_FA.rootAfter);

        updateWalletFeeF_B.generate_r1cs_witness(ringSettlement.feeBalanceUpdateF_WB.proof);
        updateRingmatcherFeeF_B.generate_r1cs_witness(ringSettlement.feeBalanceUpdateF_MB.proof);
        updateFeeTokenLeafF_B.generate_r1cs_witness(ringSettlement.feeTokenUpdate_FB.proof);

        assert(pb.val(updateWalletFeeF_B.getNewRoot()) == ringSettlement.feeBalanceUpdateF_WB.rootAfter);
        assert(pb.val(updateRingmatcherFeeF_B.getNewRoot()) == ringSettlement.feeBalanceUpdateF_MB.rootAfter);
        assert(pb.val(updateFeeTokenLeafF_B.getNewRoot()) == ringSettlement.feeTokenUpdate_FB.rootAfter);

        updateRingmatcherFeeS_A.generate_r1cs_witness(ringSettlement.feeBalanceUpdateS_MA.proof);
        updateFeeTokenLeafS_A.generate_r1cs_witness(ringSettlement.feeTokenUpdate_SA.proof);

        minerSignatureVerifier.generate_r1cs_witness(ringSettlement.ring.minerSignature);
        walletASignatureVerifier.generate_r1cs_witness(ringSettlement.ring.walletASignature);
        walletBSignatureVerifier.generate_r1cs_witness(ringSettlement.ring.walletBSignature);
    }


    void generate_r1cs_constraints()
    {
        minerID.generate_r1cs_constraints(true);
        minerAccountID.generate_r1cs_constraints(true);
        fee.generate_r1cs_constraints(true);
        nonce.generate_r1cs_constraints(true);

        orderA.generate_r1cs_constraints();
        orderB.generate_r1cs_constraints();

        orderMatching.generate_r1cs_constraints();

        pb.add_r1cs_constraint(ConstraintT(orderA.isValid(), orderB.isValid(), ordersValid), "orderA.isValid() && orderA.isValid() == ordersValid");
        pb.add_r1cs_constraint(ConstraintT(ordersValid, orderMatching.isValid(), valid), "ordersValid && orderMatching.isValid() == valid");

        pb.add_r1cs_constraint(ConstraintT(orderMatching.getFillAmountS_A(), valid, fillS_A.packed), "FillAmountS_A == fillS_A");
        pb.add_r1cs_constraint(ConstraintT(orderMatching.getFillAmountB_A(), valid, fillB_A.packed), "FillAmountB_A == fillB_A");
        pb.add_r1cs_constraint(ConstraintT(orderMatching.getFillAmountF_A(), valid, fillF_A.packed), "FillAmountF_A == fillF_A");
        pb.add_r1cs_constraint(ConstraintT(orderMatching.getFillAmountS_B(), valid, fillS_B.packed), "FillAmountS_B == fillS_B");
        pb.add_r1cs_constraint(ConstraintT(orderMatching.getFillAmountB_B(), valid, fillB_B.packed), "FillAmountB_B == fillB_B");
        pb.add_r1cs_constraint(ConstraintT(orderMatching.getFillAmountF_B(), valid, fillF_B.packed), "FillAmountF_B == fillF_B");
        pb.add_r1cs_constraint(ConstraintT(orderMatching.getMargin(), valid, margin.packed), "Margin == margin");

        fillS_A.generate_r1cs_constraints(true);
        fillB_A.generate_r1cs_constraints(true);
        fillF_A.generate_r1cs_constraints(true);
        fillS_B.generate_r1cs_constraints(true);
        fillB_B.generate_r1cs_constraints(true);
        fillF_B.generate_r1cs_constraints(true);
        margin.generate_r1cs_constraints(true);

        pb.add_r1cs_constraint(ConstraintT(orderA.filledBefore + fillS_A.packed, 1, filledAfterA), "filledBeforeA + fillA = filledAfterA");
        pb.add_r1cs_constraint(ConstraintT(orderB.filledBefore + fillS_B.packed, 1, filledAfterB), "filledBeforeB + fillB = filledAfterB");

        //checkBurnRateF_A.generate_r1cs_constraints();
        //checkBurnRateF_B.generate_r1cs_constraints();

        balanceSB_A.generate_r1cs_constraints();
        balanceSB_B.generate_r1cs_constraints();
        balanceF_WA.generate_r1cs_constraints();
        balanceF_MA.generate_r1cs_constraints();
        balanceF_BA.generate_r1cs_constraints();
        balanceF_WB.generate_r1cs_constraints();
        balanceF_MB.generate_r1cs_constraints();
        balanceF_BB.generate_r1cs_constraints();
        balanceS_MA.generate_r1cs_constraints();
        balance_M.generate_r1cs_constraints();

        //
        // Check burnrate
        //

        feePaymentA.generate_r1cs_witness();
        feePaymentB.generate_r1cs_witness();

        //
        // Update trading history
        //

        updateTradeHistoryA.generate_r1cs_constraints();
        updateTradeHistoryB.generate_r1cs_constraints();

        //
        // Update accounts
        //

        updateBalanceS_A.generate_r1cs_constraints();
        updateBalanceB_A.generate_r1cs_constraints();
        updateBalanceF_A.generate_r1cs_constraints();
        updateAccount_A.generate_r1cs_constraints();

        updateBalanceS_B.generate_r1cs_constraints();
        updateBalanceB_B.generate_r1cs_constraints();
        updateBalanceF_B.generate_r1cs_constraints();
        updateAccount_B.generate_r1cs_constraints();

        updateBalance_M.generate_r1cs_constraints();
        updateAccount_M.generate_r1cs_constraints();

        updateWalletFeeF_A.generate_r1cs_constraints();
        updateRingmatcherFeeF_A.generate_r1cs_constraints();
        updateFeeTokenLeafF_A.generate_r1cs_constraints();

        updateWalletFeeF_B.generate_r1cs_constraints();
        updateRingmatcherFeeF_B.generate_r1cs_constraints();
        updateFeeTokenLeafF_B.generate_r1cs_constraints();

        updateRingmatcherFeeS_A.generate_r1cs_constraints();
        updateFeeTokenLeafS_A.generate_r1cs_constraints();

        //
        // Signatures
        //

        minerSignatureVerifier.generate_r1cs_constraints();
        walletASignatureVerifier.generate_r1cs_constraints();
        walletBSignatureVerifier.generate_r1cs_constraints();
    }
};

class TradeCircuitGadget : public GadgetT
{
public:

    unsigned int numRings;
    jubjub::Params params;
    std::vector<RingSettlementGadget*> ringSettlements;

    VariableArrayT lrcTokenID;

    libsnark::dual_variable_gadget<FieldT> publicDataHash;
    libsnark::dual_variable_gadget<FieldT> stateID;
    libsnark::dual_variable_gadget<FieldT> merkleRootBefore;
    libsnark::dual_variable_gadget<FieldT> merkleRootAfter;
    libsnark::dual_variable_gadget<FieldT> burnRateMerkleRoot;
    libsnark::dual_variable_gadget<FieldT> timestamp;

    std::vector<VariableArrayT> publicDataBits;

    sha256_many* publicDataHasher;

    MiMC_hash_gadget* hashRootsBefore;
    MiMC_hash_gadget* hashRootsAfter;

    const VariableT accountsRootBefore;
    const VariableT tradeHistoryBefore;
    const VariableT feesRootBefore;

    VariableT constant0;
    VariableT constant1;

    const jubjub::VariablePointT publicKey;
    libsnark::dual_variable_gadget<FieldT> operatorAccountID;
    const VariableT balancesRoot_before;
    VariableT balance_O_before;

    UpdateBalanceGadget* updateBalance_O;
    UpdateAccountGadget* updateAccount_O;

    TradeCircuitGadget(ProtoboardT& pb, const std::string& prefix) :
        GadgetT(pb, prefix),

        lrcTokenID(make_var_array(pb, TREE_DEPTH_BALANCES, FMT(prefix, ".lrcTokenID"))),

        publicDataHash(pb, 256, FMT(prefix, ".publicDataHash")),

        stateID(pb, 16, FMT(prefix, ".stateID")),

        merkleRootBefore(pb, 256, FMT(prefix, ".merkleRootBefore")),
        merkleRootAfter(pb, 256, FMT(prefix, ".merkleRootAfter")),
        burnRateMerkleRoot(pb, 256, FMT(prefix, ".burnRateMerkleRoot")),
        accountsRootBefore(make_variable(pb, FMT(prefix, ".accountsRootBefore"))),
        tradeHistoryBefore(make_variable(pb, FMT(prefix, ".tradeHistoryBefore"))),
        feesRootBefore(make_variable(pb, FMT(prefix, ".feesRootBefore"))),

        constant0(make_variable(pb, 0, FMT(prefix, ".constant0"))),
        constant1(make_variable(pb, 1, FMT(prefix, ".constant1"))),

        publicKey(pb, FMT(prefix, ".publicKey")),
        operatorAccountID(pb, TREE_DEPTH_ACCOUNTS, FMT(prefix, ".operator")),
        balance_O_before(make_variable(pb, FMT(prefix, ".balance_O_before"))),
        balancesRoot_before(make_variable(pb, FMT(prefix, ".balancesRoot_before"))),
        timestamp(pb, 32, FMT(prefix, ".timestamp"))
    {
        this->publicDataHasher = nullptr;
        this->updateAccount_O = nullptr;
    }

    ~TradeCircuitGadget()
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

        if (updateAccount_O)
        {
            delete updateAccount_O;
        }

        if (updateBalance_O)
        {
            delete updateBalance_O;
        }

        for(unsigned int i = 0; i < ringSettlements.size(); i++)
        {
            delete ringSettlements[i];
        }
    }

    void generate_r1cs_constraints(int numRings)
    {
        this->numRings = numRings;

        pb.set_input_sizes(1);

        stateID.generate_r1cs_constraints(true);
        merkleRootBefore.generate_r1cs_constraints(true);
        merkleRootAfter.generate_r1cs_constraints(true);
        burnRateMerkleRoot.generate_r1cs_constraints(true);
        timestamp.generate_r1cs_constraints(true);

        publicDataBits.push_back(stateID.bits);
        publicDataBits.push_back(merkleRootBefore.bits);
        publicDataBits.push_back(merkleRootAfter.bits);
        publicDataBits.push_back(burnRateMerkleRoot.bits);
        publicDataBits.push_back(timestamp.bits);
        for (size_t j = 0; j < numRings; j++)
        {
            const VariableT ringAccountsRoot = (j == 0) ? accountsRootBefore : ringSettlements.back()->getNewAccountsRoot();
            const VariableT ringFeesRoot = (j == 0) ? feesRootBefore : ringSettlements.back()->getNewFeesRoot();
            const VariableT& ringOperatorBalance = (j == 0) ? balance_O_before : ringSettlements.back()->getOperatorBalance();
            ringSettlements.push_back(new RingSettlementGadget(
                pb,
                params,
                stateID.packed,
                ringAccountsRoot,
                ringFeesRoot,
                burnRateMerkleRoot.packed,
                timestamp.packed,
                ringOperatorBalance,
                std::string("trade_") + std::to_string(j)
            ));
            ringSettlements.back()->generate_r1cs_constraints();

            // Store transfers from ring settlement
            std::vector<VariableArrayT> ringPublicData = ringSettlements.back()->getPublicData();
            publicDataBits.insert(publicDataBits.end(), ringPublicData.begin(), ringPublicData.end());
        }

        updateBalance_O = new UpdateBalanceGadget(pb, balancesRoot_before, lrcTokenID,
                      {balance_O_before, tradeHistoryBefore},
                      {ringSettlements.back()->getOperatorBalance(), tradeHistoryBefore},
                      FMT(annotation_prefix, ".updateBalance_O"));
        updateBalance_O->generate_r1cs_constraints();

        updateAccount_O = new UpdateAccountGadget(pb, ringSettlements.back()->getNewAccountsRoot(), operatorAccountID.bits,
                      {publicKey.x, publicKey.y, constant0, constant0, balancesRoot_before},
                      {publicKey.x, publicKey.y, constant0, constant0, updateBalance_O->getNewRoot()},
                      FMT(annotation_prefix, ".updateAccount_O"));
        updateAccount_O->generate_r1cs_constraints();


        publicDataHash.generate_r1cs_constraints(true);

        // Check public data
        publicDataHasher = new sha256_many(pb, flattenReverse(publicDataBits), ".publicDataHash");
        publicDataHasher->generate_r1cs_constraints();

        // Check that the hash matches the public input
        for (unsigned int i = 0; i < 256; i++)
        {
            pb.add_r1cs_constraint(ConstraintT(publicDataHasher->result().bits[255-i], 1, publicDataHash.bits[i]), "publicData.check()");
        }

        hashRootsBefore = new MiMC_hash_gadget(pb, libsnark::ONE, {accountsRootBefore, feesRootBefore}, FMT(annotation_prefix, ".rootBefore"));
        hashRootsBefore->generate_r1cs_constraints();
        hashRootsAfter = new MiMC_hash_gadget(pb, libsnark::ONE, {updateAccount_O->result(), ringSettlements.back()->getNewFeesRoot()}, FMT(annotation_prefix, ".rootAfter"));
        hashRootsAfter->generate_r1cs_constraints();

        // Make sure the merkle roots are correctly passed in
        pb.add_r1cs_constraint(ConstraintT(hashRootsBefore->result(), 1, merkleRootBefore.packed), "oldMerkleRoot");
        pb.add_r1cs_constraint(ConstraintT(hashRootsAfter->result(), 1, merkleRootAfter.packed), "newMerkleRoot");
    }

    void printInfo()
    {
        std::cout << pb.num_constraints() << " constraints (" << (pb.num_constraints() / numRings) << "/ring)" << std::endl;
    }

    bool generateWitness(const TradeContext& context)
    {
        if (context.ringSettlements.size() != numRings)
        {
            std::cout << "Invalid number of rings: " << context.ringSettlements.size()  << std::endl;
            return false;
        }

        lrcTokenID.fill_with_bits_of_ulong(pb, 1);

        stateID.bits.fill_with_bits_of_field_element(pb, context.stateID);
        stateID.generate_r1cs_witness_from_bits();

        merkleRootBefore.bits.fill_with_bits_of_field_element(pb, context.merkleRootBefore);
        merkleRootBefore.generate_r1cs_witness_from_bits();
        merkleRootAfter.bits.fill_with_bits_of_field_element(pb, context.merkleRootAfter);
        merkleRootAfter.generate_r1cs_witness_from_bits();

        burnRateMerkleRoot.bits.fill_with_bits_of_field_element(pb, context.burnRateMerkleRoot);
        burnRateMerkleRoot.generate_r1cs_witness_from_bits();

        timestamp.bits.fill_with_bits_of_field_element(pb, context.timestamp);
        timestamp.generate_r1cs_witness_from_bits();

        operatorAccountID.bits.fill_with_bits_of_field_element(pb, context.operatorAccountID);
        operatorAccountID.generate_r1cs_witness_from_bits();

        pb.val(accountsRootBefore) = context.ringSettlements[0].accountUpdate_A.rootBefore;
        pb.val(feesRootBefore) = context.ringSettlements[0].feeTokenUpdate_FA.rootBefore;

        pb.val(publicKey.x) = context.accountUpdate_O.before.publicKey.x;
        pb.val(publicKey.y) = context.accountUpdate_O.before.publicKey.y;

        for(unsigned int i = 0; i < context.ringSettlements.size(); i++)
        {
            ringSettlements[i]->generate_r1cs_witness(context.ringSettlements[i]);
        }

        pb.val(balance_O_before) = context.balanceUpdate_O.before.balance;

        pb.val(balancesRoot_before) = context.accountUpdate_O.before.balancesRoot;
        pb.val(tradeHistoryBefore) = context.balanceUpdate_O.before.tradingHistoryRoot;

        updateBalance_O->generate_r1cs_witness(context.balanceUpdate_O.proof);
        updateAccount_O->generate_r1cs_witness(context.accountUpdate_O.proof);

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
        printBits("publicDataHash: 0x", flattenReverse({publicDataHasher->result().bits}).get_bits(pb), true);

        return true;
    }
};

}

#endif
