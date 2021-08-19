// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
#ifndef _SPOTTRADECIRCUIT_H_
#define _SPOTTRADECIRCUIT_H_

#include "Circuit.h"
#include "../Utils/Constants.h"
#include "../Utils/Data.h"

#include "ethsnarks.hpp"
#include "utils.hpp"

using namespace ethsnarks;

namespace Loopring
{

class SpotTradeCircuit : public BaseTransactionCircuit
{
  public:
    // Orders
    OrderGadget orderA;
    OrderGadget orderB;

    // Balances
    DynamicBalanceGadget balanceS_A;
    DynamicBalanceGadget balanceB_A;
    DynamicBalanceGadget balanceS_B;
    DynamicBalanceGadget balanceB_B;
    DynamicBalanceGadget balanceA_P;
    DynamicBalanceGadget balanceB_P;
    DynamicBalanceGadget balanceA_O;
    DynamicBalanceGadget balanceB_O;

    // Order fills
    FloatGadget fillS_A;
    FloatGadget fillS_B;

    // Trade history
    EqualGadget isSpotTradeTx;
    StorageReaderGadget tradeHistory_A;
    StorageReaderGadget tradeHistory_B;

    // Match orders
    OrderMatchingGadget orderMatching;

    // Calculate fees
    TernaryGadget protocolTakerFeeBips;
    TernaryGadget protocolMakerFeeBips;
    TernaryGadget protocolFeeSA;
    TernaryGadget protocolFeeBA;
    TernaryGadget protocolFeeSB;
    TernaryGadget protocolFeeBB;
    FeeCalculatorGadget feeCalculatorSA;
    FeeCalculatorGadget feeCalculatorBA;
    FeeCalculatorGadget feeCalculatorSB;
    FeeCalculatorGadget feeCalculatorBB;

    /* Token Transfers */
    // Actual trade
    TransferGadget fillSA_from_balanceSA_to_balanceBB;
    TransferGadget fillSB_from_balanceSB_to_balanceBA;
    // Fees
    TransferGadget feeSA_from_balanceSA_to_balanceBO;
    TransferGadget feeBA_from_balanceBA_to_balanceAO;
    TransferGadget feeSB_from_balanceSB_to_balanceAO;
    TransferGadget feeBB_from_balanceBB_to_balanceBO;
    // Protocol fees
    TransferGadget protocolFeeSA_from_balanceBO_to_balanceBP;
    TransferGadget protocolFeeBA_from_balanceAO_to_balanceAP;
    TransferGadget protocolFeeSB_from_balanceAO_to_balanceAP;
    TransferGadget protocolFeeBB_from_balanceBO_to_balanceBP;

    // Token data
    TokenTradeDataGadget tokenTransferDataGadget_AtoB;
    TokenTradeDataGadget tokenTransferDataGadget_BtoA;

    // AMM validation
    ValidateAMMGadget validateAMM;

    SpotTradeCircuit( //
      ProtoboardT &pb,
      const TransactionState &state,
      const std::string &prefix)
        : BaseTransactionCircuit(pb, state, prefix),

          // Orders
          orderA(pb, state.constants, state.exchange, FMT(prefix, ".orderA")),
          orderB(pb, state.constants, state.exchange, FMT(prefix, ".orderB")),

          // Balances
          balanceS_A(pb, state.accountA.balanceS, FMT(prefix, ".balanceS_A")),
          balanceB_A(pb, state.accountA.balanceB, FMT(prefix, ".balanceB_A")),
          balanceS_B(pb, state.accountB.balanceS, FMT(prefix, ".balanceS_B")),
          balanceB_B(pb, state.accountB.balanceB, FMT(prefix, ".balanceB_B")),
          balanceA_P(pb, state.pool.balanceA, FMT(prefix, ".balanceA_P")),
          balanceB_P(pb, state.pool.balanceB, FMT(prefix, ".balanceB_P")),
          balanceA_O(pb, state.oper.balanceA, FMT(prefix, ".balanceA_O")),
          balanceB_O(pb, state.oper.balanceB, FMT(prefix, ".balanceB_O")),

          // Order fills
          fillS_A(pb, state.constants, Float24Encoding, FMT(prefix, ".fillS_A")),
          fillS_B(pb, state.constants, Float24Encoding, FMT(prefix, ".fillS_B")),

          // Trade history
          isSpotTradeTx(pb, state.type, state.constants.txTypeSpotTrade, FMT(prefix, ".isSpotTradeTx")),
          tradeHistory_A(
            pb,
            state.constants,
            state.accountA.storage,
            orderA.storageID,
            isSpotTradeTx.result(),
            FMT(prefix, ".tradeHistoryA")),
          tradeHistory_B(
            pb,
            state.constants,
            state.accountB.storage,
            orderB.storageID,
            isSpotTradeTx.result(),
            FMT(prefix, ".tradeHistoryB")),

          // Match orders
          orderMatching(
            pb,
            state.constants,
            state.timestamp,
            orderA,
            orderB,
            state.accountA.account.owner,
            state.accountB.account.owner,
            tradeHistory_A.getData(),
            tradeHistory_B.getData(),
            fillS_A.value(),
            fillS_B.value(),
            FMT(prefix, ".orderMatching")),

          // Calculate fees
          protocolTakerFeeBips(
            pb,
            orderA.isNftTokenSandB.result(),
            state.constants._0,
            state.protocolTakerFeeBips,
            FMT(prefix, ".protocolTakerFeeBips")),
          protocolMakerFeeBips(
            pb,
            orderB.isNftTokenSandB.result(),
            state.constants._0,
            state.protocolMakerFeeBips,
            FMT(prefix, ".protocolMakerFeeBips")),
          protocolFeeSA(
            pb,
            orderA.isNftTokenB.isNFT(),
            protocolTakerFeeBips.result(),
            state.constants._0,
            FMT(prefix, ".protocolFeeSA")),
          protocolFeeBA(
            pb,
            orderA.isNftTokenB.isNFT(),
            state.constants._0,
            protocolTakerFeeBips.result(),
            FMT(prefix, ".protocolFeeBA")),
          protocolFeeSB(
            pb,
            orderB.isNftTokenB.isNFT(),
            protocolMakerFeeBips.result(),
            state.constants._0,
            FMT(prefix, ".protocolFeeSB")),
          protocolFeeBB(
            pb,
            orderB.isNftTokenB.isNFT(),
            state.constants._0,
            protocolMakerFeeBips.result(),
            FMT(prefix, ".protocolFeeBB")),
          feeCalculatorSA(
            pb,
            state.constants,
            fillS_A.value(),
            protocolFeeSA.result(),
            orderA.feeBipsS.result(),
            FMT(prefix, ".feeCalculatorSA")),
          feeCalculatorBA(
            pb,
            state.constants,
            fillS_B.value(),
            protocolFeeBA.result(),
            orderA.feeBipsB.result(),
            FMT(prefix, ".feeCalculatorBA")),
          feeCalculatorSB(
            pb,
            state.constants,
            fillS_B.value(),
            protocolFeeSB.result(),
            orderB.feeBipsS.result(),
            FMT(prefix, ".feeCalculatorSB")),
          feeCalculatorBB(
            pb,
            state.constants,
            fillS_A.value(),
            protocolFeeBB.result(),
            orderB.feeBipsB.result(),
            FMT(prefix, ".feeCalculatorBB")),

          /* Token Transfers */
          // Actual trade
          fillSA_from_balanceSA_to_balanceBB(
            pb,
            balanceS_A,
            balanceB_B,
            fillS_A.value(),
            FMT(prefix, ".fillSA_from_balanceSA_to_balanceBB")),
          fillSB_from_balanceSB_to_balanceBA(
            pb,
            balanceS_B,
            balanceB_A,
            fillS_B.value(),
            FMT(prefix, ".fillSB_from_balanceSB_to_balanceBA")),
          // Fees
          feeSA_from_balanceSA_to_balanceBO(
            pb,
            balanceS_A,
            balanceB_O,
            feeCalculatorSA.getFee(),
            FMT(prefix, ".feeSA_from_balanceSA_to_balanceBO")),
          feeBA_from_balanceBA_to_balanceAO(
            pb,
            balanceB_A,
            balanceA_O,
            feeCalculatorBA.getFee(),
            FMT(prefix, ".feeBA_from_balanceBA_to_balanceAO")),
          feeSB_from_balanceSB_to_balanceAO(
            pb,
            balanceS_B,
            balanceA_O,
            feeCalculatorSB.getFee(),
            FMT(prefix, ".feeSB_from_balanceSB_to_balanceAO")),
          feeBB_from_balanceBB_to_balanceBO(
            pb,
            balanceB_B,
            balanceB_O,
            feeCalculatorBB.getFee(),
            FMT(prefix, ".feeBB_from_balanceBB_to_balanceBO")),
          // Protocol fees
          protocolFeeSA_from_balanceBO_to_balanceBP(
            pb,
            balanceB_O,
            balanceB_P,
            feeCalculatorSA.getProtocolFee(),
            FMT(prefix, ".protocolFeeSA_from_balanceBO_to_balanceBP")),
          protocolFeeBA_from_balanceAO_to_balanceAP(
            pb,
            balanceA_O,
            balanceA_P,
            feeCalculatorBA.getProtocolFee(),
            FMT(prefix, ".protocolFeeBA_from_balanceAO_to_balanceAP")),
          protocolFeeSB_from_balanceAO_to_balanceAP(
            pb,
            balanceA_O,
            balanceA_P,
            feeCalculatorSB.getProtocolFee(),
            FMT(prefix, ".protocolFeeSB_from_balanceAO_to_balanceAP")),
          protocolFeeBB_from_balanceBO_to_balanceBP(
            pb,
            balanceB_O,
            balanceB_P,
            feeCalculatorBB.getProtocolFee(),
            FMT(prefix, ".protocolFeeBB_from_balanceBO_to_balanceBP")),

          // Token data
          tokenTransferDataGadget_AtoB(
            pb,
            state.constants,
            orderA.tokenS.packed,
            state.accountA.balanceS.weightAMM,
            orderB.tokenB.packed,
            state.accountB.balanceB.weightAMM,
            balanceS_A.balance(),
            isSpotTradeTx.result(),
            orderB.nftDataB,
            FMT(prefix, ".tokenTransferDataGadget_AtoB")),
          tokenTransferDataGadget_BtoA(
            pb,
            state.constants,
            orderB.tokenS.packed,
            state.accountB.balanceS.weightAMM,
            orderA.tokenB.packed,
            state.accountA.balanceB.weightAMM,
            balanceS_B.balance(),
            isSpotTradeTx.result(),
            orderA.nftDataB,
            FMT(prefix, ".tokenTransferDataGadget_BtoA")),

          // AMM validation
          validateAMM(
            pb,
            state.constants,
            {orderA.amm.packed,
             orderA.feeBips.packed,
             fillS_A.value(),
             state.accountA.balanceS.balance,
             state.accountA.balanceB.balance,
             balanceS_A.balance(),
             balanceB_A.balance(),
             state.accountA.balanceS.weightAMM,
             state.accountA.balanceB.weightAMM,
             state.accountA.account.feeBipsAMM},
            {orderB.amm.packed,
             orderB.feeBips.packed,
             fillS_B.value(),
             state.accountB.balanceS.balance,
             state.accountB.balanceB.balance,
             balanceS_B.balance(),
             balanceB_B.balance(),
             state.accountB.balanceS.weightAMM,
             state.accountB.balanceB.weightAMM,
             state.accountB.account.feeBipsAMM},
            FMT(prefix, ".validateAMM"))
    {
        // Update account A
        setArrayOutput(TXV_STORAGE_A_ADDRESS, subArray(orderA.storageID.bits, 0, NUM_BITS_STORAGE_ADDRESS));
        setOutput(TXV_STORAGE_A_DATA, orderMatching.getFilledAfter_A());
        setOutput(TXV_STORAGE_A_STORAGEID, orderA.storageID.packed);
        setArrayOutput(TXV_BALANCE_A_S_ADDRESS, orderA.tokenS.bits);
        setOutput(TXV_BALANCE_A_S_BALANCE, balanceS_A.balance());
        setOutput(TXV_BALANCE_A_S_WEIGHTAMM, tokenTransferDataGadget_AtoB.fromNftData());
        setArrayOutput(TXV_BALANCE_A_B_ADDRESS, orderA.tokenB.bits);
        setOutput(TXV_BALANCE_A_B_BALANCE, balanceB_A.balance());
        setOutput(TXV_BALANCE_A_B_WEIGHTAMM, tokenTransferDataGadget_BtoA.toNftData());
        setArrayOutput(TXV_ACCOUNT_A_ADDRESS, orderA.accountID.bits);

        // Update account B
        setArrayOutput(TXV_STORAGE_B_ADDRESS, subArray(orderB.storageID.bits, 0, NUM_BITS_STORAGE_ADDRESS));
        setOutput(TXV_STORAGE_B_DATA, orderMatching.getFilledAfter_B());
        setOutput(TXV_STORAGE_B_STORAGEID, orderB.storageID.packed);
        setArrayOutput(TXV_BALANCE_B_S_ADDRESS, orderB.tokenS.bits);
        setOutput(TXV_BALANCE_B_S_BALANCE, balanceS_B.balance());
        setOutput(TXV_BALANCE_B_S_WEIGHTAMM, tokenTransferDataGadget_BtoA.fromNftData());
        setArrayOutput(TXV_BALANCE_B_B_ADDRESS, orderB.tokenB.bits);
        setOutput(TXV_BALANCE_B_B_BALANCE, balanceB_B.balance());
        setOutput(TXV_BALANCE_B_B_WEIGHTAMM, tokenTransferDataGadget_AtoB.toNftData());
        setArrayOutput(TXV_ACCOUNT_B_ADDRESS, orderB.accountID.bits);

        // Update balances of the protocol fee pool
        setOutput(TXV_BALANCE_P_A_BALANCE, balanceA_P.balance());
        setOutput(TXV_BALANCE_P_B_BALANCE, balanceB_P.balance());

        // Update the balance of the operator
        setOutput(TXV_BALANCE_O_A_BALANCE, balanceA_O.balance());
        setOutput(TXV_BALANCE_O_B_BALANCE, balanceB_O.balance());

        // A signature is required for each order that isn't an AMM
        setOutput(TXV_HASH_A, orderA.hash.result());
        setOutput(TXV_HASH_B, orderB.hash.result());

        setOutput(TXV_SIGNATURE_REQUIRED_A, orderA.notAmm.result());
        setOutput(TXV_SIGNATURE_REQUIRED_B, orderB.notAmm.result());
    }

    void generate_r1cs_witness(const SpotTrade &spotTrade)
    {
        // Orders
        orderA.generate_r1cs_witness(spotTrade.orderA);
        orderB.generate_r1cs_witness(spotTrade.orderB);

        // Balances
        balanceS_A.generate_r1cs_witness();
        balanceB_A.generate_r1cs_witness();
        balanceS_B.generate_r1cs_witness();
        balanceB_B.generate_r1cs_witness();
        balanceA_P.generate_r1cs_witness();
        balanceB_P.generate_r1cs_witness();
        balanceA_O.generate_r1cs_witness();
        balanceB_O.generate_r1cs_witness();

        // Order fills
        fillS_A.generate_r1cs_witness(spotTrade.fillS_A);
        fillS_B.generate_r1cs_witness(spotTrade.fillS_B);

        // Trade history
        isSpotTradeTx.generate_r1cs_witness();
        tradeHistory_A.generate_r1cs_witness();
        tradeHistory_B.generate_r1cs_witness();

        // Match orders
        orderMatching.generate_r1cs_witness();

        // Calculate fees
        protocolTakerFeeBips.generate_r1cs_witness();
        protocolMakerFeeBips.generate_r1cs_witness();
        protocolFeeSA.generate_r1cs_witness();
        protocolFeeBA.generate_r1cs_witness();
        protocolFeeSB.generate_r1cs_witness();
        protocolFeeBB.generate_r1cs_witness();
        feeCalculatorSA.generate_r1cs_witness();
        feeCalculatorBA.generate_r1cs_witness();
        feeCalculatorSB.generate_r1cs_witness();
        feeCalculatorBB.generate_r1cs_witness();

        /* Token Transfers */
        // Actual trade
        fillSA_from_balanceSA_to_balanceBB.generate_r1cs_witness();
        fillSB_from_balanceSB_to_balanceBA.generate_r1cs_witness();
        // Fees
        feeSA_from_balanceSA_to_balanceBO.generate_r1cs_witness();
        feeBA_from_balanceBA_to_balanceAO.generate_r1cs_witness();
        feeSB_from_balanceSB_to_balanceAO.generate_r1cs_witness();
        feeBB_from_balanceBB_to_balanceBO.generate_r1cs_witness();
        // Protocol fees
        protocolFeeSA_from_balanceBO_to_balanceBP.generate_r1cs_witness();
        protocolFeeBA_from_balanceAO_to_balanceAP.generate_r1cs_witness();
        protocolFeeSB_from_balanceAO_to_balanceAP.generate_r1cs_witness();
        protocolFeeBB_from_balanceBO_to_balanceBP.generate_r1cs_witness();

        // Token data
        tokenTransferDataGadget_AtoB.generate_r1cs_witness();
        tokenTransferDataGadget_BtoA.generate_r1cs_witness();

        // AMM validation
        validateAMM.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        // Orders
        orderA.generate_r1cs_constraints();
        orderB.generate_r1cs_constraints();

        // Balances
        balanceS_A.generate_r1cs_constraints();
        balanceB_A.generate_r1cs_constraints();
        balanceS_B.generate_r1cs_constraints();
        balanceB_B.generate_r1cs_constraints();
        balanceA_P.generate_r1cs_constraints();
        balanceB_P.generate_r1cs_constraints();
        balanceA_O.generate_r1cs_constraints();
        balanceB_O.generate_r1cs_constraints();

        // Order fills
        fillS_A.generate_r1cs_constraints();
        fillS_B.generate_r1cs_constraints();

        // Trade history
        isSpotTradeTx.generate_r1cs_constraints();
        tradeHistory_A.generate_r1cs_constraints();
        tradeHistory_B.generate_r1cs_constraints();

        // Match orders
        orderMatching.generate_r1cs_constraints();

        // Calculate fees
        protocolTakerFeeBips.generate_r1cs_constraints();
        protocolMakerFeeBips.generate_r1cs_constraints();
        protocolFeeSA.generate_r1cs_constraints();
        protocolFeeBA.generate_r1cs_constraints();
        protocolFeeSB.generate_r1cs_constraints();
        protocolFeeBB.generate_r1cs_constraints();
        feeCalculatorSA.generate_r1cs_constraints();
        feeCalculatorBA.generate_r1cs_constraints();
        feeCalculatorSB.generate_r1cs_constraints();
        feeCalculatorBB.generate_r1cs_constraints();

        /* Token Transfers */
        // Actual trade
        fillSA_from_balanceSA_to_balanceBB.generate_r1cs_constraints();
        fillSB_from_balanceSB_to_balanceBA.generate_r1cs_constraints();
        // Fees
        feeSA_from_balanceSA_to_balanceBO.generate_r1cs_constraints();
        feeBA_from_balanceBA_to_balanceAO.generate_r1cs_constraints();
        feeSB_from_balanceSB_to_balanceAO.generate_r1cs_constraints();
        feeBB_from_balanceBB_to_balanceBO.generate_r1cs_constraints();
        // Protocol fees
        protocolFeeSA_from_balanceBO_to_balanceBP.generate_r1cs_constraints();
        protocolFeeBA_from_balanceAO_to_balanceAP.generate_r1cs_constraints();
        protocolFeeSB_from_balanceAO_to_balanceAP.generate_r1cs_constraints();
        protocolFeeBB_from_balanceBO_to_balanceBP.generate_r1cs_constraints();

        // Token data
        tokenTransferDataGadget_AtoB.generate_r1cs_constraints();
        tokenTransferDataGadget_BtoA.generate_r1cs_constraints();

        // AMM validation
        validateAMM.generate_r1cs_constraints();
    }

    const VariableArrayT getPublicData() const
    {
        return flattenReverse(
          {orderA.storageID.bits,
           orderB.storageID.bits,

           orderA.accountID.bits,
           orderB.accountID.bits,

           orderA.tokenS.bits,
           orderB.tokenS.bits,

           fillS_A.bits(),
           fillS_B.bits(),

           orderA.fillAmountBorS.bits,
           VariableArrayT(1, state.constants._0),
           subArray(orderA.feeBips.bits, 0, 6),
           orderB.fillAmountBorS.bits,
           VariableArrayT(1, state.constants._0),
           subArray(orderB.feeBips.bits, 0, 6),

           tokenTransferDataGadget_BtoA.toTokenDA(),
           tokenTransferDataGadget_AtoB.toTokenDA(),

           subArray(orderA.feeBips.bits, 6, 8),
           subArray(orderB.feeBips.bits, 6, 8)});
    }
};

} // namespace Loopring

#endif
