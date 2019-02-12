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
    const VariableT tradingHistoryMerkleRoot;
    const VariableT accountsMerkleRoot;

    VariableT constant0;
    VariableT constant1;

    const jubjub::VariablePointT publicKey;
    libsnark::dual_variable_gadget<FieldT> nonce;

    OrderGadget orderA;
    OrderGadget orderB;

    OrderMatchingGadget orderMatching;

    VariableT ordersValid;
    VariableT valid;

    VariableArrayT orderIDPadding;

    libsnark::dual_variable_gadget<FieldT> fillS_A;
    libsnark::dual_variable_gadget<FieldT> fillB_A;
    libsnark::dual_variable_gadget<FieldT> fillF_A;
    libsnark::dual_variable_gadget<FieldT> fillS_B;
    libsnark::dual_variable_gadget<FieldT> fillB_B;
    libsnark::dual_variable_gadget<FieldT> fillF_B;
    libsnark::dual_variable_gadget<FieldT> margin;
    libsnark::dual_variable_gadget<FieldT> miner;
    libsnark::dual_variable_gadget<FieldT> fee;

    VariableT filledAfterA;
    VariableT filledAfterB;

    VariableT burnRateF_A;
    VariableT burnRateF_B;

    CheckBurnRateGadget checkBurnRateF_A;
    CheckBurnRateGadget checkBurnRateF_B;

    FeePaymentCalculator feePaymentA;
    FeePaymentCalculator feePaymentB;

    VariableT balanceS_A_before;
    VariableT balanceB_A_before;
    VariableT balanceF_A_before;
    VariableT balanceF_WA_before;
    VariableT balanceF_MA_before;
    VariableT balanceF_BA_before;
    VariableT balanceS_B_before;
    VariableT balanceB_B_before;
    VariableT balanceF_B_before;
    VariableT balanceF_WB_before;
    VariableT balanceF_MB_before;
    VariableT balanceF_BB_before;
    VariableT balanceS_M_before;
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

    UpdateAccountGadget updateAccountS_A;
    UpdateAccountGadget updateAccountB_A;
    UpdateAccountGadget updateAccountF_A;
    UpdateAccountGadget updateAccountF_WA;
    UpdateAccountGadget updateAccountF_MA;
    UpdateAccountGadget updateAccountF_BA;
    UpdateAccountGadget updateAccountS_B;
    UpdateAccountGadget updateAccountB_B;
    UpdateAccountGadget updateAccountF_B;
    UpdateAccountGadget updateAccountF_WB;
    UpdateAccountGadget updateAccountF_MB;
    UpdateAccountGadget updateAccountF_BB;

    UpdateAccountGadget updateAccountS_M;

    UpdateAccountGadget updateAccount_M;

    ForceLeqGadget filledLeqA;
    ForceLeqGadget filledLeqB;

    const VariableArrayT ringMessage;
    SignatureVerifier minerSignatureVerifier;
    SignatureVerifier walletASignatureVerifier;
    SignatureVerifier walletBSignatureVerifier;

    RingSettlementGadget(
        ProtoboardT& pb,
        const jubjub::Params& params,
        const VariableT& _tradingHistoryMerkleRoot,
        const VariableT& _accountsMerkleRoot,
        const VariableT& _burnRateMerkleRoot,
        const VariableT& _timestamp,
        const VariableT& _operatorBalance,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        constant0(make_variable(pb, 0, FMT(prefix, ".constant0"))),
        constant1(make_variable(pb, 1, FMT(prefix, ".constant1"))),

        publicKey(pb, FMT(prefix, ".publicKey")),
        nonce(pb, 32, FMT(prefix, ".nonce")),

        orderA(pb, params, _timestamp, FMT(prefix, ".orderA")),
        orderB(pb, params, _timestamp, FMT(prefix, ".orderB")),

        orderMatching(pb, orderA, orderB, FMT(prefix, ".orderMatching")),

        ordersValid(make_variable(pb, FMT(prefix, ".ordersValid"))),
        valid(make_variable(pb, FMT(prefix, ".valid"))),

        orderIDPadding(make_var_array(pb, 12, FMT(prefix, ".orderIDPadding"))),

        fillS_A(pb, 96, FMT(prefix, ".fillS_A")),
        fillB_A(pb, 96, FMT(prefix, ".fillB_A")),
        fillF_A(pb, 96, FMT(prefix, ".fillF_A")),
        fillS_B(pb, 96, FMT(prefix, ".fillS_B")),
        fillB_B(pb, 96, FMT(prefix, ".fillB_B")),
        fillF_B(pb, 96, FMT(prefix, ".fillF_B")),
        margin(pb, 96, FMT(prefix, ".margin")),
        miner(pb, TREE_DEPTH_ACCOUNTS, FMT(prefix, ".miner")),
        fee(pb, 16, FMT(prefix, ".fee")),

        filledAfterA(make_variable(pb, FMT(prefix, ".filledAfterA"))),
        filledAfterB(make_variable(pb, FMT(prefix, ".filledAfterB"))),

        burnRateF_A(make_variable(pb, FMT(prefix, ".burnRateF_A"))),
        burnRateF_B(make_variable(pb, FMT(prefix, ".burnRateF_B"))),

        checkBurnRateF_A(pb, _burnRateMerkleRoot, orderA.tokenF.bits, burnRateF_A, FMT(prefix, ".checkBurnRateF_A")),
        checkBurnRateF_B(pb, _burnRateMerkleRoot, orderB.tokenF.bits, burnRateF_B, FMT(prefix, ".checkBurnRateF_B")),

        feePaymentA(pb, fillF_A.packed, burnRateF_A, orderA.walletSplitPercentage.packed, orderA.waiveFeePercentage.packed, FMT(prefix, "feePaymentA")),
        feePaymentB(pb, fillF_B.packed, burnRateF_B, orderB.walletSplitPercentage.packed, orderB.waiveFeePercentage.packed, FMT(prefix, "feePaymentB")),

        balanceS_A_before(make_variable(pb, FMT(prefix, ".balanceS_A_before"))),
        balanceB_A_before(make_variable(pb, FMT(prefix, ".balanceB_A_before"))),
        balanceF_A_before(make_variable(pb, FMT(prefix, ".balanceF_A_before"))),
        balanceF_WA_before(make_variable(pb, FMT(prefix, ".balanceF_WA_before"))),
        balanceF_MA_before(make_variable(pb, FMT(prefix, ".balanceF_MA_before"))),
        balanceF_BA_before(make_variable(pb, FMT(prefix, ".balanceF_BA_before"))),
        balanceS_B_before(make_variable(pb, FMT(prefix, ".balanceS_B_before"))),
        balanceB_B_before(make_variable(pb, FMT(prefix, ".balanceB_B_before"))),
        balanceF_B_before(make_variable(pb, FMT(prefix, ".balanceF_B_before"))),
        balanceF_WB_before(make_variable(pb, FMT(prefix, ".balanceF_WB_before"))),
        balanceF_MB_before(make_variable(pb, FMT(prefix, ".balanceF_MB_before"))),
        balanceF_BB_before(make_variable(pb, FMT(prefix, ".balanceF_BB_before"))),
        balanceS_M_before(make_variable(pb, FMT(prefix, ".balanceS_M_before"))),
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

        tradingHistoryMerkleRoot(_tradingHistoryMerkleRoot),
        updateTradeHistoryA(pb, tradingHistoryMerkleRoot, flatten({orderA.orderID.bits, orderA.accountS.bits}),
                            orderA.filledBefore, orderA.cancelled, filledAfterA, orderA.cancelled, FMT(prefix, ".updateTradeHistoryA")),
        updateTradeHistoryB(pb, updateTradeHistoryA.getNewTradingHistoryMerkleRoot(), flatten({orderB.orderID.bits, orderB.accountS.bits}),
                            orderB.filledBefore, orderB.cancelled, filledAfterB, orderB.cancelled, FMT(prefix, ".updateTradeHistoryB")),

        accountsMerkleRoot(_accountsMerkleRoot),
        updateAccountS_A(pb, accountsMerkleRoot, orderA.accountS.bits, orderA.publicKey, orderA.walletID.packed, orderA.tokenS, balanceS_A_before, balanceS_MA.X, FMT(prefix, ".updateAccountS_A")),
        updateAccountB_A(pb, updateAccountS_A.result(), orderA.accountB.bits, orderA.publicKey, orderA.walletID.packed, orderA.tokenB, balanceB_A_before, balanceSB_B.Y, FMT(prefix, ".updateAccountB_A")),
        updateAccountF_A(pb, updateAccountB_A.result(), orderA.accountF.bits, orderA.publicKey, orderA.walletID.packed, orderA.tokenF.packed, balanceF_A_before, balanceF_BA.X, FMT(prefix, ".updateAccountF_A")),
        updateAccountF_WA(pb, updateAccountF_A.result(), orderA.walletF.bits, orderA.walletPublicKey, orderA.walletID.packed, orderA.tokenF.packed, balanceF_WA_before, balanceF_WA.Y, FMT(prefix, ".updateAccountF_WA")),
        updateAccountF_MA(pb, updateAccountF_WA.result(), orderA.minerF.bits, orderA.minerPublicKeyF, orderA.walletID.packed, orderA.tokenF.packed, balanceF_MA_before, balanceF_MA.Y, FMT(prefix, ".updateAccountF_MA")),
        updateAccountF_BA(pb, updateAccountF_MA.result(), orderA.walletF.bits, orderA.walletPublicKey, orderA.walletID.packed, orderA.tokenF.packed, balanceF_BA_before, balanceF_BA.Y, FMT(prefix, ".updateAccountF_BA")),

        updateAccountS_B(pb, updateAccountF_BA.result(), orderB.accountS.bits, orderB.publicKey, orderB.walletID.packed, orderB.tokenS, balanceS_B_before, balanceSB_B.X, FMT(prefix, ".updateAccountS_B")),
        updateAccountB_B(pb, updateAccountS_B.result(), orderB.accountB.bits, orderB.publicKey, orderB.walletID.packed, orderB.tokenB, balanceB_B_before, balanceSB_A.Y, FMT(prefix, ".updateAccountB_B")),
        updateAccountF_B(pb, updateAccountB_B.result(), orderB.accountF.bits, orderB.publicKey, orderB.walletID.packed, orderB.tokenF.packed, balanceF_B_before, balanceF_BB.X, FMT(prefix, ".updateAccountF_B")),
        updateAccountF_WB(pb, updateAccountF_B.result(), orderB.walletF.bits, orderB.walletPublicKey, orderB.walletID.packed, orderB.tokenF.packed, balanceF_WB_before, balanceF_WB.Y, FMT(prefix, ".updateAccountF_WB")),
        updateAccountF_MB(pb, updateAccountF_WB.result(), orderB.minerF.bits, orderB.minerPublicKeyF, orderB.walletID.packed, orderB.tokenF.packed, balanceF_MB_before, balanceF_MB.Y, FMT(prefix, ".updateAccountF_MB")),
        updateAccountF_BB(pb, updateAccountF_MB.result(), orderB.walletF.bits, orderB.walletPublicKey, orderB.walletID.packed, orderB.tokenF.packed, balanceF_BB_before, balanceF_BB.Y, FMT(prefix, ".updateAccountF_BB")),

        updateAccountS_M(pb, updateAccountF_BB.result(), orderA.minerS.bits, orderA.minerPublicKeyS, constant0, orderA.tokenS, balanceS_M_before, balanceS_MA.Y, FMT(prefix, ".updateAccountS_M")),

        updateAccount_M(pb, updateAccountS_M.result(), miner.bits, publicKey, constant0, constant1, balance_M_before, balance_M.X, FMT(prefix, ".updateAccount_M")),

        filledLeqA(pb, filledAfterA, orderA.amountS.packed, FMT(prefix, ".filled_A <= .amountSA")),
        filledLeqB(pb, filledAfterB, orderB.amountS.packed, FMT(prefix, ".filled_B <= .amountSB")),

        ringMessage(flatten({orderA.getHash(), orderB.getHash(),
                             orderA.waiveFeePercentage.bits, orderB.waiveFeePercentage.bits,
                             orderA.minerF.bits, orderB.minerF.bits,
                             orderA.minerS.bits,
                             nonce.bits})),
        minerSignatureVerifier(pb, params, publicKey, ringMessage, FMT(prefix, ".minerSignatureVerifier")),
        walletASignatureVerifier(pb, params, orderA.walletPublicKey, ringMessage, FMT(prefix, ".walletASignatureVerifier")),
        walletBSignatureVerifier(pb, params, orderB.walletPublicKey, ringMessage, FMT(prefix, ".walletBSignatureVerifier"))
    {

    }

    const VariableT getNewTradingHistoryMerkleRoot() const
    {
        return updateTradeHistoryB.getNewTradingHistoryMerkleRoot();
    }

    const VariableT getNewAccountsMerkleRoot() const
    {
        return updateAccount_M.result();
    }

    const VariableT& getOperatorBalance() const
    {
        return balance_M.Y;
    }

    const std::vector<VariableArrayT> getPublicData() const
    {
        return {orderA.walletID.bits, orderIDPadding, orderA.orderID.bits,
                orderA.accountS.bits, orderB.accountB.bits, fillS_A.bits,
                orderA.accountF.bits, fillF_A.bits,

                orderB.walletID.bits, orderIDPadding, orderB.orderID.bits,
                orderB.accountS.bits, orderA.accountB.bits, fillS_B.bits,
                orderB.accountF.bits, fillF_B.bits};
    }

    void generate_r1cs_witness (const RingSettlement& ringSettlement)
    {
        pb.val(publicKey.x) = ringSettlement.ring.publicKey.x;
        pb.val(publicKey.y) = ringSettlement.ring.publicKey.y;

        nonce.bits.fill_with_bits_of_field_element(pb, 0);
        nonce.generate_r1cs_witness_from_bits();


        orderA.generate_r1cs_witness(ringSettlement.ring.orderA);
        orderB.generate_r1cs_witness(ringSettlement.ring.orderB);

        orderMatching.generate_r1cs_witness();

        pb.val(ordersValid) = pb.val(orderA.isValid()) * pb.val(orderB.isValid());
        pb.val(valid) = ringSettlement.ring.valid;

        orderIDPadding.fill_with_bits_of_ulong(pb, 0);

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
        miner.bits.fill_with_bits_of_field_element(pb, ringSettlement.ring.miner);
        miner.generate_r1cs_witness_from_bits();
        fee.bits.fill_with_bits_of_field_element(pb, ringSettlement.ring.fee);
        fee.generate_r1cs_witness_from_bits();

        pb.val(filledAfterA) = pb.val(orderA.filledBefore) + pb.val(fillS_A.packed);
        pb.val(filledAfterB) = pb.val(orderB.filledBefore) + pb.val(fillS_B.packed);

        pb.val(burnRateF_A) = ringSettlement.burnRateCheckF_A.burnRateData.burnRate;
        pb.val(burnRateF_B) = ringSettlement.burnRateCheckF_B.burnRateData.burnRate;
        checkBurnRateF_A.generate_r1cs_witness(ringSettlement.burnRateCheckF_A.proof);
        checkBurnRateF_B.generate_r1cs_witness(ringSettlement.burnRateCheckF_B.proof);

        feePaymentA.generate_r1cs_witness();
        feePaymentB.generate_r1cs_witness();

        pb.val(balanceS_A_before) = ringSettlement.accountUpdateS_A.before.balance;
        pb.val(balanceB_A_before) = ringSettlement.accountUpdateB_A.before.balance;
        pb.val(balanceF_A_before) = ringSettlement.accountUpdateF_A.before.balance;
        pb.val(balanceF_WA_before) = ringSettlement.accountUpdateF_WA.before.balance;
        pb.val(balanceF_MA_before) = ringSettlement.accountUpdateF_MA.before.balance;
        pb.val(balanceF_BA_before) = ringSettlement.accountUpdateF_BA.before.balance;
        pb.val(balanceS_B_before) = ringSettlement.accountUpdateS_B.before.balance;
        pb.val(balanceB_B_before) = ringSettlement.accountUpdateB_B.before.balance;
        pb.val(balanceF_B_before) = ringSettlement.accountUpdateF_B.before.balance;
        pb.val(balanceF_WB_before) = ringSettlement.accountUpdateF_WB.before.balance;
        pb.val(balanceF_MB_before) = ringSettlement.accountUpdateF_MB.before.balance;
        pb.val(balanceF_BB_before) = ringSettlement.accountUpdateF_BB.before.balance;
        pb.val(balanceS_M_before) = ringSettlement.accountUpdateS_M.before.balance;
        pb.val(balance_M_before) = ringSettlement.accountUpdate_M.before.balance;

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

        pb.val(tradingHistoryMerkleRoot) = ringSettlement.tradingHistoryMerkleRoot;
        updateTradeHistoryA.generate_r1cs_witness(ringSettlement.tradeHistoryUpdate_A.proof);
        updateTradeHistoryB.generate_r1cs_witness(ringSettlement.tradeHistoryUpdate_B.proof);

        filledLeqA.generate_r1cs_witness();
        filledLeqB.generate_r1cs_witness();

        //
        // Update accounts
        //

        updateAccountS_A.generate_r1cs_witness(ringSettlement.accountUpdateS_A.proof);
        updateAccountB_A.generate_r1cs_witness(ringSettlement.accountUpdateB_A.proof);
        updateAccountF_A.generate_r1cs_witness(ringSettlement.accountUpdateF_A.proof);
        updateAccountF_WA.generate_r1cs_witness(ringSettlement.accountUpdateF_WA.proof);
        updateAccountF_MA.generate_r1cs_witness(ringSettlement.accountUpdateF_MA.proof);
        updateAccountF_BA.generate_r1cs_witness(ringSettlement.accountUpdateF_BA.proof);
        updateAccountS_B.generate_r1cs_witness(ringSettlement.accountUpdateS_B.proof);
        updateAccountB_B.generate_r1cs_witness(ringSettlement.accountUpdateB_B.proof);
        updateAccountF_B.generate_r1cs_witness(ringSettlement.accountUpdateF_B.proof);
        updateAccountF_WB.generate_r1cs_witness(ringSettlement.accountUpdateF_WB.proof);
        updateAccountF_MB.generate_r1cs_witness(ringSettlement.accountUpdateF_MB.proof);
        updateAccountF_BB.generate_r1cs_witness(ringSettlement.accountUpdateF_BB.proof);
        updateAccountS_M.generate_r1cs_witness(ringSettlement.accountUpdateS_M.proof);
        updateAccount_M.generate_r1cs_witness(ringSettlement.accountUpdate_M.proof);

        minerSignatureVerifier.generate_r1cs_witness(ringSettlement.ring.minerSignature);
        walletASignatureVerifier.generate_r1cs_witness(ringSettlement.ring.walletASignature);
        walletBSignatureVerifier.generate_r1cs_witness(ringSettlement.ring.walletBSignature);
    }


    void generate_r1cs_constraints()
    {
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
        miner.generate_r1cs_constraints(true);
        fee.generate_r1cs_constraints(true);
        margin.generate_r1cs_constraints(true);

        pb.add_r1cs_constraint(ConstraintT(orderA.filledBefore + fillS_A.packed, 1, filledAfterA), "filledBeforeA + fillA = filledAfterA");
        pb.add_r1cs_constraint(ConstraintT(orderB.filledBefore + fillS_B.packed, 1, filledAfterB), "filledBeforeB + fillB = filledAfterB");

        checkBurnRateF_A.generate_r1cs_constraints();
        checkBurnRateF_B.generate_r1cs_constraints();

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

        filledLeqA.generate_r1cs_constraints();
        filledLeqB.generate_r1cs_constraints();

        //
        // Update accounts
        //

        updateAccountS_A.generate_r1cs_constraints();
        updateAccountB_A.generate_r1cs_constraints();
        updateAccountF_A.generate_r1cs_constraints();
        updateAccountF_WA.generate_r1cs_constraints();
        updateAccountF_MA.generate_r1cs_constraints();
        updateAccountF_BA.generate_r1cs_constraints();
        updateAccountS_B.generate_r1cs_constraints();
        updateAccountB_B.generate_r1cs_constraints();
        updateAccountF_B.generate_r1cs_constraints();
        updateAccountF_WB.generate_r1cs_constraints();
        updateAccountF_MB.generate_r1cs_constraints();
        updateAccountF_BB.generate_r1cs_constraints();
        updateAccountS_M.generate_r1cs_constraints();
        updateAccount_M.generate_r1cs_constraints();

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

    libsnark::dual_variable_gadget<FieldT> publicDataHash;
    libsnark::dual_variable_gadget<FieldT> tradingHistoryMerkleRootBefore;
    libsnark::dual_variable_gadget<FieldT> tradingHistoryMerkleRootAfter;
    libsnark::dual_variable_gadget<FieldT> accountsMerkleRootBefore;
    libsnark::dual_variable_gadget<FieldT> accountsMerkleRootAfter;
    libsnark::dual_variable_gadget<FieldT> burnRateMerkleRoot;
    libsnark::dual_variable_gadget<FieldT> timestamp;

    std::vector<VariableArrayT> publicDataBits;

    sha256_many* publicDataHasher;

    VariableT constant0;
    VariableT constant1;

    const jubjub::VariablePointT publicKey;
    libsnark::dual_variable_gadget<FieldT> operatorID;
    VariableT balance_O_before;
    UpdateAccountGadget* updateAccount_O;

    TradeCircuitGadget(ProtoboardT& pb, const std::string& prefix) :
        GadgetT(pb, prefix),

        publicDataHash(pb, 256, FMT(prefix, ".publicDataHash")),

        tradingHistoryMerkleRootBefore(pb, 256, FMT(prefix, ".tradingHistoryMerkleRootBefore")),
        tradingHistoryMerkleRootAfter(pb, 256, FMT(prefix, ".tradingHistoryMerkleRootAfter")),
        accountsMerkleRootBefore(pb, 256, FMT(prefix, ".accountsMerkleRootBefore")),
        accountsMerkleRootAfter(pb, 256, FMT(prefix, ".accountsMerkleRootAfter")),
        burnRateMerkleRoot(pb, 256, FMT(prefix, ".burnRateMerkleRoot")),
        constant0(make_variable(pb, 0, FMT(prefix, ".constant0"))),
        constant1(make_variable(pb, 1, FMT(prefix, ".constant1"))),
        publicKey(pb, FMT(prefix, ".publicKey")),
        operatorID(pb, TREE_DEPTH_ACCOUNTS, FMT(prefix, ".operator")),
        balance_O_before(make_variable(pb, FMT(prefix, ".balance_O_before"))),
        timestamp(pb, 32, FMT(prefix, ".timestamp"))
    {
        this->publicDataHasher = nullptr;
        this->updateAccount_O = nullptr;
    }

    ~TradeCircuitGadget()
    {
        if (publicDataHasher)
        {
            delete publicDataHasher;
        }

        if (updateAccount_O)
        {
            delete updateAccount_O;
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

        tradingHistoryMerkleRootBefore.generate_r1cs_constraints(true);
        tradingHistoryMerkleRootAfter.generate_r1cs_constraints(true);
        accountsMerkleRootBefore.generate_r1cs_constraints(true);
        accountsMerkleRootAfter.generate_r1cs_constraints(true);
        burnRateMerkleRoot.generate_r1cs_constraints(true);
        timestamp.generate_r1cs_constraints(true);

        publicDataBits.push_back(accountsMerkleRootBefore.bits);
        publicDataBits.push_back(accountsMerkleRootAfter.bits);
        publicDataBits.push_back(tradingHistoryMerkleRootBefore.bits);
        publicDataBits.push_back(tradingHistoryMerkleRootAfter.bits);
        publicDataBits.push_back(burnRateMerkleRoot.bits);
        publicDataBits.push_back(timestamp.bits);
        for (size_t j = 0; j < numRings; j++)
        {
            const VariableT ringTradingHistoryMerkleRoot = (j == 0) ? tradingHistoryMerkleRootBefore.packed : ringSettlements.back()->getNewTradingHistoryMerkleRoot();
            const VariableT ringAccountsMerkleRoot = (j == 0) ? accountsMerkleRootBefore.packed : ringSettlements.back()->getNewAccountsMerkleRoot();
            const VariableT& ringOperatorBalance = (j == 0) ? balance_O_before : ringSettlements.back()->getOperatorBalance();
            ringSettlements.push_back(new RingSettlementGadget(
                pb,
                params,
                ringTradingHistoryMerkleRoot,
                ringAccountsMerkleRoot,
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

        updateAccount_O = new UpdateAccountGadget(pb, ringSettlements.back()->getNewAccountsMerkleRoot(), operatorID.bits, publicKey, constant0, constant1, balance_O_before, ringSettlements.back()->getOperatorBalance(), ".updateAccount_O");
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

        // Make sure the merkle roots afterwards are correctly passed in
        pb.add_r1cs_constraint(ConstraintT(updateAccount_O->result(), 1, accountsMerkleRootAfter.packed), "newAccountsMerkleRoot");
        pb.add_r1cs_constraint(ConstraintT(ringSettlements.back()->getNewTradingHistoryMerkleRoot(), 1, tradingHistoryMerkleRootAfter.packed), "newTradingHistoryMerkleRoot");
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

        tradingHistoryMerkleRootBefore.bits.fill_with_bits_of_field_element(pb, context.tradingHistoryMerkleRootBefore);
        tradingHistoryMerkleRootBefore.generate_r1cs_witness_from_bits();
        tradingHistoryMerkleRootAfter.bits.fill_with_bits_of_field_element(pb, context.tradingHistoryMerkleRootAfter);
        tradingHistoryMerkleRootAfter.generate_r1cs_witness_from_bits();

        accountsMerkleRootBefore.bits.fill_with_bits_of_field_element(pb, context.accountsMerkleRootBefore);
        accountsMerkleRootBefore.generate_r1cs_witness_from_bits();
        accountsMerkleRootAfter.bits.fill_with_bits_of_field_element(pb, context.accountsMerkleRootAfter);
        accountsMerkleRootAfter.generate_r1cs_witness_from_bits();

        burnRateMerkleRoot.bits.fill_with_bits_of_field_element(pb, context.burnRateMerkleRoot);
        burnRateMerkleRoot.generate_r1cs_witness_from_bits();

        timestamp.bits.fill_with_bits_of_field_element(pb, context.timestamp);
        timestamp.generate_r1cs_witness_from_bits();

        operatorID.bits.fill_with_bits_of_field_element(pb, context.operatorID);
        operatorID.generate_r1cs_witness_from_bits();

        pb.val(publicKey.x) = context.accountUpdate_O.before.publicKey.x;
        pb.val(publicKey.y) = context.accountUpdate_O.before.publicKey.y;

        for(unsigned int i = 0; i < context.ringSettlements.size(); i++)
        {
            ringSettlements[i]->generate_r1cs_witness(context.ringSettlements[i]);
        }

        pb.val(balance_O_before) = context.accountUpdate_O.before.balance;
        updateAccount_O->generate_r1cs_witness(context.accountUpdate_O.proof);

        publicDataHasher->generate_r1cs_witness();

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

        return true;
    }
};

}

#endif
