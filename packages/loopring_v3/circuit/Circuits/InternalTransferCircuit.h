#ifndef _INTERNAL_TRANSFER_CIRCUIT_H_
#define _INTERNAL_TRANSFER_CIRCUIT_H_

#include "Circuit.h"
#include "../Utils/Constants.h"
#include "../Utils/Data.h"
#include "../Utils/Utils.h"
#include "../Gadgets/AccountGadgets.h"
#include "../Gadgets/TradingHistoryGadgets.h"

#include "ethsnarks.hpp"
#include "utils.hpp"

using namespace ethsnarks;
namespace Loopring
{

class InternalTransferGadget : public GadgetT
{
public:

    const Constants& constants;

    // User From state
    BalanceGadget balanceFBefore_From;
    BalanceGadget balanceTBefore_From;
    AccountGadget accountBefore_From;
    // User To state
    BalanceGadget balanceTBefore_To;
    AccountGadget accountBefore_To;
    // Operator state
    BalanceGadget balanceBefore_O;

    // Inputs
    DualVariableGadget accountID_From;
    DualVariableGadget accountID_To;
    DualVariableGadget tokenID;
    DualVariableGadget amount;
    DualVariableGadget feeTokenID;
    DualVariableGadget fee;
    DualVariableGadget type;

    // Signature
    Poseidon_gadget_T<9, 1, 6, 53, 8, 1> hash;
    SignatureVerifier signatureVerifier;

    // Type
    NotGadget signatureInvalid;
    UnsafeAddGadget numConditionalTransfersAfter;
    RequireEqualGadget type_eq_signatureInvalid;

    // User To account check
    RequireNotZeroGadget publicKeyX_notZero;

    // Fee as float
    FloatGadget fFee;
    RequireAccuracyGadget requireAccuracyFee;
    // Amount as float
    FloatGadget fAmount;
    RequireAccuracyGadget requireAccuracyAmount;

    // Fee payment from From to the operator
    subadd_gadget feePayment;
    // Transfer from From to To
    subadd_gadget transferPayment;

    // Increase the nonce of From by 1
    AddGadget nonce_From_after;

    // Update User From
    UpdateBalanceGadget updateBalanceF_From;
    UpdateBalanceGadget updateBalanceT_From;
    UpdateAccountGadget updateAccount_From;

    // Update User To
    UpdateBalanceGadget updateBalanceT_To;
    UpdateAccountGadget updateAccount_To;

    // Update Operator
    UpdateBalanceGadget updateBalanceF_O;

    InternalTransferGadget(
        ProtoboardT &pb,
        const jubjub::Params& params,
        const Constants& _constants,
        const VariableT& accountsMerkleRoot,
        const VariableT& operatorBalancesRoot,
        const VariableT& blockExchangeID,
        const VariableT& numConditionalTransfersBefore,
        const std::string &prefix
    ) :
        GadgetT(pb, prefix),

        constants(_constants),

        // User From state
        balanceFBefore_From(pb, FMT(prefix, "balanceFBefore_From")),
        balanceTBefore_From(pb, FMT(prefix, "balanceTBefore_From")),
        accountBefore_From(pb, FMT(prefix, "accountBefore_From")),
        // User To state
        balanceTBefore_To(pb, FMT(prefix, "balanceTBefore_To")),
        accountBefore_To(pb, FMT(prefix, "accountBefore_To")),
        // Operator state
        balanceBefore_O(pb, FMT(prefix, "balanceBefore_O")),

        // Inputs
        accountID_From(pb, NUM_BITS_ACCOUNT, FMT(prefix, ".accountID_From")),
        accountID_To(pb, NUM_BITS_ACCOUNT, FMT(prefix, ".accountID_To")),
        tokenID(pb, NUM_BITS_TOKEN, FMT(prefix, ".tokenID")),
        amount(pb, NUM_BITS_AMOUNT, FMT(prefix, ".amount")),
        feeTokenID(pb, NUM_BITS_TOKEN, FMT(prefix, ".feeTokenID")),
        fee(pb, NUM_BITS_AMOUNT, FMT(prefix, ".fee")),
        type(pb, NUM_BITS_TYPE, FMT(prefix, ".type")),

        // Signature
        hash(pb, var_array({blockExchangeID, accountID_From.packed, accountID_To.packed, tokenID.packed, amount.packed, feeTokenID.packed, fee.packed, accountBefore_From.nonce}), FMT(this->annotation_prefix, ".hash")),
        signatureVerifier(pb, params, constants, accountBefore_From.publicKey, hash.result(), FMT(prefix, ".signatureVerifier"), false),

        // Type
        signatureInvalid(pb, signatureVerifier.result(), ".signatureInvalid"),
        numConditionalTransfersAfter(pb, numConditionalTransfersBefore, signatureInvalid.result(), ".numConditionalTransfersAfter"),
        type_eq_signatureInvalid(pb, type.packed, signatureInvalid.result(), ".type_eq_signatureInvalid"),

        // User To account check
        publicKeyX_notZero(pb, accountBefore_To.publicKey.x, FMT(prefix, ".publicKeyX_notZero")),

        // Fee as float
        fFee(pb, constants, Float16Encoding, FMT(prefix, ".fFee")),
        requireAccuracyFee(pb, fFee.value(), fee.packed, Float16Accuracy, NUM_BITS_AMOUNT, FMT(prefix, ".requireAccuracyFee")),
        // Amount as float
        fAmount(pb, constants, Float24Encoding, FMT(prefix, ".fTansAmount")),
        requireAccuracyAmount(pb, fAmount.value(), amount.packed, Float24Accuracy, NUM_BITS_AMOUNT, FMT(prefix, ".requireAccuracyAmount")),

        // Fee payment from From to the operator
        feePayment(pb, NUM_BITS_AMOUNT, balanceFBefore_From.balance, balanceBefore_O.balance, fFee.value(), FMT(prefix, ".feePayment")),
        // Transfer from From to To
        transferPayment(pb, NUM_BITS_AMOUNT, balanceTBefore_From.balance, balanceTBefore_To.balance, fAmount.value(), FMT(prefix, ".transferPayment")),

        // Increase the nonce of From by 1 (unless it's a conditional transfer)
        nonce_From_after(pb, accountBefore_From.nonce, signatureVerifier.result(), NUM_BITS_NONCE, FMT(prefix, ".nonce_From_after")),

        // Update User From
        updateBalanceF_From(pb, accountBefore_From.balancesRoot, feeTokenID.bits,
                            {balanceFBefore_From.balance, balanceFBefore_From.tradingHistory},
                            {feePayment.X, balanceFBefore_From.tradingHistory},
                            FMT(prefix, ".updateBalanceF_From")),
        updateBalanceT_From(pb, updateBalanceF_From.result(), tokenID.bits,
                            {balanceTBefore_From.balance, balanceTBefore_From.tradingHistory},
                            {transferPayment.X, balanceTBefore_From.tradingHistory},
                            FMT(prefix, ".updateBalanceT_From")),
        updateAccount_From(pb, accountsMerkleRoot, accountID_From.bits,
                           {accountBefore_From.publicKey.x, accountBefore_From.publicKey.y, accountBefore_From.nonce, accountBefore_From.balancesRoot},
                           {accountBefore_From.publicKey.x, accountBefore_From.publicKey.y, nonce_From_after.result(), updateBalanceT_From.result()},
                           FMT(prefix, ".updateAccount_From")),

        // Update User To
        updateBalanceT_To(pb, accountBefore_To.balancesRoot, tokenID.bits,
                          {balanceTBefore_To.balance, balanceTBefore_To.tradingHistory},
                          {transferPayment.Y, balanceTBefore_To.tradingHistory},
                          FMT(prefix, ".updateBalanceT_To")),
        updateAccount_To(pb, updateAccount_From.result(), accountID_To.bits,
                         {accountBefore_To.publicKey.x, accountBefore_To.publicKey.y, accountBefore_To.nonce, accountBefore_To.balancesRoot},
                         {accountBefore_To.publicKey.x, accountBefore_To.publicKey.y, accountBefore_To.nonce, updateBalanceT_To.result()},
                         FMT(prefix, ".updateAccount_To")),

        // Update Operator
        updateBalanceF_O(pb, operatorBalancesRoot, feeTokenID.bits,
                         {balanceBefore_O.balance, balanceBefore_O.tradingHistory},
                         {feePayment.Y, balanceBefore_O.tradingHistory},
                         FMT(prefix, ".updateBalanceF_O"))
    {

    }

    void generate_r1cs_witness(const InternalTransfer& transfer)
    {
        // User From state
        balanceFBefore_From.generate_r1cs_witness(transfer.balanceUpdateF_From.before);
        balanceTBefore_From.generate_r1cs_witness(transfer.balanceUpdateT_From.before);
        accountBefore_From.generate_r1cs_witness(transfer.accountUpdate_From.before);
        // User To state
        balanceTBefore_To.generate_r1cs_witness(transfer.balanceUpdateT_To.before);
        accountBefore_To.generate_r1cs_witness(transfer.accountUpdate_To.before);
        // Operator state
        balanceBefore_O.generate_r1cs_witness(transfer.balanceUpdateF_O.before);

        // Inputs
        accountID_From.generate_r1cs_witness(pb, transfer.accountUpdate_From.accountID);
        accountID_To.generate_r1cs_witness(pb, transfer.accountUpdate_To.accountID);
        tokenID.generate_r1cs_witness(pb, transfer.balanceUpdateT_From.tokenID);
        amount.generate_r1cs_witness(pb, transfer.amount);
        feeTokenID.generate_r1cs_witness(pb, transfer.balanceUpdateF_From.tokenID);
        fee.generate_r1cs_witness(pb, transfer.fee);
        type.generate_r1cs_witness(pb, transfer.type);

        // Signature
        hash.generate_r1cs_witness();
        signatureVerifier.generate_r1cs_witness(transfer.signature);

        // Type
        signatureInvalid.generate_r1cs_witness();
        pb.val(numConditionalTransfersAfter.sum) = transfer.numConditionalTransfersAfter;
        type_eq_signatureInvalid.generate_r1cs_witness();

        // User To account check
        publicKeyX_notZero.generate_r1cs_witness();

        // Fee as float
        fFee.generate_r1cs_witness(toFloat(transfer.fee, Float16Encoding));
        requireAccuracyFee.generate_r1cs_witness();
        // Amount as float
        fAmount.generate_r1cs_witness(toFloat(transfer.amount, Float24Encoding));
        requireAccuracyAmount.generate_r1cs_witness();

        // Fee payment from From to the operator
        feePayment.generate_r1cs_witness();
        // Transfer from From to To
        transferPayment.generate_r1cs_witness();

        // Increase the nonce of From by 1
        nonce_From_after.generate_r1cs_witness();

        // Update User From
        updateBalanceF_From.generate_r1cs_witness(transfer.balanceUpdateF_From.proof);
        updateBalanceT_From.generate_r1cs_witness(transfer.balanceUpdateT_From.proof);
        updateAccount_From.generate_r1cs_witness(transfer.accountUpdate_From.proof);

        // Update User To
        updateBalanceT_To.generate_r1cs_witness(transfer.balanceUpdateT_To.proof);
        updateAccount_To.generate_r1cs_witness(transfer.accountUpdate_To.proof);

        // Update Operator
        updateBalanceF_O.generate_r1cs_witness(transfer.balanceUpdateF_O.proof);
    }

    void generate_r1cs_constraints()
    {
        // Inputs
        accountID_From.generate_r1cs_constraints(true);
        accountID_To.generate_r1cs_constraints(true);
        tokenID.generate_r1cs_constraints(true);
        amount.generate_r1cs_constraints(true);
        feeTokenID.generate_r1cs_constraints(true);
        fee.generate_r1cs_constraints(true);
        type.generate_r1cs_constraints(true);

        // Signature
        hash.generate_r1cs_constraints();
        signatureVerifier.generate_r1cs_constraints();

        // Type
        signatureInvalid.generate_r1cs_constraints();
        numConditionalTransfersAfter.generate_r1cs_constraints();
        type_eq_signatureInvalid.generate_r1cs_constraints();

        // User To account check
        publicKeyX_notZero.generate_r1cs_constraints();

        // Fee as float
        fFee.generate_r1cs_constraints();
        requireAccuracyFee.generate_r1cs_constraints();

        // Amount as float
        fAmount.generate_r1cs_constraints();
        requireAccuracyAmount.generate_r1cs_constraints();

        // Fee payment from From to the operator
        feePayment.generate_r1cs_constraints();
        // Transfer from From to To
        transferPayment.generate_r1cs_constraints();

        // Increase the nonce of From by 1
        nonce_From_after.generate_r1cs_constraints();

        // Update User From
        updateBalanceF_From.generate_r1cs_constraints();
        updateBalanceT_From.generate_r1cs_constraints();
        updateAccount_From.generate_r1cs_constraints();

        // Update User To
        updateBalanceT_To.generate_r1cs_constraints();
        updateAccount_To.generate_r1cs_constraints();

        // Update Operator
        updateBalanceF_O.generate_r1cs_constraints();
    }

    const std::vector<VariableArrayT> getPublicData() const
    {
        return {type.bits,
                accountID_From.bits,
                accountID_To.bits,
                VariableArrayT(2, constants.zero), tokenID.bits,
                VariableArrayT(2, constants.zero), feeTokenID.bits,
                fAmount.bits(),
                fFee.bits()};
    }

    const VariableT& getNewAccountsRoot() const
    {
        return updateAccount_To.result();
    }

    const VariableT& getNewOperatorBalancesRoot() const
    {
        return updateBalanceF_O.result();
    }

    const VariableT& getNewNumConditionalTransfers() const
    {
        return numConditionalTransfersAfter.result();
    }
};

class InternalTransferCircuit : public Circuit
{
public:
    PublicDataGadget publicData;
    Constants constants;
    jubjub::Params params;

    // State
    AccountGadget accountBefore_O;

    // Inputs
    DualVariableGadget exchangeID;
    DualVariableGadget merkleRootBefore;
    DualVariableGadget merkleRootAfter;
    std::unique_ptr<libsnark::dual_variable_gadget<FieldT>> numConditionalTransfers;
    DualVariableGadget operatorAccountID;

    // Operator account check
    RequireNotZeroGadget publicKeyX_notZero;

    // Internal transfers
    bool onchainDataAvailability;
    unsigned int numTransfers;
    std::vector<InternalTransferGadget> transfers;

    // Update Operator
    std::unique_ptr<UpdateAccountGadget> updateAccount_O;

    InternalTransferCircuit(ProtoboardT &pb, const std::string &prefix)
        : Circuit(pb, prefix),

          publicData(pb, FMT(prefix, ".publicData")),
          constants(pb, FMT(prefix, ".constants")),

          // State
          accountBefore_O(pb, FMT(prefix, ".accountBefore_O")),

          // Inputs
          exchangeID(pb, NUM_BITS_EXCHANGE_ID, FMT(prefix, ".exchangeID")),
          merkleRootBefore(pb, 256, FMT(prefix, ".merkleRootBefore")),
          merkleRootAfter(pb, 256, FMT(prefix, ".merkleRootAfter")),
          operatorAccountID(pb, NUM_BITS_ACCOUNT, FMT(prefix, ".operatorAccountID")),

          // Operator account check
          publicKeyX_notZero(pb, accountBefore_O.publicKey.x, FMT(prefix, ".publicKeyX_notZero"))
    {
    }

    void generateConstraints(bool onchainDataAvailability, unsigned int blockSize) override
    {
        this->onchainDataAvailability = onchainDataAvailability;
        this->numTransfers = blockSize;

        constants.generate_r1cs_constraints();

        // Inputs
        exchangeID.generate_r1cs_constraints(true);
        merkleRootBefore.generate_r1cs_constraints(true);
        merkleRootAfter.generate_r1cs_constraints(true);
        operatorAccountID.generate_r1cs_constraints(true);

        // Operator account check
        publicKeyX_notZero.generate_r1cs_constraints();

        // Internal transfers
        transfers.reserve(numTransfers);
        for (size_t j = 0; j < numTransfers; j++)
        {
            VariableT transAccountsRoot = (j == 0) ? merkleRootBefore.packed : transfers.back().getNewAccountsRoot();
            VariableT transOperatorBalancesRoot = (j == 0) ? accountBefore_O.balancesRoot : transfers.back().getNewOperatorBalancesRoot();

            transfers.emplace_back(
                pb,
                params,
                constants,
                transAccountsRoot,
                transOperatorBalancesRoot,
                exchangeID.packed,
                (j == 0) ? constants.zero : transfers.back().getNewNumConditionalTransfers(),
                std::string("transfer_") + std::to_string(j));
            transfers.back().generate_r1cs_constraints();
        }

        // Update Operator
        updateAccount_O.reset(new UpdateAccountGadget(pb, transfers.back().getNewAccountsRoot(), operatorAccountID.bits,
            {accountBefore_O.publicKey.x, accountBefore_O.publicKey.y, accountBefore_O.nonce, accountBefore_O.balancesRoot},
            {accountBefore_O.publicKey.x, accountBefore_O.publicKey.y, accountBefore_O.nonce, transfers.back().getNewOperatorBalancesRoot()},
            FMT(annotation_prefix, ".updateAccount_O")));
        updateAccount_O->generate_r1cs_constraints();

        // Num conditional transfers
        numConditionalTransfers.reset(new libsnark::dual_variable_gadget<FieldT>(
            pb, transfers.back().getNewNumConditionalTransfers(), 32, ".numConditionalTransfers")
        );
        numConditionalTransfers->generate_r1cs_constraints(true);

        // Public data
        publicData.add(exchangeID.bits);
        publicData.add(merkleRootBefore.bits);
        publicData.add(merkleRootAfter.bits);
        publicData.add(numConditionalTransfers->bits);
        if (onchainDataAvailability)
        {
            publicData.add(operatorAccountID.bits);
            for (const InternalTransferGadget& transfer : transfers)
            {
                publicData.add(transfer.getPublicData());
            }
        }
        publicData.generate_r1cs_constraints();

        // Check the new merkle root
        requireEqual(pb, updateAccount_O->result(), merkleRootAfter.packed, "newMerkleRoot");
    }

    bool generateWitness(const Loopring::InternalTransferBlock &block)
    {
        constants.generate_r1cs_witness();

        // State
        accountBefore_O.generate_r1cs_witness(block.accountUpdate_O.before);

        // Inputs
        exchangeID.generate_r1cs_witness(pb, block.exchangeID);
        merkleRootBefore.generate_r1cs_witness(pb, block.merkleRootBefore);
        merkleRootAfter.generate_r1cs_witness(pb, block.merkleRootAfter);
        operatorAccountID.generate_r1cs_witness(pb, block.operatorAccountID);

        // Operator account check
        publicKeyX_notZero.generate_r1cs_witness();

        // Internal transfers
#ifdef MULTICORE
        #pragma omp parallel for
#endif
        for (unsigned int i = 0; i < block.transfers.size(); i++)
        {
            transfers[i].generate_r1cs_witness(block.transfers[i]);
        }

        // Update operator
        updateAccount_O->generate_r1cs_witness(block.accountUpdate_O.proof);

        // Num conditional transfers
        numConditionalTransfers->generate_r1cs_witness_from_packed();

        // Public data
        publicData.generate_r1cs_witness();

        return true;
    }

    bool generateWitness(const json& input) override
    {
        return generateWitness(input.get<Loopring::InternalTransferBlock>());
    }

    BlockType getBlockType() override
    {
        return BlockType::InternalTransfer;
    }

    unsigned int getBlockSize() override
    {
        return numTransfers;
    }

    void printInfo() override
    {
        std::cout << pb.num_constraints() << " constraints (" << (pb.num_constraints() / numTransfers) << "/transfer)" << std::endl;
    }
};

} // namespace Loopring

#endif
