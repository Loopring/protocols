// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
#ifndef _ACCOUNTGADGETS_H_
#define _ACCOUNTGADGETS_H_

#include "../Utils/Constants.h"
#include "../Utils/Data.h"

#include "MerkleTree.h"

#include "ethsnarks.hpp"
#include "utils.hpp"
#include "gadgets/merkle_tree.hpp"
#include "gadgets/poseidon.hpp"

using namespace ethsnarks;

namespace Loopring
{

struct AccountState
{
    VariableT owner;
    VariableT publicKeyX;
    VariableT publicKeyY;
    VariableT nonce;
    VariableT feeBipsAMM;
    VariableT balancesRoot;
};

static void printAccount(const ProtoboardT &pb, const AccountState &state)
{
    std::cout << "- owner: " << pb.val(state.owner) << std::endl;
    std::cout << "- publicKeyX: " << pb.val(state.publicKeyX) << std::endl;
    std::cout << "- publicKeyY: " << pb.val(state.publicKeyY) << std::endl;
    std::cout << "- nonce: " << pb.val(state.nonce) << std::endl;
    std::cout << "- feeBipsAMM: " << pb.val(state.feeBipsAMM) << std::endl;
    std::cout << "- balancesRoot: " << pb.val(state.balancesRoot) << std::endl;
}

class AccountGadget : public GadgetT
{
  public:
    VariableT owner;
    const jubjub::VariablePointT publicKey;
    VariableT nonce;
    VariableT feeBipsAMM;
    VariableT balancesRoot;

    AccountGadget( //
      ProtoboardT &pb,
      const std::string &prefix)
        : GadgetT(pb, prefix),

          owner(make_variable(pb, FMT(prefix, ".owner"))),
          publicKey(pb, FMT(prefix, ".publicKey")),
          nonce(make_variable(pb, FMT(prefix, ".nonce"))),
          feeBipsAMM(make_variable(pb, FMT(prefix, ".feeBipsAMM"))),
          balancesRoot(make_variable(pb, FMT(prefix, ".balancesRoot")))
    {
    }

    void generate_r1cs_witness(const AccountLeaf &account)
    {
        pb.val(owner) = account.owner;
        pb.val(publicKey.x) = account.publicKey.x;
        pb.val(publicKey.y) = account.publicKey.y;
        pb.val(nonce) = account.nonce;
        pb.val(feeBipsAMM) = account.feeBipsAMM;
        pb.val(balancesRoot) = account.balancesRoot;
    }
};

class UpdateAccountGadget : public GadgetT
{
  public:
    HashAccountLeaf leafBefore;
    HashAccountLeaf leafAfter;

    AccountState valuesBefore;
    AccountState valuesAfter;

    const VariableArrayT proof;
    MerklePathCheckT proofVerifierBefore;
    MerklePathT rootCalculatorAfter;

    UpdateAccountGadget(
      ProtoboardT &pb,
      const VariableT &merkleRoot,
      const VariableArrayT &address,
      const AccountState &before,
      const AccountState &after,
      const std::string &prefix)
        : GadgetT(pb, prefix),

          valuesBefore(before),
          valuesAfter(after),

          leafBefore(
            pb,
            var_array(
              {before.owner,
               before.publicKeyX,
               before.publicKeyY,
               before.nonce,
               before.feeBipsAMM,
               before.balancesRoot}),
            FMT(prefix, ".leafBefore")),
          leafAfter(
            pb,
            var_array(
              {after.owner, //
               after.publicKeyX,
               after.publicKeyY,
               after.nonce,
               after.feeBipsAMM,
               after.balancesRoot}),
            FMT(prefix, ".leafAfter")),

          proof(make_var_array(pb, TREE_DEPTH_ACCOUNTS * 3, FMT(prefix, ".proof"))),
          proofVerifierBefore(
            pb,
            TREE_DEPTH_ACCOUNTS,
            address,
            leafBefore.result(),
            merkleRoot,
            proof,
            FMT(prefix, ".pathBefore")),
          rootCalculatorAfter( //
            pb,
            TREE_DEPTH_ACCOUNTS,
            address,
            leafAfter.result(),
            proof,
            FMT(prefix, ".pathAfter"))
    {
    }

    void generate_r1cs_witness(const AccountUpdate &update)
    {
        leafBefore.generate_r1cs_witness();
        leafAfter.generate_r1cs_witness();

        proof.fill_with_field_elements(pb, update.proof.data);
        proofVerifierBefore.generate_r1cs_witness();
        rootCalculatorAfter.generate_r1cs_witness();

        // ASSERT(pb.val(proofVerifierBefore.m_expected_root) == update.rootBefore,
        // annotation_prefix);
        if (pb.val(rootCalculatorAfter.result()) != update.rootAfter)
        {
            std::cout << "Before:" << std::endl;
            printAccount(pb, valuesBefore);
            std::cout << "After:" << std::endl;
            printAccount(pb, valuesAfter);
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

    const VariableT &result() const
    {
        return rootCalculatorAfter.result();
    }
};

struct BalanceState
{
    VariableT balance;
    VariableT weightAMM;
    VariableT storageRoot;
};

static void printBalance(const ProtoboardT &pb, const BalanceState &state)
{
    std::cout << "- balance: " << pb.val(state.balance) << std::endl;
    std::cout << "- weightAMM: " << pb.val(state.weightAMM) << std::endl;
    std::cout << "- storageRoot: " << pb.val(state.storageRoot) << std::endl;
}

class BalanceGadget : public GadgetT
{
  public:
    VariableT balance;
    VariableT weightAMM;
    VariableT storageRoot;

    BalanceGadget( //
      ProtoboardT &pb,
      const std::string &prefix)
        : GadgetT(pb, prefix),

          balance(make_variable(pb, FMT(prefix, ".balance"))),
          weightAMM(make_variable(pb, FMT(prefix, ".weightAMM"))),
          storageRoot(make_variable(pb, FMT(prefix, ".storageRoot")))
    {
    }

    void generate_r1cs_witness(const BalanceLeaf &balanceLeaf)
    {
        pb.val(balance) = balanceLeaf.balance;
        pb.val(weightAMM) = balanceLeaf.weightAMM;
        pb.val(storageRoot) = balanceLeaf.storageRoot;
    }
};

class UpdateBalanceGadget : public GadgetT
{
  public:
    HashBalanceLeaf leafBefore;
    HashBalanceLeaf leafAfter;

    BalanceState valuesBefore;
    BalanceState valuesAfter;

    const VariableArrayT proof;
    MerklePathCheckT proofVerifierBefore;
    MerklePathT rootCalculatorAfter;

    UpdateBalanceGadget(
      ProtoboardT &pb,
      const VariableT &merkleRoot,
      const VariableArrayT &tokenID,
      const BalanceState before,
      const BalanceState after,
      const std::string &prefix)
        : GadgetT(pb, prefix),

          valuesBefore(before),
          valuesAfter(after),

          leafBefore( //
            pb,
            var_array({before.balance, before.weightAMM, before.storageRoot}),
            FMT(prefix, ".leafBefore")),
          leafAfter( //
            pb,
            var_array({after.balance, after.weightAMM, after.storageRoot}),
            FMT(prefix, ".leafAfter")),

          proof(make_var_array(pb, TREE_DEPTH_TOKENS * 3, FMT(prefix, ".proof"))),
          proofVerifierBefore(
            pb,
            TREE_DEPTH_TOKENS,
            tokenID,
            leafBefore.result(),
            merkleRoot,
            proof,
            FMT(prefix, ".pathBefore")),
          rootCalculatorAfter( //
            pb,
            TREE_DEPTH_TOKENS,
            tokenID,
            leafAfter.result(),
            proof,
            FMT(prefix, ".pathAfter"))
    {
    }

    void generate_r1cs_witness(const BalanceUpdate &update)
    {
        leafBefore.generate_r1cs_witness();
        leafAfter.generate_r1cs_witness();

        proof.fill_with_field_elements(pb, update.proof.data);
        proofVerifierBefore.generate_r1cs_witness();
        rootCalculatorAfter.generate_r1cs_witness();

        // ASSERT(pb.val(proofVerifierBefore.m_expected_root) == update.rootBefore,
        // annotation_prefix);
        if (pb.val(rootCalculatorAfter.result()) != update.rootAfter)
        {
            std::cout << "Before:" << std::endl;
            printBalance(pb, valuesBefore);
            std::cout << "After:" << std::endl;
            printBalance(pb, valuesAfter);
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

    const VariableT &result() const
    {
        return rootCalculatorAfter.result();
    }
};

// Calculcates the state of a user's open position
class DynamicBalanceGadget : public DynamicVariableGadget
{
  public:
    DynamicBalanceGadget( //
      ProtoboardT &pb,
      const VariableT &balance,
      const std::string &prefix)
        : DynamicVariableGadget(pb, balance, prefix)
    {
    }

    DynamicBalanceGadget( //
      ProtoboardT &pb,
      const BalanceGadget &balance,
      const std::string &prefix)
        : DynamicBalanceGadget(pb, balance.balance, prefix)
    {
    }

    void generate_r1cs_witness()
    {
    }

    void generate_r1cs_constraints()
    {
    }

    const VariableT &balance() const
    {
        return back();
    }
};

} // namespace Loopring

#endif
