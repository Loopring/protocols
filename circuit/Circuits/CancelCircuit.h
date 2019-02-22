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
    const VariableT accountsMerkleRoot;

    VariableT constant0;
    libsnark::dual_variable_gadget<FieldT> padding;
    VariableArrayT uint16_padding;

    const jubjub::VariablePointT publicKey;

    VariableArrayT accountID;
    VariableArrayT tokenID;
    VariableArrayT orderID;

    VariableT filled;
    VariableT cancelled_before;
    VariableT cancelled_after;

    VariableT balance;
    VariableT tradingHistoryRoot_before;

    VariableT walletID;
    libsnark::dual_variable_gadget<FieldT> nonce_before;
    VariableT nonce_after;
    VariableT balancesRoot_before;

    UpdateTradeHistoryGadget updateTradeHistory;
    UpdateBalanceGadget updateBalance;
    UpdateAccountGadget updateAccount;

    // variables for signature
    SignatureVerifier signatureVerifier;

    CancelGadget(
        ProtoboardT& pb,
        const jubjub::Params& params,
        const VariableT& _accountsMerkleRoot,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        accountsMerkleRoot(_accountsMerkleRoot),

        constant0(make_variable(pb, 0, FMT(prefix, ".constant0"))),
        padding(pb, 2, FMT(prefix, ".padding")),
        uint16_padding(make_var_array(pb, 16 - NUM_BITS_WALLETID, FMT(prefix, ".uint16_padding"))),

        publicKey(pb, FMT(prefix, ".publicKey")),

        accountID(make_var_array(pb, TREE_DEPTH_ACCOUNTS, FMT(prefix, ".account"))),
        tokenID(make_var_array(pb, TREE_DEPTH_BALANCES, FMT(prefix, ".tokenID"))),
        orderID(make_var_array(pb, 16, FMT(prefix, ".orderID"))),

        filled(make_variable(pb, 0, FMT(prefix, ".filled"))),
        cancelled_before(make_variable(pb, 0, FMT(prefix, ".cancelled_before"))),
        cancelled_after(make_variable(pb, 1, FMT(prefix, ".cancelled_after"))),

        balance(make_variable(pb, FMT(prefix, ".balance"))),
        tradingHistoryRoot_before(make_variable(pb, FMT(prefix, ".tradingHistoryRoot_before"))),

        walletID(make_variable(pb, FMT(prefix, ".walletID"))),
        nonce_before(pb, 32, FMT(prefix, ".nonce_before")),
        nonce_after(make_variable(pb, 1, FMT(prefix, ".cancelled_after"))),
        balancesRoot_before(make_variable(pb, FMT(prefix, ".balancesRoot_before"))),

        updateTradeHistory(pb, tradingHistoryRoot_before, orderID,
                           filled, cancelled_before, filled, cancelled_after, FMT(prefix, ".updateTradeHistory")),

        updateBalance(pb, balancesRoot_before, tokenID,
                      {balance, constant0, tradingHistoryRoot_before},
                      {balance, constant0, updateTradeHistory.getNewRoot()},
                      FMT(prefix, ".updateBalance")),

        updateAccount(pb, accountsMerkleRoot, accountID,
                      {publicKey.x, publicKey.y, walletID, nonce_before.packed, balancesRoot_before},
                      {publicKey.x, publicKey.y, walletID, nonce_after, updateBalance.getNewRoot()},
                      FMT(prefix, ".updateAccount")),

        signatureVerifier(pb, params, publicKey,
                          flatten({accountID, tokenID, orderID, nonce_before.bits, padding.bits}),
                          FMT(prefix, ".signatureVerifier"))
    {

    }

    const VariableT getNewAccountsRoot() const
    {
        return updateAccount.result();
    }

    const std::vector<VariableArrayT> getPublicData() const
    {
        return {accountID, uint16_padding, tokenID, orderID};
    }

    void generate_r1cs_witness(const Cancellation& cancellation)
    {
        uint16_padding.fill_with_bits_of_ulong(pb, 0);

        padding.bits.fill_with_bits_of_field_element(pb, 0);
        padding.generate_r1cs_witness_from_bits();

        pb.val(publicKey.x) = cancellation.publicKey.x;
        pb.val(publicKey.y) = cancellation.publicKey.y;

        accountID.fill_with_bits_of_field_element(pb, cancellation.accountUpdate.accountID);
        tokenID.fill_with_bits_of_field_element(pb, cancellation.balanceUpdate.tokenID);
        orderID.fill_with_bits_of_field_element(pb, cancellation.tradeHistoryUpdate.orderID);

        pb.val(filled) = cancellation.tradeHistoryUpdate.before.filled;
        pb.val(cancelled_before) = cancellation.tradeHistoryUpdate.before.cancelled;
        pb.val(cancelled_after) = 1;

        pb.val(balance) = cancellation.balanceUpdate.before.balance;
        pb.val(tradingHistoryRoot_before) = cancellation.balanceUpdate.before.tradingHistoryRoot;

        pb.val(walletID) = cancellation.accountUpdate.before.walletID;
        nonce_before.bits.fill_with_bits_of_field_element(pb, cancellation.accountUpdate.before.nonce);
        nonce_before.generate_r1cs_witness_from_bits();
        pb.val(nonce_after) = cancellation.accountUpdate.after.nonce;
        pb.val(balancesRoot_before) = cancellation.accountUpdate.before.balancesRoot;

        updateTradeHistory.generate_r1cs_witness(cancellation.tradeHistoryUpdate.proof);
        updateBalance.generate_r1cs_witness(cancellation.balanceUpdate.proof);
        updateAccount.generate_r1cs_witness(cancellation.accountUpdate.proof);

        signatureVerifier.generate_r1cs_witness(cancellation.signature);
    }

    void generate_r1cs_constraints()
    {
        padding.generate_r1cs_constraints(true);

        nonce_before.generate_r1cs_constraints(true);

        updateTradeHistory.generate_r1cs_constraints();
        updateBalance.generate_r1cs_constraints();
        updateAccount.generate_r1cs_constraints();

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

    CancelsCircuitGadget(ProtoboardT& pb, const std::string& prefix) :
        GadgetT(pb, prefix),

        publicDataHash(pb, 256, FMT(prefix, ".publicDataHash")),
        publicData(pb, publicDataHash, FMT(prefix, ".publicData")),

        stateID(pb, 16, FMT(prefix, ".stateID")),
        merkleRootBefore(pb, 256, FMT(prefix, ".merkleRootBefore")),
        merkleRootAfter(pb, 256, FMT(prefix, ".merkleRootAfter"))
    {

    }

    ~CancelsCircuitGadget()
    {

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
            cancels.emplace_back(pb, params, cancelAccountsRoot, std::string("cancels_") + std::to_string(j));
            cancels.back().generate_r1cs_constraints();

            // Store data from withdrawal
            std::vector<VariableArrayT> ringPublicData = cancels.back().getPublicData();
            publicData.add(cancels.back().getPublicData());
        }

        // Check the input hash
        publicDataHash.generate_r1cs_constraints(true);
        publicData.generate_r1cs_constraints();

        // Check the new merkle root
        forceEqual(pb, cancels.back().getNewAccountsRoot(), merkleRootAfter.packed, "newMerkleRoot");
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

        for(unsigned int i = 0; i < context.cancels.size(); i++)
        {
            cancels[i].generate_r1cs_witness(context.cancels[i]);
        }

        publicData.generate_r1cs_witness();

        return true;
    }
};

}

#endif
