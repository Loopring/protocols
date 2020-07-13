#ifndef _TRADINGHISTORYGADGETS_H_
#define _TRADINGHISTORYGADGETS_H_

#include "../Utils/Constants.h"
#include "../Utils/Data.h"

#include "MerkleTree.h"

#include "ethsnarks.hpp"
#include "utils.hpp"

using namespace ethsnarks;

namespace Loopring
{

struct TradeHistoryState
{
    VariableT filled;
    VariableT orderID;
};

static void printTradeHistory(const ProtoboardT& pb, const TradeHistoryState& state)
{
    std::cout << "- filled: " << pb.val(state.filled) << std::endl;
    std::cout << "- orderID: " << pb.val(state.orderID) << std::endl;
}

class TradeHistoryGadget : public GadgetT
{
public:
    VariableT filled;
    VariableT orderID;

    TradeHistoryGadget(
        ProtoboardT& pb,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        filled(make_variable(pb, FMT(prefix, ".filled"))),
        orderID(make_variable(pb, FMT(prefix, ".orderID")))
    {

    }

    void generate_r1cs_witness(const TradeHistoryLeaf& tradeHistoryLeaf)
    {
        pb.val(filled) = tradeHistoryLeaf.filled;
        pb.val(orderID) = tradeHistoryLeaf.orderID;
    }
};

class UpdateTradeHistoryGadget : public GadgetT
{
public:
    HashTradingHistoryLeaf leafBefore;
    HashTradingHistoryLeaf leafAfter;

    TradeHistoryState valuesBefore;
    TradeHistoryState valuesAfter;

    const VariableArrayT proof;
    MerklePathCheckT proofVerifierBefore;
    MerklePathT rootCalculatorAfter;

    UpdateTradeHistoryGadget(
        ProtoboardT& pb,
        const VariableT& merkleRoot,
        const VariableArrayT& address,
        const TradeHistoryState& before,
        const TradeHistoryState& after,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        valuesBefore(before),
        valuesAfter(after),

        leafBefore(pb, var_array({before.filled, before.orderID}), FMT(prefix, ".leafBefore")),
        leafAfter(pb, var_array({after.filled, after.orderID}), FMT(prefix, ".leafAfter")),

        proof(make_var_array(pb, TREE_DEPTH_TRADING_HISTORY * 3, FMT(prefix, ".proof"))),
        proofVerifierBefore(pb, TREE_DEPTH_TRADING_HISTORY, address, leafBefore.result(), merkleRoot, proof, FMT(prefix, ".pathBefore")),
        rootCalculatorAfter(pb, TREE_DEPTH_TRADING_HISTORY, address, leafAfter.result(), proof, FMT(prefix, ".pathAfter"))
    {

    }

    void generate_r1cs_witness(const TradeHistoryUpdate& update)
    {
        leafBefore.generate_r1cs_witness();
        leafAfter.generate_r1cs_witness();

        proof.fill_with_field_elements(pb, update.proof.data);
        proofVerifierBefore.generate_r1cs_witness();
        rootCalculatorAfter.generate_r1cs_witness();

        ASSERT(pb.val(proofVerifierBefore.m_expected_root) == update.rootBefore,  annotation_prefix);
        if (pb.val(rootCalculatorAfter.result()) != update.rootAfter)
        {
            std::cout << "Before:" << std::endl;
            printTradeHistory(pb, valuesBefore);
            std::cout << "After:" << std::endl;
            printTradeHistory(pb, valuesAfter);
            ASSERT(pb.val(rootCalculatorAfter.result()) == update.rootAfter, annotation_prefix);
        }
    }

    void generate_r1cs_constraints()
    {
        leafBefore.generate_r1cs_constraints();
        leafAfter.generate_r1cs_constraints();

        proofVerifierBefore.generate_r1cs_constraints();
        rootCalculatorAfter.generate_r1cs_constraints();
    }

    const VariableT& result() const
    {
        return rootCalculatorAfter.result();
    }
};

class TradeHistoryTrimmingGadget : public GadgetT
{
    VariableT address;
    libsnark::packing_gadget<FieldT> packAddress;
    IsNonZero isNonZeroTradeHistoryOrderID;
    TernaryGadget tradeHistoryOrderID;

    UnsafeAddGadget nextTradeHistoryOrderID;

    EqualGadget orderID_eq_tradeHistoryOrderID;
    EqualGadget orderID_eq_nextTradeHistoryOrderID;

    OrGadget isValidOrderID;
    RequireEqualGadget requireValidOrderID;

    TernaryGadget filled;

public:

    TradeHistoryTrimmingGadget(
        ProtoboardT& pb,
        const Constants& constants,
        const TradeHistoryGadget& tradeHistory,
        const DualVariableGadget& orderID,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        address(make_variable(pb, FMT(prefix, ".address"))),

        packAddress(pb, subArray(orderID.bits, 0, NUM_BITS_TRADING_HISTORY), address, FMT(prefix, ".packAddress")),
        isNonZeroTradeHistoryOrderID(pb, tradeHistory.orderID, FMT(prefix, ".isNonZeroTradeHistoryOrderID")),
        tradeHistoryOrderID(pb, isNonZeroTradeHistoryOrderID.result(), tradeHistory.orderID, address, FMT(prefix, ".tradeHistoryOrderID")),

        nextTradeHistoryOrderID(pb, tradeHistoryOrderID.result(), constants.maxConcurrentOrderIDs, FMT(prefix, ".nextTradeHistoryOrderID")),

        orderID_eq_tradeHistoryOrderID(pb, orderID.packed, tradeHistoryOrderID.result(), FMT(prefix, ".nextTradeHistoryOrderID")),
        orderID_eq_nextTradeHistoryOrderID(pb, orderID.packed, nextTradeHistoryOrderID.result(), FMT(prefix, ".orderID_eq_nextTradeHistoryOrderID")),
        isValidOrderID(pb, {orderID_eq_tradeHistoryOrderID.result(), orderID_eq_nextTradeHistoryOrderID.result()}, FMT(prefix, ".isValidOrderID")),
        requireValidOrderID(pb, isValidOrderID.result(), constants.one, FMT(prefix, ".requireValidOrderID")),

        filled(pb, orderID_eq_tradeHistoryOrderID.result(), tradeHistory.filled, constants.zero, FMT(prefix, ".filled"))
    {

    }

    void generate_r1cs_witness()
    {
        packAddress.generate_r1cs_witness_from_bits();
        isNonZeroTradeHistoryOrderID.generate_r1cs_witness();
        tradeHistoryOrderID.generate_r1cs_witness();

        nextTradeHistoryOrderID.generate_r1cs_witness();

        orderID_eq_tradeHistoryOrderID.generate_r1cs_witness();
        orderID_eq_nextTradeHistoryOrderID.generate_r1cs_witness();
        isValidOrderID.generate_r1cs_witness();
        requireValidOrderID.generate_r1cs_witness();

        filled.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        packAddress.generate_r1cs_constraints(false);
        isNonZeroTradeHistoryOrderID.generate_r1cs_constraints();
        tradeHistoryOrderID.generate_r1cs_constraints();

        nextTradeHistoryOrderID.generate_r1cs_constraints();

        orderID_eq_tradeHistoryOrderID.generate_r1cs_constraints();
        orderID_eq_nextTradeHistoryOrderID.generate_r1cs_constraints();
        isValidOrderID.generate_r1cs_constraints();
        requireValidOrderID.generate_r1cs_constraints();

        filled.generate_r1cs_constraints();
    }

    const VariableT& getFilled() const
    {
        return filled.result();
    }

    const VariableT& getOverwrite() const
    {
        return orderID_eq_nextTradeHistoryOrderID.result();
    }
};

}

#endif
