#ifndef _UNIVERSALCIRCUIT_H_
#define _UNIVERSALCIRCUIT_H_

#include "Circuit.h"
#include "../Utils/Constants.h"
#include "../Utils/Data.h"
#include "../Utils/Utils.h"
#include "../Gadgets/MatchingGadgets.h"
#include "../Gadgets/AccountGadgets.h"
#include "../Gadgets/TradingHistoryGadgets.h"
#include "../Gadgets/MathGadgets.h"
#include "./BaseTransactionCircuit.h"
#include "./DepositCircuit.h"
#include "./TransferCircuit.h"
#include "./SpotTradeCircuit.h"
#include "./AccountUpdateCircuit.h"
#include "./WithdrawCircuit.h"
#include "./NoopCircuit.h"
#include "./NewAccountCircuit.h"
#include "./OwnerChangeCircuit.h"

#include "ethsnarks.hpp"
#include "utils.hpp"
#include "gadgets/subadd.hpp"

using namespace ethsnarks;

namespace Loopring
{

class SelectTransactionGadget : public BaseTransactionCircuit
{
public:

    std::vector<SelectGadget> uSelects;
    std::vector<ArraySelectGadget> aSelects;
    std::vector<ArraySelectGadget> publicDataSelects;

    SelectTransactionGadget(
        ProtoboardT& pb,
        const TransactionState& state,
        const VariableArrayT& selector,
        const std::vector<BaseTransactionCircuit*>& transactions,
        const std::string& prefix
    ) :
        BaseTransactionCircuit(pb, state, prefix)
    {
        assert(selector.size() == transactions.size());

        // Unsigned outputs
        uSelects.reserve(uOutputs.size());
        for (const auto &uPair : uOutputs)
        {
            std::vector<VariableT> variables;
            for (unsigned int i = 0; i < transactions.size(); i++)
            {
                variables.push_back(transactions[i]->getOutput(uPair.first));
            }
            uSelects.emplace_back(pb, selector, variables, FMT(annotation_prefix, ".uSelects"));

            // Set the output variable
            setOutput(uPair.first, uSelects.back().result());
        }

        // Array outputs
        aSelects.reserve(aOutputs.size());
        for (const auto &aPair : aOutputs)
        {
            std::vector<VariableArrayT> variables;
            for (unsigned int i = 0; i < transactions.size(); i++)
            {
                variables.push_back(transactions[i]->getArrayOutput(aPair.first));
            }
            aSelects.emplace_back(pb, selector, variables, FMT(annotation_prefix, ".aSelects"));

            // Set the output variable
            setArrayOutput(aPair.first, aSelects.back().result());
        }

        // Public data
        {
            std::vector<VariableArrayT> variables;
            for (unsigned int i = 0; i < transactions.size(); i++)
            {
                VariableArrayT da = transactions[i]->getPublicData();
                assert(da.size() <= (TX_DATA_AVAILABILITY_SIZE - 1) * 8);
                // Pad with zeros if needed
                for (unsigned int j = da.size(); j < (TX_DATA_AVAILABILITY_SIZE - 1) * 8; j++)
                {
                    da.emplace_back(state.constants.zero);
                }
                variables.push_back(da);
                //std::cout << "da size: " << variables.back().size() << std::endl;
            }
            publicDataSelects.emplace_back(pb, selector, variables, FMT(annotation_prefix, ".publicDataSelects"));
        }
    }

    void generate_r1cs_witness()
    {
        for (unsigned int i = 0; i < uSelects.size(); i++)
        {
            uSelects[i].generate_r1cs_witness();
        }
        for (unsigned int i = 0; i < aSelects.size(); i++)
        {
            aSelects[i].generate_r1cs_witness();
            // printBits("[ZKS]aSelects: 0x", aSelects[i].result().get_bits(pb));
        }
        for (unsigned int i = 0; i < publicDataSelects.size(); i++)
        {
            publicDataSelects[i].generate_r1cs_witness();
        }
    }

    void generate_r1cs_constraints()
    {
        for (unsigned int i = 0; i < uSelects.size(); i++)
        {
            uSelects[i].generate_r1cs_constraints();
        }
        for (unsigned int i = 0; i < aSelects.size(); i++)
        {
            aSelects[i].generate_r1cs_constraints();
        }
        for (unsigned int i = 0; i < publicDataSelects.size(); i++)
        {
            publicDataSelects[i].generate_r1cs_constraints();
        }
    }

    const VariableArrayT getPublicData() const
    {
        return publicDataSelects.back().result();
    }
};

class TransactionGadget : public GadgetT
{
public:

    const Constants& constants;

    DualVariableGadget type;
    SelectorGadget selector;

    TransactionState state;

    // Process transaction
    NoopCircuit noop;
    SpotTradeCircuit spotTrade;
    DepositCircuit deposit;
    NewAccountCircuit newAccount;
    WithdrawCircuit withdraw;
    AccountUpdateCircuit accountUpdate;
    TransferCircuit transfer;
    OwnerChangeCircuit ownerChange;
    SelectTransactionGadget tx;

    // General validation
    DualVariableGadget accountA;
    DualVariableGadget accountB;
    RequireLtGadget one_lt_accountA;
    RequireLtGadget one_lt_accountB;

    // Check signatures
    SignatureVerifier signatureVerifierA;
    SignatureVerifier signatureVerifierB;

    // Update UserA
    UpdateTradeHistoryGadget updateTradeHistory_A;
    UpdateBalanceGadget updateBalanceS_A;
    UpdateBalanceGadget updateBalanceB_A;
    UpdateAccountGadget updateAccount_A;

    // Update UserB
    UpdateTradeHistoryGadget updateTradeHistory_B;
    UpdateBalanceGadget updateBalanceS_B;
    UpdateBalanceGadget updateBalanceB_B;
    UpdateAccountGadget updateAccount_B;

    // Update Operator
    UpdateBalanceGadget updateBalanceB_O;
    UpdateBalanceGadget updateBalanceA_O;
    UpdateAccountGadget updateAccount_O;

    // Update Protocol pool
    UpdateBalanceGadget updateBalanceA_P;
    UpdateBalanceGadget updateBalanceB_P;

    // Update Index
    UpdateBalanceGadget updateBalanceB_I;
    UpdateBalanceGadget updateBalanceA_I;

    TransactionGadget(
        ProtoboardT& pb,
        const jubjub::Params& params,
        const Constants& _constants,
        const VariableT& exchange,
        const VariableT& accountsRoot,
        const VariableT& timestamp,
        const VariableT& protocolTakerFeeBips,
        const VariableT& protocolMakerFeeBips,
        const VariableArrayT& operatorAccountID,
        const VariableT& protocolBalancesRoot,
        const VariableT& indexBalancesRoot,
        const VariableT& numConditionalTransactionsBefore,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        constants(_constants),

        type(pb, NUM_BITS_TX_TYPE, FMT(prefix, ".type")),
        selector(pb, constants, type.packed, (unsigned int) TransactionType::COUNT, FMT(prefix, ".selector")),

        state(pb, params, constants, exchange, timestamp, protocolTakerFeeBips, protocolMakerFeeBips, numConditionalTransactionsBefore, type.packed, FMT(prefix, ".transactionState")),

        // Process transaction
        noop(pb, state, FMT(prefix, ".noop")),
        spotTrade(pb, state, FMT(prefix, ".spotTrade")),
        deposit(pb, state, FMT(prefix, ".deposit")),
        newAccount(pb, state, FMT(prefix, ".newAccount")),
        withdraw(pb, state, FMT(prefix, ".withdraw")),
        accountUpdate(pb, state, FMT(prefix, ".accountUpdate")),
        transfer(pb, state, FMT(prefix, ".transfer")),
        ownerChange(pb, state, FMT(prefix, ".ownerChange")),
        tx(pb, state, selector.result(), {&noop, &spotTrade, &deposit, &newAccount, &withdraw, &accountUpdate, &transfer, &ownerChange}, FMT(prefix, ".tx")),

        // General validation
        accountA(pb, tx.getArrayOutput(accountA_Address), FMT(prefix, ".packAccountA")),
        accountB(pb, tx.getArrayOutput(accountB_Address), FMT(prefix, ".packAccountA")),
        one_lt_accountA(pb, state.constants.one, accountA.packed, NUM_BITS_ACCOUNT, FMT(prefix, ".one_lt_accountA")),
        one_lt_accountB(pb, state.constants.one, accountB.packed, NUM_BITS_ACCOUNT, FMT(prefix, ".one_lt_accountB")),

        // Check signatures
        signatureVerifierA(pb, params, state.constants, jubjub::VariablePointT(tx.getOutput(publicKeyX_A), tx.getOutput(publicKeyY_A)), tx.getOutput(hash_A), tx.getOutput(signatureRequired_A), FMT(prefix, ".signatureVerifierA")),
        signatureVerifierB(pb, params, state.constants, jubjub::VariablePointT(tx.getOutput(publicKeyX_B), tx.getOutput(publicKeyY_B)), tx.getOutput(hash_B), tx.getOutput(signatureRequired_B), FMT(prefix, ".signatureVerifierB")),

        // Update UserA
        updateTradeHistory_A(pb, state.accountA.balanceS.tradingHistory, tx.getArrayOutput(tradeHistoryA_Address),
                             {state.accountA.tradeHistory.filled, state.accountA.tradeHistory.orderID},
                             {tx.getOutput(tradeHistoryA_Filled), tx.getOutput(tradeHistoryA_OrderId)},
                             FMT(prefix, ".updateTradeHistory_A")),
        updateBalanceS_A(pb, state.accountA.account.balancesRoot, tx.getArrayOutput(balanceA_S_Address),
                         {state.accountA.balanceS.balance, state.accountA.balanceS.index, state.accountA.balanceS.tradingHistory},
                         {tx.getOutput(balanceA_S_Balance), tx.getOutput(balanceA_S_Index), updateTradeHistory_A.result()},
                         FMT(prefix, ".updateBalanceS_A")),
        updateBalanceB_A(pb, updateBalanceS_A.result(), tx.getArrayOutput(balanceB_S_Address),
                         {state.accountA.balanceB.balance, state.accountA.balanceB.index, state.accountA.balanceB.tradingHistory},
                         {tx.getOutput(balanceA_B_Balance), tx.getOutput(balanceA_B_Index), state.accountA.balanceB.tradingHistory},
                         FMT(prefix, ".updateBalanceB_A")),
        updateAccount_A(pb, accountsRoot, tx.getArrayOutput(accountA_Address),
                        {state.accountA.account.owner, state.accountA.account.publicKey.x, state.accountA.account.publicKey.y, state.accountA.account.nonce, state.accountA.account.walletHash, state.accountA.account.balancesRoot},
                        {tx.getOutput(accountA_Owner), tx.getOutput(accountA_PublicKeyX), tx.getOutput(accountA_PublicKeyY), tx.getOutput(accountA_Nonce), tx.getOutput(accountA_WalletHash), updateBalanceB_A.result()},
                        FMT(prefix, ".updateAccount_A")),

        // Update UserB
        updateTradeHistory_B(pb, state.accountB.balanceS.tradingHistory, tx.getArrayOutput(tradeHistoryB_Address),
                             {state.accountB.tradeHistory.filled, state.accountB.tradeHistory.orderID},
                             {tx.getOutput(tradeHistoryB_Filled), tx.getOutput(tradeHistoryB_OrderId)},
                             FMT(prefix, ".updateTradeHistory_B")),
        updateBalanceS_B(pb, state.accountB.account.balancesRoot, tx.getArrayOutput(balanceB_S_Address),
                         {state.accountB.balanceS.balance, state.accountB.balanceS.index, state.accountB.balanceS.tradingHistory},
                         {tx.getOutput(balanceB_S_Balance), tx.getOutput(balanceB_S_Index), updateTradeHistory_B.result()},
                         FMT(prefix, ".updateBalanceS_B")),
        updateBalanceB_B(pb, updateBalanceS_B.result(), tx.getArrayOutput(balanceA_S_Address),
                         {state.accountB.balanceB.balance, state.accountB.balanceB.index, state.accountB.balanceB.tradingHistory},
                         {tx.getOutput(balanceB_B_Balance), tx.getOutput(balanceB_B_Index), state.accountB.balanceB.tradingHistory},
                         FMT(prefix, ".updateBalanceB_B")),
        updateAccount_B(pb, updateAccount_A.result(), tx.getArrayOutput(accountB_Address),
                        {state.accountB.account.owner, state.accountB.account.publicKey.x, state.accountB.account.publicKey.y, state.accountB.account.nonce, state.accountB.account.walletHash, state.accountB.account.balancesRoot},
                        {tx.getOutput(accountB_Owner), tx.getOutput(accountB_PublicKeyX), tx.getOutput(accountB_PublicKeyY), tx.getOutput(accountB_Nonce), tx.getOutput(accountB_WalletHash), updateBalanceB_B.result()},
                        FMT(prefix, ".updateAccount_B")),

        // Update Operator
        updateBalanceB_O(pb, state.oper.account.balancesRoot, tx.getArrayOutput(balanceA_S_Address),
                         {state.oper.balanceB.balance, state.oper.balanceB.index, state.oper.balanceB.tradingHistory},
                         {tx.getOutput(balanceO_B_Balance), tx.getOutput(balanceO_B_Index), state.oper.balanceB.tradingHistory},
                         FMT(prefix, ".updateBalanceB_O")),
        updateBalanceA_O(pb, updateBalanceB_O.result(), tx.getArrayOutput(balanceB_S_Address),
                         {state.oper.balanceA.balance, state.oper.balanceA.index, state.oper.balanceA.tradingHistory},
                         {tx.getOutput(balanceO_A_Balance), tx.getOutput(balanceO_A_Index), state.oper.balanceA.tradingHistory},
                         FMT(prefix, ".updateBalanceA_O")),
        updateAccount_O(pb, updateAccount_B.result(), operatorAccountID,
                        {state.oper.account.owner, state.oper.account.publicKey.x, state.oper.account.publicKey.y, state.oper.account.nonce, state.oper.account.walletHash, state.oper.account.balancesRoot},
                        {state.oper.account.owner, state.oper.account.publicKey.x, state.oper.account.publicKey.y, state.oper.account.nonce, state.oper.account.walletHash, updateBalanceA_O.result()},
                        FMT(prefix, ".updateAccount_O")),

        // Update Protocol pool
        updateBalanceA_P(pb, protocolBalancesRoot, tx.getArrayOutput(balanceB_S_Address),
                         {state.pool.balanceA.balance, state.pool.balanceA.index, constants.emptyTradeHistory},
                         {tx.getOutput(balanceP_A_Balance), tx.getOutput(balanceP_A_Index), constants.emptyTradeHistory},
                         FMT(prefix, ".updateBalanceA_P")),
        updateBalanceB_P(pb, updateBalanceA_P.result(), tx.getArrayOutput(balanceA_S_Address),
                         {state.pool.balanceB.balance, state.pool.balanceB.index, constants.emptyTradeHistory},
                         {tx.getOutput(balanceP_B_Balance), tx.getOutput(balanceP_B_Index), constants.emptyTradeHistory},
                         FMT(prefix, ".updateBalanceB_P")),

        // Update Index
        updateBalanceB_I(pb, indexBalancesRoot, tx.getArrayOutput(balanceA_S_Address),
                         {state.index.balanceB.balance, state.index.balanceB.index, state.index.balanceB.tradingHistory},
                         {state.index.balanceB.balance, tx.getOutput(index_B), state.index.balanceB.tradingHistory},
                         FMT(prefix, ".updateBalanceB_I")),
        updateBalanceA_I(pb, updateBalanceB_I.result(), tx.getArrayOutput(balanceB_S_Address),
                         {state.index.balanceA.balance, state.index.balanceA.index, state.index.balanceA.tradingHistory},
                         {state.index.balanceA.balance, tx.getOutput(index_A), state.index.balanceA.tradingHistory},
                         FMT(prefix, ".updateBalanceA_I"))

    {

    }

    void generate_r1cs_witness(const UniversalTransaction& uTx)
    {
        type.generate_r1cs_witness(pb, uTx.type);
        selector.generate_r1cs_witness();

        state.generate_r1cs_witness(uTx.witness.accountUpdate_A.before,
                                    uTx.witness.balanceUpdateS_A.before,
                                    uTx.witness.balanceUpdateB_A.before,
                                    uTx.witness.tradeHistoryUpdate_A.before,
                                    uTx.witness.accountUpdate_B.before,
                                    uTx.witness.balanceUpdateS_B.before,
                                    uTx.witness.balanceUpdateB_B.before,
                                    uTx.witness.tradeHistoryUpdate_B.before,
                                    uTx.witness.accountUpdate_O.before,
                                    uTx.witness.balanceUpdateA_O.before,
                                    uTx.witness.balanceUpdateB_O.before,
                                    uTx.witness.balanceUpdateA_P.before,
                                    uTx.witness.balanceUpdateB_P.before,
                                    uTx.witness.balanceUpdateA_I.before,
                                    uTx.witness.balanceUpdateB_I.before);

        noop.generate_r1cs_witness();
        spotTrade.generate_r1cs_witness(uTx.spotTrade);
        deposit.generate_r1cs_witness(uTx.deposit);
        newAccount.generate_r1cs_witness(uTx.newAccount);
        withdraw.generate_r1cs_witness(uTx.withdraw);
        accountUpdate.generate_r1cs_witness(uTx.accountUpdate);
        transfer.generate_r1cs_witness(uTx.transfer);
        ownerChange.generate_r1cs_witness(uTx.ownerChange);
        tx.generate_r1cs_witness();

        // General validation
        accountA.generate_r1cs_witness();
        accountB.generate_r1cs_witness();
        one_lt_accountA.generate_r1cs_witness();
        one_lt_accountB.generate_r1cs_witness();

        // Check signatures
        signatureVerifierA.generate_r1cs_witness(uTx.witness.signatureA);
        signatureVerifierB.generate_r1cs_witness(uTx.witness.signatureB);

        // Update UserA
        updateTradeHistory_A.generate_r1cs_witness(uTx.witness.tradeHistoryUpdate_A);
        updateBalanceS_A.generate_r1cs_witness(uTx.witness.balanceUpdateS_A);
        updateBalanceB_A.generate_r1cs_witness(uTx.witness.balanceUpdateB_A);
        updateAccount_A.generate_r1cs_witness(uTx.witness.accountUpdate_A);

        // Update UserB
        updateTradeHistory_B.generate_r1cs_witness(uTx.witness.tradeHistoryUpdate_B);
        updateBalanceS_B.generate_r1cs_witness(uTx.witness.balanceUpdateS_B);
        updateBalanceB_B.generate_r1cs_witness(uTx.witness.balanceUpdateB_B);
        updateAccount_B.generate_r1cs_witness(uTx.witness.accountUpdate_B);

        // Update Operator
        updateBalanceB_O.generate_r1cs_witness(uTx.witness.balanceUpdateB_O);
        updateBalanceA_O.generate_r1cs_witness(uTx.witness.balanceUpdateA_O);
        updateAccount_O.generate_r1cs_witness(uTx.witness.accountUpdate_O);

        // Update Protocol pool
        updateBalanceA_P.generate_r1cs_witness(uTx.witness.balanceUpdateA_P);
        updateBalanceB_P.generate_r1cs_witness(uTx.witness.balanceUpdateB_P);

        // Update Index
        updateBalanceB_I.generate_r1cs_witness(uTx.witness.balanceUpdateB_I);
        updateBalanceA_I.generate_r1cs_witness(uTx.witness.balanceUpdateA_I);
    }


    void generate_r1cs_constraints()
    {
        type.generate_r1cs_constraints(true);
        selector.generate_r1cs_constraints();

        noop.generate_r1cs_constraints();
        spotTrade.generate_r1cs_constraints();
        deposit.generate_r1cs_constraints();
        newAccount.generate_r1cs_constraints();
        withdraw.generate_r1cs_constraints();
        accountUpdate.generate_r1cs_constraints();
        transfer.generate_r1cs_constraints();
        ownerChange.generate_r1cs_constraints();
        tx.generate_r1cs_constraints();

        // General validation
        accountA.generate_r1cs_constraints();
        accountB.generate_r1cs_constraints();
        one_lt_accountA.generate_r1cs_constraints();
        one_lt_accountB.generate_r1cs_constraints();

        // Check signatures
        signatureVerifierA.generate_r1cs_constraints();
        signatureVerifierB.generate_r1cs_constraints();

        // Update UserA
        updateTradeHistory_A.generate_r1cs_constraints();
        updateBalanceS_A.generate_r1cs_constraints();
        updateBalanceB_A.generate_r1cs_constraints();
        updateAccount_A.generate_r1cs_constraints();

        // Update UserB
        updateTradeHistory_B.generate_r1cs_constraints();
        updateBalanceS_B.generate_r1cs_constraints();
        updateBalanceB_B.generate_r1cs_constraints();
        updateAccount_B.generate_r1cs_constraints();

        // Update Operator
        updateBalanceB_O.generate_r1cs_constraints();
        updateBalanceA_O.generate_r1cs_constraints();
        updateAccount_O.generate_r1cs_constraints();

        // Update Protocol fee pool
        updateBalanceA_P.generate_r1cs_constraints();
        updateBalanceB_P.generate_r1cs_constraints();

        // Update Index
        updateBalanceB_I.generate_r1cs_constraints();
        updateBalanceA_I.generate_r1cs_constraints();
    }

    const VariableArrayT getPublicData() const
    {
        return flatten({reverse(type.bits), tx.getPublicData()});
    }

    const VariableT& getNewAccountsRoot() const
    {
        return updateAccount_O.result();
    }

    const VariableT& getNewProtocolBalancesRoot() const
    {
        return updateBalanceB_P.result();
    }

    const VariableT& getNewIndexBalancesRoot() const
    {
        return updateBalanceA_I.result();
    }
};

class UniversalCircuit : public Circuit
{
public:

    PublicDataGadget publicData;
    Constants constants;
    jubjub::Params params;

    // State
    AccountGadget accountBefore_P;
    AccountGadget accountBefore_I;
    AccountGadget accountBefore_O;

    // Inputs
    DualVariableGadget exchange;
    DualVariableGadget merkleRootBefore;
    DualVariableGadget merkleRootAfter;
    DualVariableGadget timestamp;
    DualVariableGadget protocolTakerFeeBips;
    DualVariableGadget protocolMakerFeeBips;
    std::unique_ptr<libsnark::dual_variable_gadget<FieldT>> numConditionalTransactions;
    DualVariableGadget operatorAccountID;

    // Increment the nonce of the Operator
    AddGadget nonce_after;

    // Signature
    Poseidon_gadget_T<3, 1, 6, 51, 2, 1> hash;
    SignatureVerifier signatureVerifier;

    // Transactions
    bool onchainDataAvailability;
    unsigned int numTransactions;
    std::vector<TransactionGadget> transactions;

    // Update Protocol pool
    std::unique_ptr<UpdateAccountGadget> updateAccount_P;

    // Update Index
    std::unique_ptr<UpdateAccountGadget> updateAccount_I;

    // Update Operator
    std::unique_ptr<UpdateAccountGadget> updateAccount_O;


    UniversalCircuit(ProtoboardT& pb, const std::string& prefix) :
        Circuit(pb, prefix),

        publicData(pb, FMT(prefix, ".publicData")),
        constants(pb, FMT(prefix, ".constants")),

        // State
        accountBefore_I(pb, FMT(prefix, ".accountBefore_I")),
        accountBefore_P(pb, FMT(prefix, ".accountBefore_P")),
        accountBefore_O(pb, FMT(prefix, ".accountBefore_O")),

        // Inputs
        exchange(pb, NUM_BITS_ADDRESS, FMT(prefix, ".exchange")),
        merkleRootBefore(pb, 256, FMT(prefix, ".merkleRootBefore")),
        merkleRootAfter(pb, 256, FMT(prefix, ".merkleRootAfter")),
        timestamp(pb, NUM_BITS_TIMESTAMP, FMT(prefix, ".timestamp")),
        protocolTakerFeeBips(pb, NUM_BITS_PROTOCOL_FEE_BIPS, FMT(prefix, ".protocolTakerFeeBips")),
        protocolMakerFeeBips(pb, NUM_BITS_PROTOCOL_FEE_BIPS, FMT(prefix, ".protocolMakerFeeBips")),
        operatorAccountID(pb, NUM_BITS_ACCOUNT, FMT(prefix, ".operatorAccountID")),

        // Increment the nonce of the Operator
        nonce_after(pb, accountBefore_O.nonce, constants.one, NUM_BITS_NONCE, FMT(prefix, ".nonce_after")),

        // Signature
        hash(pb, var_array({
            publicData.publicInput,
            accountBefore_O.nonce
        }), FMT(this->annotation_prefix, ".hash")),
        signatureVerifier(pb, params, constants, accountBefore_O.publicKey, hash.result(), constants.one, FMT(prefix, ".signatureVerifier"))
    {

    }

    void generateConstraints(bool onchainDataAvailability, unsigned int blockSize) override
    {
        this->onchainDataAvailability = onchainDataAvailability;
        this->numTransactions = blockSize;

        constants.generate_r1cs_constraints();

        // Inputs
        exchange.generate_r1cs_constraints(true);
        merkleRootBefore.generate_r1cs_constraints(true);
        merkleRootAfter.generate_r1cs_constraints(true);
        timestamp.generate_r1cs_constraints(true);
        protocolTakerFeeBips.generate_r1cs_constraints(true);
        protocolMakerFeeBips.generate_r1cs_constraints(true);
        operatorAccountID.generate_r1cs_constraints(true);

        // Increment the nonce of the Operator
        nonce_after.generate_r1cs_constraints();

        // Transactions
        transactions.reserve(numTransactions);
        for (size_t j = 0; j < numTransactions; j++)
        {
            std::cout << "------------------- tx: " << j << std::endl;
            const VariableT txAccountsRoot = (j == 0) ? merkleRootBefore.packed : transactions.back().getNewAccountsRoot();
            const VariableT& txProtocolBalancesRoot = (j == 0) ? accountBefore_P.balancesRoot : transactions.back().getNewProtocolBalancesRoot();
            const VariableT& txIndexBalancesRoot = (j == 0) ? accountBefore_I.balancesRoot : transactions.back().getNewIndexBalancesRoot();
            transactions.emplace_back(
                pb,
                params,
                constants,
                exchange.packed,
                txAccountsRoot,
                timestamp.packed,
                protocolTakerFeeBips.packed,
                protocolMakerFeeBips.packed,
                operatorAccountID.bits,
                txProtocolBalancesRoot,
                txIndexBalancesRoot,
                (j == 0) ? constants.zero : transactions.back().tx.getOutput(misc_NumConditionalTransactions),
                std::string("tx_") + std::to_string(j)
            );
            transactions.back().generate_r1cs_constraints();
        }

        // Update Protocol pool
        updateAccount_P.reset(new UpdateAccountGadget(pb, transactions.back().getNewAccountsRoot(), constants.zeroAccount,
                      {accountBefore_P.owner, accountBefore_P.publicKey.x, accountBefore_P.publicKey.y, accountBefore_P.nonce, accountBefore_P.walletHash, accountBefore_P.balancesRoot},
                      {accountBefore_P.owner, accountBefore_P.publicKey.x, accountBefore_P.publicKey.y, accountBefore_P.nonce, accountBefore_P.walletHash, transactions.back().getNewProtocolBalancesRoot()},
                      FMT(annotation_prefix, ".updateAccount_P")));
        updateAccount_P->generate_r1cs_constraints();

        // Update Index
        updateAccount_I.reset(new UpdateAccountGadget(pb, updateAccount_P->result(), flatten({VariableArrayT(1, constants.one), VariableArrayT(NUM_BITS_ACCOUNT - 1, constants.zero)}),
                      {accountBefore_I.owner, accountBefore_I.publicKey.x, accountBefore_I.publicKey.y, accountBefore_I.nonce, accountBefore_I.walletHash, accountBefore_I.balancesRoot},
                      {accountBefore_I.owner, accountBefore_I.publicKey.x, accountBefore_I.publicKey.y, accountBefore_I.nonce, accountBefore_I.walletHash, transactions.back().getNewIndexBalancesRoot()},
                      FMT(annotation_prefix, ".updateAccount_I")));
        updateAccount_I->generate_r1cs_constraints();

        // Update Operator
        updateAccount_O.reset(new UpdateAccountGadget(pb, updateAccount_I->result(), operatorAccountID.bits,
                      {accountBefore_O.owner, accountBefore_O.publicKey.x, accountBefore_O.publicKey.y, accountBefore_O.nonce, accountBefore_O.walletHash, accountBefore_O.balancesRoot},
                      {accountBefore_O.owner, accountBefore_O.publicKey.x, accountBefore_O.publicKey.y, nonce_after.result(), accountBefore_O.walletHash, accountBefore_O.balancesRoot},
                      FMT(annotation_prefix, ".updateAccount_O")));
        updateAccount_O->generate_r1cs_constraints();


        // Num conditional transactions
        numConditionalTransactions.reset(new libsnark::dual_variable_gadget<FieldT>(
            pb, transactions.back().tx.getOutput(misc_NumConditionalTransactions), 32, ".numConditionalTransactions")
        );
        numConditionalTransactions->generate_r1cs_constraints(true);

        // Public data
        publicData.add(exchange.bits);
        publicData.add(merkleRootBefore.bits);
        publicData.add(merkleRootAfter.bits);
        publicData.add(timestamp.bits);
        publicData.add(protocolTakerFeeBips.bits);
        publicData.add(protocolMakerFeeBips.bits);
        publicData.add(numConditionalTransactions->bits);
        if (onchainDataAvailability)
        {
            publicData.add(operatorAccountID.bits);
            for (size_t j = 0; j < numTransactions; j++)
            {
                publicData.add(reverse(transactions[j].getPublicData()));
            }
        }
        publicData.generate_r1cs_constraints();

        // Signature
        hash.generate_r1cs_constraints();
        signatureVerifier.generate_r1cs_constraints();

        // Check the new merkle root
        requireEqual(pb, updateAccount_O->result(), merkleRootAfter.packed, "newMerkleRoot");
    }

    bool generateWitness(const Block& block)
    {
        if (block.transactions.size() != numTransactions)
        {
            std::cout << "Invalid number of transactions: " << block.transactions.size() << std::endl;
            return false;
        }

        constants.generate_r1cs_witness();

        // State
        accountBefore_P.generate_r1cs_witness(block.accountUpdate_P.before);
        accountBefore_I.generate_r1cs_witness(block.accountUpdate_I.before);
        accountBefore_O.generate_r1cs_witness(block.accountUpdate_O.before);

        // Inputs
        exchange.generate_r1cs_witness(pb, block.exchange);
        merkleRootBefore.generate_r1cs_witness(pb, block.merkleRootBefore);
        merkleRootAfter.generate_r1cs_witness(pb, block.merkleRootAfter);
        timestamp.generate_r1cs_witness(pb, block.timestamp);
        protocolTakerFeeBips.generate_r1cs_witness(pb, block.protocolTakerFeeBips);
        protocolMakerFeeBips.generate_r1cs_witness(pb, block.protocolMakerFeeBips);
        operatorAccountID.generate_r1cs_witness(pb, block.operatorAccountID);

        // Increment the nonce of the Operator
        nonce_after.generate_r1cs_witness();

        // Transactions
        // First set numConditionalTransactionsAfter which is a dependency between transactions.
        // Once this is set the transactions can be processed in parallel.
        for(unsigned int i = 0; i < block.transactions.size(); i++)
        {
            pb.val(transactions[i].tx.getOutput(misc_NumConditionalTransactions)) = block.transactions[i].witness.numConditionalTransactionsAfter;
        }
#ifdef MULTICORE
        #pragma omp parallel for
#endif
        for(unsigned int i = 0; i < block.transactions.size(); i++)
        {
            //std::cout << "--------------- tx: " << i << " ( " << block.transactions[i].type << " ) " << std::endl;
            transactions[i].generate_r1cs_witness(block.transactions[i]);
        }

        // Update Protocol pool
        updateAccount_P->generate_r1cs_witness(block.accountUpdate_P);

        // Update Index
        updateAccount_I->generate_r1cs_witness(block.accountUpdate_I);

        // Update Operator
        updateAccount_O->generate_r1cs_witness(block.accountUpdate_O);

        // Num conditional transactions
        numConditionalTransactions->generate_r1cs_witness_from_packed();

        // Public data
        publicData.generate_r1cs_witness();

        // Signature
        hash.generate_r1cs_witness();
        signatureVerifier.generate_r1cs_witness(block.signature);

        return true;
    }

    bool generateWitness(const json& input) override
    {
        return generateWitness(input.get<Block>());
    }

    unsigned int getBlockType() override
    {
        return 0;
    }

    unsigned int getBlockSize() override
    {
        return numTransactions;
    }

    void printInfo() override
    {
        std::cout << pb.num_constraints() << " constraints (" << (pb.num_constraints() / numTransactions) << "/tx)" << std::endl;
    }
};

}

#endif
