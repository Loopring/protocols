#ifndef _CANCELCIRCUIT_H_
#define _CANCELCIRCUIT_H_

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

class CancelGadget : public GadgetT
{
public:

    VariableT constant0;
    libsnark::dual_variable_gadget<FieldT> padding;
    VariableArrayT uint16_padding;

    const jubjub::VariablePointT publicKey;

    VariableArrayT accountID;
    VariableArrayT orderTokenID;
    VariableArrayT orderID;
    VariableArrayT feeTokenID;
    libsnark::dual_variable_gadget<FieldT> fee;

    VariableT filled;
    VariableT cancelled_before;
    VariableT cancelled_after;

    VariableT balanceT_A;
    VariableT tradingHistoryRootT_A_before;

    VariableT balanceF_A_before;
    VariableT tradingHistoryRootF_A;

    VariableT balanceF_O_before;
    VariableT tradingHistoryRootF_O;

    VariableT walletID;
    libsnark::dual_variable_gadget<FieldT> nonce_before;
    VariableT nonce_after;
    VariableT balancesRoot_before;

    subadd_gadget feePayment;

    UpdateTradeHistoryGadget updateTradeHistory_A;
    UpdateBalanceGadget updateBalanceT_A;
    UpdateBalanceGadget updateBalanceF_A;
    UpdateAccountGadget updateAccount_A;

    UpdateBalanceGadget updateBalanceF_O;

    // variables for signature
    SignatureVerifier signatureVerifier;

    CancelGadget(
        ProtoboardT& pb,
        const jubjub::Params& params,
        const VariableT& _accountsMerkleRoot,
        const VariableT& _operatorBalancesRoot,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        constant0(make_variable(pb, 0, FMT(prefix, ".constant0"))),
        padding(pb, 2, FMT(prefix, ".padding")),
        uint16_padding(make_var_array(pb, 16 - NUM_BITS_TOKENID, FMT(prefix, ".uint16_padding"))),

        publicKey(pb, FMT(prefix, ".publicKey")),

        accountID(make_var_array(pb, TREE_DEPTH_ACCOUNTS, FMT(prefix, ".account"))),
        orderTokenID(make_var_array(pb, TREE_DEPTH_BALANCES, FMT(prefix, ".orderTokenID"))),
        orderID(make_var_array(pb, 16, FMT(prefix, ".orderID"))),
        feeTokenID(make_var_array(pb, TREE_DEPTH_BALANCES, FMT(prefix, ".feeTokenID"))),
        fee(pb, 96, FMT(prefix, ".fee")),

        filled(make_variable(pb, 0, FMT(prefix, ".filled"))),
        cancelled_before(make_variable(pb, 0, FMT(prefix, ".cancelled_before"))),
        cancelled_after(make_variable(pb, 1, FMT(prefix, ".cancelled_after"))),

        balanceT_A(make_variable(pb, FMT(prefix, ".balanceT_A"))),
        tradingHistoryRootT_A_before(make_variable(pb, FMT(prefix, ".tradingHistoryRootT_A_before"))),

        balanceF_A_before(make_variable(pb, FMT(prefix, ".balanceF_A_before"))),
        tradingHistoryRootF_A(make_variable(pb, FMT(prefix, ".tradingHistoryRootF_A"))),

        balanceF_O_before(make_variable(pb, FMT(prefix, ".balanceF_O_before"))),
        tradingHistoryRootF_O(make_variable(pb, FMT(prefix, ".tradingHistoryRootF_O"))),

        walletID(make_variable(pb, FMT(prefix, ".walletID"))),
        nonce_before(pb, 32, FMT(prefix, ".nonce_before")),
        nonce_after(make_variable(pb, 1, FMT(prefix, ".cancelled_after"))),
        balancesRoot_before(make_variable(pb, FMT(prefix, ".balancesRoot_before"))),

        feePayment(pb, 96, balanceF_A_before, balanceF_O_before, fee.packed, FMT(prefix, ".feePayment")),

        updateTradeHistory_A(pb, tradingHistoryRootT_A_before, orderID,
                             filled, cancelled_before, filled, cancelled_after, FMT(prefix, ".updateTradeHistory_A")),

        updateBalanceT_A(pb, balancesRoot_before, orderTokenID,
                         {balanceT_A, constant0, tradingHistoryRootT_A_before},
                         {balanceT_A, constant0, updateTradeHistory_A.getNewRoot()},
                         FMT(prefix, ".updateBalanceT_A")),

        updateBalanceF_A(pb, updateBalanceT_A.getNewRoot(), feeTokenID,
                         {balanceF_A_before, constant0, tradingHistoryRootF_A},
                         {feePayment.X, constant0, tradingHistoryRootF_A},
                         FMT(prefix, ".updateBalanceF_A")),

        updateAccount_A(pb, _accountsMerkleRoot, accountID,
                        {publicKey.x, publicKey.y, walletID, nonce_before.packed, balancesRoot_before},
                        {publicKey.x, publicKey.y, walletID, nonce_after, updateBalanceF_A.getNewRoot()},
                        FMT(prefix, ".updateAccount_A")),

        updateBalanceF_O(pb, _operatorBalancesRoot, feeTokenID,
                         {balanceF_O_before, constant0, tradingHistoryRootF_O},
                         {feePayment.Y, constant0, tradingHistoryRootF_O},
                         FMT(prefix, ".updateBalanceF_O")),

        signatureVerifier(pb, params, publicKey,
                          flatten({accountID, orderTokenID, orderID, feeTokenID, fee.bits, nonce_before.bits, padding.bits}),
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

    const std::vector<VariableArrayT> getPublicData() const
    {
        return {accountID, uint16_padding, orderTokenID, orderID,
                uint16_padding, feeTokenID, fee.bits};
    }

    void generate_r1cs_witness(const Cancellation& cancellation)
    {
        uint16_padding.fill_with_bits_of_ulong(pb, 0);

        padding.bits.fill_with_bits_of_field_element(pb, 0);
        padding.generate_r1cs_witness_from_bits();

        pb.val(publicKey.x) = cancellation.publicKey.x;
        pb.val(publicKey.y) = cancellation.publicKey.y;

        accountID.fill_with_bits_of_field_element(pb, cancellation.accountUpdate_A.accountID);
        orderTokenID.fill_with_bits_of_field_element(pb, cancellation.balanceUpdateT_A.tokenID);
        orderID.fill_with_bits_of_field_element(pb, cancellation.tradeHistoryUpdate_A.orderID);
        feeTokenID.fill_with_bits_of_field_element(pb, cancellation.balanceUpdateF_A.tokenID);
        fee.bits.fill_with_bits_of_field_element(pb, cancellation.fee);
        fee.generate_r1cs_witness_from_bits();

        pb.val(filled) = cancellation.tradeHistoryUpdate_A.before.filled;
        pb.val(cancelled_before) = cancellation.tradeHistoryUpdate_A.before.cancelled;
        pb.val(cancelled_after) = FieldT::one();

        pb.val(balanceT_A) = cancellation.balanceUpdateT_A.before.balance;
        pb.val(tradingHistoryRootT_A_before) = cancellation.balanceUpdateT_A.before.tradingHistoryRoot;

        pb.val(balanceF_A_before) = cancellation.balanceUpdateF_A.before.balance;
        pb.val(tradingHistoryRootF_A) = cancellation.balanceUpdateF_A.before.tradingHistoryRoot;

        pb.val(balanceF_O_before) = cancellation.balanceUpdateF_O.before.balance;
        pb.val(tradingHistoryRootF_O) = cancellation.balanceUpdateF_O.before.tradingHistoryRoot;

        pb.val(walletID) = cancellation.accountUpdate_A.before.walletID;
        nonce_before.bits.fill_with_bits_of_field_element(pb, cancellation.accountUpdate_A.before.nonce);
        nonce_before.generate_r1cs_witness_from_bits();
        pb.val(nonce_after) = cancellation.accountUpdate_A.after.nonce;
        pb.val(balancesRoot_before) = cancellation.accountUpdate_A.before.balancesRoot;

        feePayment.generate_r1cs_witness();

        updateTradeHistory_A.generate_r1cs_witness(cancellation.tradeHistoryUpdate_A.proof);
        updateBalanceT_A.generate_r1cs_witness(cancellation.balanceUpdateT_A.proof);
        updateBalanceF_A.generate_r1cs_witness(cancellation.balanceUpdateF_A.proof);
        updateAccount_A.generate_r1cs_witness(cancellation.accountUpdate_A.proof);
        updateBalanceF_O.generate_r1cs_witness(cancellation.balanceUpdateF_O.proof);

        signatureVerifier.generate_r1cs_witness(cancellation.signature);
    }

    void generate_r1cs_constraints()
    {
        padding.generate_r1cs_constraints(true);

        fee.generate_r1cs_constraints(true);
        nonce_before.generate_r1cs_constraints(true);

        feePayment.generate_r1cs_constraints();

        updateTradeHistory_A.generate_r1cs_constraints();
        updateBalanceT_A.generate_r1cs_constraints();
        updateBalanceF_A.generate_r1cs_constraints();
        updateAccount_A.generate_r1cs_constraints();
        updateBalanceF_O.generate_r1cs_constraints();

        signatureVerifier.generate_r1cs_constraints();

        pb.add_r1cs_constraint(ConstraintT(cancelled_after, FieldT::one(), FieldT::one()), "cancelled_after == 1");
        pb.add_r1cs_constraint(ConstraintT(nonce_before.packed + FieldT::one(), FieldT::one(), nonce_after), "nonce_before + 1 == nonce_after");
    }
};

class CancelsCircuitGadget : public GadgetT
{
public:
    jubjub::Params params;

    unsigned int numCancels;
    std::vector<CancelGadget> cancels;

    libsnark::dual_variable_gadget<FieldT> publicDataHash;
    PublicDataGadget publicData;

    libsnark::dual_variable_gadget<FieldT> stateID;
    libsnark::dual_variable_gadget<FieldT> merkleRootBefore;
    libsnark::dual_variable_gadget<FieldT> merkleRootAfter;

    VariableT constant0;
    VariableT nonce;

    const jubjub::VariablePointT publicKey;
    libsnark::dual_variable_gadget<FieldT> operatorAccountID;
    VariableT balancesRoot_before;

    UpdateAccountGadget* updateAccount_O = nullptr;

    CancelsCircuitGadget(ProtoboardT& pb, const std::string& prefix) :
        GadgetT(pb, prefix),

        publicDataHash(pb, 256, FMT(prefix, ".publicDataHash")),
        publicData(pb, publicDataHash, FMT(prefix, ".publicData")),

        stateID(pb, 16, FMT(prefix, ".stateID")),
        merkleRootBefore(pb, 256, FMT(prefix, ".merkleRootBefore")),
        merkleRootAfter(pb, 256, FMT(prefix, ".merkleRootAfter")),

        constant0(make_variable(pb, 0, FMT(prefix, ".constant0"))),
        operatorAccountID(pb, TREE_DEPTH_ACCOUNTS, FMT(prefix, ".operatorAccountID")),
        publicKey(pb, FMT(prefix, ".publicKey")),
        nonce(make_variable(pb, 0, FMT(prefix, ".nonce"))),
        balancesRoot_before(make_variable(pb, 0, FMT(prefix, ".balancesRoot_before")))
    {

    }

    ~CancelsCircuitGadget()
    {
        if (updateAccount_O)
        {
            delete updateAccount_O;
        }
    }

    void generate_r1cs_constraints(int numCancels)
    {
        this->numCancels = numCancels;

        pb.set_input_sizes(1);

        publicData.add(stateID.bits);
        publicData.add(merkleRootBefore.bits);
        publicData.add(merkleRootAfter.bits);
        for (size_t j = 0; j < numCancels; j++)
        {
            VariableT cancelAccountsRoot = (j == 0) ? merkleRootBefore.packed : cancels.back().getNewAccountsRoot();
            VariableT cancelOperatorBalancesRoot = (j == 0) ? balancesRoot_before : cancels.back().getNewOperatorBalancesRoot();
            cancels.emplace_back(pb, params, cancelAccountsRoot, cancelOperatorBalancesRoot, std::string("cancels_") + std::to_string(j));
            cancels.back().generate_r1cs_constraints();

            // Store data from withdrawal
            std::vector<VariableArrayT> ringPublicData = cancels.back().getPublicData();
            publicData.add(cancels.back().getPublicData());
        }

        operatorAccountID.generate_r1cs_constraints(true);
        updateAccount_O = new UpdateAccountGadget(pb, cancels.back().getNewAccountsRoot(), operatorAccountID.bits,
                {publicKey.x, publicKey.y, constant0, nonce, balancesRoot_before},
                {publicKey.x, publicKey.y, constant0, nonce, cancels.back().getNewOperatorBalancesRoot()},
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

    bool generateWitness(const Loopring::CancelContext& context)
    {
        stateID.bits.fill_with_bits_of_field_element(pb, context.stateID);
        stateID.generate_r1cs_witness_from_bits();

        merkleRootBefore.bits.fill_with_bits_of_field_element(pb, context.merkleRootBefore);
        merkleRootBefore.generate_r1cs_witness_from_bits();
        merkleRootAfter.bits.fill_with_bits_of_field_element(pb, context.merkleRootAfter);
        merkleRootAfter.generate_r1cs_witness_from_bits();

        pb.val(balancesRoot_before) = context.accountUpdate_O.before.balancesRoot;

        for(unsigned int i = 0; i < context.cancels.size(); i++)
        {
            cancels[i].generate_r1cs_witness(context.cancels[i]);
        }

        operatorAccountID.bits.fill_with_bits_of_field_element(pb, context.operatorAccountID);
        operatorAccountID.generate_r1cs_witness_from_bits();

        pb.val(publicKey.x) = context.accountUpdate_O.before.publicKey.x;
        pb.val(publicKey.y) = context.accountUpdate_O.before.publicKey.y;

        pb.val(nonce) = context.accountUpdate_O.before.nonce;

        updateAccount_O->generate_r1cs_witness(context.accountUpdate_O.proof);

        publicData.generate_r1cs_witness();

        return true;
    }
};

}

#endif
