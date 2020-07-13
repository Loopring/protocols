#ifndef _OFFCHAINWITHDRAWALCIRCUIT_H_
#define _OFFCHAINWITHDRAWALCIRCUIT_H_

#include "Circuit.h"
#include "../Utils/Constants.h"
#include "../Utils/Data.h"
#include "../Utils/Utils.h"
#include "../Gadgets/AccountGadgets.h"

#include "ethsnarks.hpp"
#include "utils.hpp"
#include "gadgets/subadd.hpp"

using namespace ethsnarks;

namespace Loopring
{

class OffchainWithdrawalGadget : public GadgetT
{
public:

    const Constants& constants;

    // User state
    BalanceGadget balanceFBefore;
    BalanceGadget balanceBefore;
    AccountGadget accountBefore;
    // Operator state
    BalanceGadget balanceBefore_O;

    // Inputs
    DualVariableGadget accountID;
    DualVariableGadget tokenID;
    DualVariableGadget amountRequested;
    DualVariableGadget feeTokenID;
    DualVariableGadget fee;

    // Fee as float
    FloatGadget fFee;
    RequireAccuracyGadget requireAccuracyFee;

    // Fee payment from the user to the operator
    subadd_gadget feePayment;

    // Calculate how much can be withdrawn
    MinGadget amountToWithdraw;
    FloatGadget amountWithdrawn;
    RequireAccuracyGadget requireAccuracyAmountWithdrawn;

    // Calculate the new balance
    UnsafeSubGadget balance_after;

    // Increase the nonce of the user by 1
    AddGadget nonce_after;

    // Update User
    UpdateBalanceGadget updateBalanceF_A;
    UpdateBalanceGadget updateBalance_A;
    UpdateAccountGadget updateAccount_A;

    // Update Operator
    UpdateBalanceGadget updateBalanceF_O;

    // Signature
    Poseidon_gadget_T<8, 1, 6, 53, 7, 1> hash;
    SignatureVerifier signatureVerifier;

    OffchainWithdrawalGadget(
        ProtoboardT& pb,
        const jubjub::Params& params,
        const Constants& _constants,
        const VariableT& accountsMerkleRoot,
        const VariableT& operatorBalancesRoot,
        const VariableT& blockExchangeID,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        constants(_constants),

        // User state
        balanceFBefore(pb, FMT(prefix, ".balanceFBefore")),
        balanceBefore(pb, FMT(prefix, ".balanceBefore")),
        accountBefore(pb, FMT(prefix, ".accountBefore")),
        // Operator state
        balanceBefore_O(pb, FMT(prefix, ".balanceBefore_O")),

        // Inputs
        accountID(pb, NUM_BITS_ACCOUNT, FMT(prefix, ".accountID")),
        tokenID(pb, NUM_BITS_TOKEN, FMT(prefix, ".tokenID")),
        amountRequested(pb, NUM_BITS_AMOUNT, FMT(prefix, ".amountRequested")),
        feeTokenID(pb, NUM_BITS_TOKEN, FMT(prefix, ".feeTokenID")),
        fee(pb, NUM_BITS_AMOUNT, FMT(prefix, ".fee")),

        // Fee as float
        fFee(pb, constants, Float16Encoding, FMT(prefix, ".fFee")),
        requireAccuracyFee(pb, fFee.value(), fee.packed, Float16Accuracy, NUM_BITS_AMOUNT, FMT(prefix, ".requireAccuracyFee")),

        // Fee payment from the user to the operator
        feePayment(pb, NUM_BITS_AMOUNT, balanceFBefore.balance, balanceBefore_O.balance, fFee.value(), FMT(prefix, ".feePayment")),

        // Calculate how much can be withdrawn
        amountToWithdraw(pb, amountRequested.packed, balanceBefore.balance, NUM_BITS_AMOUNT, FMT(prefix, ".min(amountRequested, balance)")),
        amountWithdrawn(pb, constants, Float24Encoding, FMT(prefix, ".amountWithdrawn")),
        requireAccuracyAmountWithdrawn(pb, amountWithdrawn.value(), amountToWithdraw.result(), Float24Accuracy, NUM_BITS_AMOUNT, FMT(prefix, ".requireAccuracyAmountRequested")),

        // Calculate the new balance
        balance_after(pb, balanceBefore.balance, amountWithdrawn.value(), FMT(prefix, ".balance_after")),

        // Increase the nonce of the user by 1
        nonce_after(pb, accountBefore.nonce, constants.one, NUM_BITS_NONCE, FMT(prefix, ".nonce_after")),

        // Update User
        updateBalanceF_A(pb, accountBefore.balancesRoot, feeTokenID.bits,
                         {balanceFBefore.balance, balanceFBefore.tradingHistory},
                         {feePayment.X, balanceFBefore.tradingHistory},
                         FMT(prefix, ".updateBalanceF_A")),
        updateBalance_A(pb, updateBalanceF_A.result(), tokenID.bits,
                        {balanceBefore.balance, balanceBefore.tradingHistory},
                        {balance_after.result(), balanceBefore.tradingHistory},
                        FMT(prefix, ".updateBalance_A")),
        updateAccount_A(pb, accountsMerkleRoot, accountID.bits,
                        {accountBefore.publicKey.x, accountBefore.publicKey.y, accountBefore.nonce, accountBefore.balancesRoot},
                        {accountBefore.publicKey.x, accountBefore.publicKey.y, nonce_after.result(), updateBalance_A.result()},
                        FMT(prefix, ".updateAccount_A")),

        // Update Operator
        updateBalanceF_O(pb, operatorBalancesRoot, feeTokenID.bits,
                         {balanceBefore_O.balance, balanceBefore_O.tradingHistory},
                         {feePayment.Y, balanceBefore_O.tradingHistory},
                         FMT(prefix, ".updateBalanceF_O")),

        // Signature
        hash(pb, var_array({
            blockExchangeID,
            accountID.packed,
            tokenID.packed,
            amountRequested.packed,
            feeTokenID.packed,
            fee.packed,
            accountBefore.nonce
        }), FMT(this->annotation_prefix, ".hash")),
        signatureVerifier(pb, params, constants, accountBefore.publicKey, hash.result(), FMT(prefix, ".signatureVerifier"))
    {

    }

    void generate_r1cs_witness(const OffchainWithdrawal& withdrawal)
    {
        // User state
        balanceFBefore.generate_r1cs_witness(withdrawal.balanceUpdateF_A.before);
        balanceBefore.generate_r1cs_witness(withdrawal.balanceUpdateW_A.before);
        accountBefore.generate_r1cs_witness(withdrawal.accountUpdate_A.before);
        // Operator state
        balanceBefore_O.generate_r1cs_witness(withdrawal.balanceUpdateF_O.before);

        // Inputs
        accountID.generate_r1cs_witness(pb, withdrawal.accountUpdate_A.accountID);
        tokenID.generate_r1cs_witness(pb, withdrawal.balanceUpdateW_A.tokenID);
        amountRequested.generate_r1cs_witness(pb, withdrawal.amountRequested);
        feeTokenID.generate_r1cs_witness(pb, withdrawal.balanceUpdateF_A.tokenID);
        fee.generate_r1cs_witness(pb, withdrawal.fee);

        // Fee as float
        fFee.generate_r1cs_witness(toFloat(withdrawal.fee, Float16Encoding));
        requireAccuracyFee.generate_r1cs_witness();

        // Fee payment from the user to the operator
        feePayment.generate_r1cs_witness();

        // Calculate how much can be withdrawn
        amountToWithdraw.generate_r1cs_witness();
        amountWithdrawn.generate_r1cs_witness(toFloat(pb.val(amountToWithdraw.result()), Float24Encoding));
        requireAccuracyAmountWithdrawn.generate_r1cs_witness();

        // Calculate the new balance
        balance_after.generate_r1cs_witness();

        // Increase the nonce of the user by 1
        nonce_after.generate_r1cs_witness();

        // Update User
        updateBalanceF_A.generate_r1cs_witness(withdrawal.balanceUpdateF_A.proof);
        updateBalance_A.generate_r1cs_witness(withdrawal.balanceUpdateW_A.proof);
        updateAccount_A.generate_r1cs_witness(withdrawal.accountUpdate_A.proof);

        // Update Operator
        updateBalanceF_O.generate_r1cs_witness(withdrawal.balanceUpdateF_O.proof);

        // Check signature
        hash.generate_r1cs_witness();
        signatureVerifier.generate_r1cs_witness(withdrawal.signature);
    }

    void generate_r1cs_constraints()
    {
        // Inputs
        accountID.generate_r1cs_constraints(true);
        tokenID.generate_r1cs_constraints(true);
        amountRequested.generate_r1cs_constraints(true);
        feeTokenID.generate_r1cs_constraints(true);
        fee.generate_r1cs_constraints(true);

        // Fee as float
        fFee.generate_r1cs_constraints();
        requireAccuracyFee.generate_r1cs_constraints();

        // Fee payment from the user to the operator
        feePayment.generate_r1cs_constraints();

        // Calculate how much can be withdrawn
        amountToWithdraw.generate_r1cs_constraints();
        amountWithdrawn.generate_r1cs_constraints();
        requireAccuracyAmountWithdrawn.generate_r1cs_constraints();

        // Calculate the new balance
        balance_after.generate_r1cs_constraints();

        // Increase the nonce of the user by 1
        nonce_after.generate_r1cs_constraints();

        // Update User
        updateBalanceF_A.generate_r1cs_constraints();
        updateBalance_A.generate_r1cs_constraints();
        updateAccount_A.generate_r1cs_constraints();

        // Update Operator
        updateBalanceF_O.generate_r1cs_constraints();

        // Check signature
        hash.generate_r1cs_constraints();
        signatureVerifier.generate_r1cs_constraints();
    }

    const std::vector<VariableArrayT> getApprovedWithdrawalData() const
    {
        return {VariableArrayT(6, constants.zero), tokenID.bits,
                accountID.bits,
                amountWithdrawn.bits()};
    }

    const std::vector<VariableArrayT> getDataAvailabilityData() const
    {
        return {VariableArrayT(6, constants.zero), feeTokenID.bits,
                fFee.bits()};
    }

    const VariableT& getNewAccountsRoot() const
    {
        return updateAccount_A.result();
    }

    const VariableT& getNewOperatorBalancesRoot() const
    {
        return updateBalanceF_O.result();
    }
};

class OffchainWithdrawalCircuit : public Circuit
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
    DualVariableGadget operatorAccountID;

    // Operator account check
    RequireNotZeroGadget publicKeyX_notZero;

    // Withdrawals
    bool onchainDataAvailability;
    unsigned int numWithdrawals;
    std::vector<OffchainWithdrawalGadget> withdrawals;

    // Update Operator
    std::unique_ptr<UpdateAccountGadget> updateAccount_O;

    OffchainWithdrawalCircuit(ProtoboardT& pb, const std::string& prefix) :
        Circuit(pb, prefix),

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
        this->numWithdrawals = blockSize;

        constants.generate_r1cs_constraints();

        // Inputs
        exchangeID.generate_r1cs_constraints(true);
        merkleRootBefore.generate_r1cs_constraints(true);
        merkleRootAfter.generate_r1cs_constraints(true);
        operatorAccountID.generate_r1cs_constraints(true);

        // Operator account check
        publicKeyX_notZero.generate_r1cs_constraints();

        // Withdrawals
        withdrawals.reserve(numWithdrawals);
        for (size_t j = 0; j < numWithdrawals; j++)
        {
            VariableT withdrawalAccountsRoot = (j == 0) ? merkleRootBefore.packed : withdrawals.back().getNewAccountsRoot();
            VariableT withdrawalOperatorBalancesRoot = (j == 0) ? accountBefore_O.balancesRoot : withdrawals.back().getNewOperatorBalancesRoot();
            withdrawals.emplace_back(
                pb,
                params,
                constants,
                withdrawalAccountsRoot,
                withdrawalOperatorBalancesRoot,
                exchangeID.packed,
                std::string("withdrawals_") + std::to_string(j)
            );
            withdrawals.back().generate_r1cs_constraints();
        }

        // Update Operator
        updateAccount_O.reset(new UpdateAccountGadget(pb, withdrawals.back().getNewAccountsRoot(), operatorAccountID.bits,
            {accountBefore_O.publicKey.x, accountBefore_O.publicKey.y, accountBefore_O.nonce, accountBefore_O.balancesRoot},
            {accountBefore_O.publicKey.x, accountBefore_O.publicKey.y, accountBefore_O.nonce, withdrawals.back().getNewOperatorBalancesRoot()},
            FMT(annotation_prefix, ".updateAccount_O")));
        updateAccount_O->generate_r1cs_constraints();

        // Public data
        publicData.add(exchangeID.bits);
        publicData.add(merkleRootBefore.bits);
        publicData.add(merkleRootAfter.bits);
        // Store the approved data for all withdrawals
        for (auto& withdrawal : withdrawals)
        {
            publicData.add(withdrawal.getApprovedWithdrawalData());
        }
        // Data availability
        if (onchainDataAvailability)
        {
            publicData.add(operatorAccountID.bits);
            for (auto& withdrawal : withdrawals)
            {
                publicData.add(withdrawal.getDataAvailabilityData());
            }
        }
        publicData.generate_r1cs_constraints();

        // Check the new merkle root
        requireEqual(pb, updateAccount_O->result(), merkleRootAfter.packed, "newMerkleRoot");
    }

    bool generateWitness(const OffchainWithdrawalBlock& block)
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

        // Withdrawals
#ifdef MULTICORE
        #pragma omp parallel for
#endif
        for(unsigned int i = 0; i < block.withdrawals.size(); i++)
        {
            withdrawals[i].generate_r1cs_witness(block.withdrawals[i]);
        }

        // Update Operator
        updateAccount_O->generate_r1cs_witness(block.accountUpdate_O.proof);

        // Public data
        publicData.generate_r1cs_witness();

        return true;
    }

    bool generateWitness(const json& input) override
    {
        return generateWitness(input.get<Loopring::OffchainWithdrawalBlock>());
    }

    BlockType getBlockType() override
    {
        return BlockType::OffchainWithdrawal;
    }

    unsigned int getBlockSize() override
    {
        return numWithdrawals;
    }

    void printInfo() override
    {
        std::cout << pb.num_constraints() << " constraints (" << (pb.num_constraints() / numWithdrawals) << "/offchain withdrawal)" << std::endl;
    }
};

}

#endif
