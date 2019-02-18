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
    const VariableT tradingHistoryMerkleRoot;
    const VariableT accountsMerkleRoot;

    const jubjub::VariablePointT publicKey;

    VariableArrayT account;
    VariableArrayT orderID;
    libsnark::dual_variable_gadget<FieldT> padding;

    VariableT filled;
    VariableT cancelledBefore;
    VariableT cancelledAfter;

    VariableT walletID;
    VariableT token;
    VariableT balance;
    VariableT tradeHistoryRootBefore;
    VariableT tradeHistoryRootAfter;
    //UpdateAccountGadget checkAccount;

    UpdateTradeHistoryGadget updateTradeHistory;

    // variables for signature
    const jubjub::VariablePointT sig_R;
    const VariableArrayT sig_s;
    const VariableArrayT sig_m;
    jubjub::PureEdDSA signatureVerifier;

    CancelGadget(
        ProtoboardT& pb,
        const jubjub::Params& params,
        const VariableT& _tradingHistoryMerkleRoot,
        const VariableT& _accountsMerkleRoot,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        tradingHistoryMerkleRoot(_tradingHistoryMerkleRoot),
        accountsMerkleRoot(_accountsMerkleRoot),

        publicKey(pb, FMT(prefix, ".publicKey")),

        account(make_var_array(pb, TREE_DEPTH_ACCOUNTS, FMT(prefix, ".account"))),
        orderID(make_var_array(pb, 4, FMT(prefix, ".orderID"))),
        padding(pb, 1, FMT(prefix, ".padding")),

        filled(make_variable(pb, 0, FMT(prefix, ".filled"))),
        cancelledBefore(make_variable(pb, 0, FMT(prefix, ".cancelledBefore"))),
        cancelledAfter(make_variable(pb, 0, FMT(prefix, ".cancelledAfter"))),
        updateTradeHistory(pb, tradingHistoryMerkleRoot, flatten({orderID, account}), filled, cancelledBefore, filled, cancelledAfter, FMT(prefix, ".updateTradeHistory")),

        walletID(make_variable(pb, FMT(prefix, ".walletID"))),
        token(make_variable(pb, FMT(prefix, ".token"))),
        balance(make_variable(pb, FMT(prefix, ".balance"))),
        //checkAccount(pb, accountsMerkleRoot, account, publicKey, walletID, token, balance, tradeHistoryRootBefore, balance, tradeHistoryRootAfter, FMT(prefix, ".checkAccount")),

        sig_R(pb, FMT(prefix, ".R")),
        sig_s(make_var_array(pb, FieldT::size_in_bits(), FMT(prefix, ".s"))),
        sig_m(flatten({account, orderID, padding.bits})),
        signatureVerifier(pb, params, jubjub::EdwardsPoint(params.Gx, params.Gy), publicKey, sig_R, sig_s, sig_m, FMT(prefix, ".signatureVerifier"))
    {

    }

    const VariableT getNewAccountsRoot() const
    {
        return updateTradeHistory.getNewRoot();
    }

    const std::vector<VariableArrayT> getPublicData() const
    {
        return {account, orderID};
    }

    void generate_r1cs_witness(const Cancellation& cancellation)
    {
        pb.val(publicKey.x) = cancellation.publicKey.x;
        pb.val(publicKey.y) = cancellation.publicKey.y;

        account.fill_with_bits_of_field_element(pb, cancellation.account);
        orderID.fill_with_bits_of_field_element(pb, cancellation.orderID);

        padding.bits.fill_with_bits_of_field_element(pb, 0);
        padding.generate_r1cs_witness_from_bits();

        pb.val(filled) = cancellation.tradeHistoryUpdate.before.filled;
        pb.val(cancelledBefore) = cancellation.tradeHistoryUpdate.before.cancelled;
        pb.val(cancelledAfter) = cancellation.tradeHistoryUpdate.after.cancelled;

        pb.val(walletID) = cancellation.accountUpdate.before.walletID;
        //pb.val(token) = cancellation.accountUpdate.before.token;
       //pb.val(balance) = cancellation.accountUpdate.before.balance;

        updateTradeHistory.generate_r1cs_witness(cancellation.tradeHistoryUpdate.proof);

        //checkAccount.generate_r1cs_witness(cancellation.accountUpdate.proof);

        pb.val(sig_R.x) = cancellation.signature.R.x;
        pb.val(sig_R.y) = cancellation.signature.R.y;
        sig_s.fill_with_bits_of_field_element(pb, cancellation.signature.s);
        signatureVerifier.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        padding.generate_r1cs_constraints(true);
        signatureVerifier.generate_r1cs_constraints();
        updateTradeHistory.generate_r1cs_constraints();
        //checkAccount.generate_r1cs_constraints();
        pb.add_r1cs_constraint(ConstraintT(cancelledAfter, FieldT::one(), FieldT::one()), "cancelledAfter == 1");
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

    const VariableT accountsRootBefore;
    const VariableT feesRoot;

    const VariableT tradeHistoryBefore;

    MerkleRootGadget merkleRootGadget;

    CancelsCircuitGadget(ProtoboardT& pb, const std::string& prefix) :
        GadgetT(pb, prefix),

        publicDataHash(pb, 256, FMT(prefix, ".publicDataHash")),
        publicData(pb, publicDataHash, FMT(prefix, ".publicData")),

        stateID(pb, 16, FMT(prefix, ".stateID")),
        merkleRootBefore(pb, 256, FMT(prefix, ".merkleRootBefore")),
        merkleRootAfter(pb, 256, FMT(prefix, ".merkleRootAfter")),

        accountsRootBefore(make_variable(pb, FMT(prefix, ".accountsRootBefore"))),
        feesRoot(make_variable(pb, FMT(prefix, ".feesRoot"))),

        merkleRootGadget(pb, merkleRootBefore.packed, merkleRootAfter.packed,
                         accountsRootBefore, feesRoot,
                         FMT(prefix, ".merkleRootGadget"))
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
            VariableT cancelAccountsRoot = (j == 0) ? accountsRootBefore : cancels.back().getNewAccountsRoot();
            cancels.emplace_back(pb, params, cancelAccountsRoot, cancelAccountsRoot, std::string("cancels") + std::to_string(j));
            cancels.back().generate_r1cs_constraints();

            // Store data from withdrawal
            std::vector<VariableArrayT> ringPublicData = cancels.back().getPublicData();
            publicData.add(cancels.back().getPublicData());
        }

        // Check the input hash
        publicDataHash.generate_r1cs_constraints(true);
        publicData.generate_r1cs_constraints();

        // Check the merkle roots
        merkleRootGadget.generate_r1cs_constraints(cancels.back().getNewAccountsRoot(), feesRoot);
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

        pb.val(accountsRootBefore) = context.accountsRootBefore;
        pb.val(feesRoot) = context.feesRoot;

        for(unsigned int i = 0; i < context.cancels.size(); i++)
        {
            cancels[i].generate_r1cs_witness(context.cancels[i]);
        }

        publicData.generate_r1cs_witness();

        merkleRootGadget.generate_r1cs_witness();

        return true;
    }
};

}

#endif
