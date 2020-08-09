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
  VariableT balancesRoot;
};

static void printAccount(const ProtoboardT &pb, const AccountState &state)
{
  std::cout << "- owner: " << pb.val(state.owner) << std::endl;
  std::cout << "- publicKeyX: " << pb.val(state.publicKeyX) << std::endl;
  std::cout << "- publicKeyY: " << pb.val(state.publicKeyY) << std::endl;
  std::cout << "- nonce: " << pb.val(state.nonce) << std::endl;
  std::cout << "- balancesRoot: " << pb.val(state.balancesRoot) << std::endl;
}

class AccountGadget : public GadgetT
{
public:
  VariableT owner;
  const jubjub::VariablePointT publicKey;
  VariableT nonce;
  VariableT balancesRoot;

  AccountGadget(ProtoboardT &pb, const std::string &prefix)
      : GadgetT(pb, prefix),

        owner(make_variable(pb, FMT(prefix, ".owner"))), publicKey(pb, FMT(prefix, ".publicKey")),
        nonce(make_variable(pb, FMT(prefix, ".nonce"))),
        balancesRoot(make_variable(pb, FMT(prefix, ".balancesRoot")))
  {
  }

  void generate_r1cs_witness(const AccountLeaf &account)
  {
    pb.val(owner) = account.owner;
    pb.val(publicKey.x) = account.publicKey.x;
    pb.val(publicKey.y) = account.publicKey.y;
    pb.val(nonce) = account.nonce;
    pb.val(balancesRoot) = account.balancesRoot;
  }
};

class UpdateAccountGadget : public GadgetT
{
public:
  HashAccountLeaf leafBefore;
  HashAccountLeaf leafAfter;

  AccountState stateBefore;
  AccountState stateAfter;

  const VariableArrayT proof;
  VerifyMerklePath rootBeforeVerifier;
  ComputeMerklePath rootAfter;

  UpdateAccountGadget(
    ProtoboardT &pb,
    const VariableT &rootBefore,
    const VariableArrayT &slotID,
    const AccountState &_stateBefore,
    const AccountState &_stateAfter,
    const std::string &prefix)
      : GadgetT(pb, prefix),

        stateBefore(_stateBefore), stateAfter(_stateAfter),

        leafBefore(
          pb,
          var_array(
            {_stateBefore.owner,
             _stateBefore.publicKeyX,
             _stateBefore.publicKeyY,
             _stateBefore.nonce,
             _stateBefore.balancesRoot}),
          FMT(prefix, ".leafBefore")),
        leafAfter(
          pb,
          var_array(
            {_stateAfter.owner,
             _stateAfter.publicKeyX,
             _stateAfter.publicKeyY,
             _stateAfter.nonce,
             _stateAfter.balancesRoot}),
          FMT(prefix, ".leafAfter")),

        proof(make_var_array(pb, TREE_DEPTH_ACCOUNTS * 3, FMT(prefix, ".proof"))),
        rootBeforeVerifier(
          pb,
          TREE_DEPTH_ACCOUNTS,
          slotID,
          leafBefore.result(),
          rootBefore,
          proof,
          FMT(prefix, ".pathBefore")),
        rootAfter(
          pb,
          TREE_DEPTH_ACCOUNTS,
          slotID,
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
    rootBeforeVerifier.generate_r1cs_witness();
    rootAfter.generate_r1cs_witness();

    // ASSERT(pb.val(rootBeforeVerifier.m_expected_root) == update.rootBefore,
    // annotation_prefix);
    if (pb.val(rootAfter.result()) != update.rootAfter)
      {
        std::cout << "Before:" << std::endl;
        printAccount(pb, stateBefore);
        std::cout << "After:" << std::endl;
        printAccount(pb, stateAfter);
        ASSERT(pb.val(rootAfter.result()) == update.rootAfter, annotation_prefix);
      }
  }

  void generate_r1cs_constraints()
  {
    leafBefore.generate_r1cs_constraints();
    leafAfter.generate_r1cs_constraints();

    rootBeforeVerifier.generate_r1cs_constraints();
    rootAfter.generate_r1cs_constraints();
  }

  const VariableT &result() const { return rootAfter.result(); }
};

struct BalanceState
{
  VariableT balance;
  VariableT storageRoot;
};

static void printBalance(const ProtoboardT &pb, const BalanceState &state)
{
  std::cout << "- balance: " << pb.val(state.balance) << std::endl;
  std::cout << "- storageRoot: " << pb.val(state.storageRoot) << std::endl;
}

class BalanceGadget : public GadgetT
{
public:
  VariableT balance;
  VariableT storageRoot;

  BalanceGadget(ProtoboardT &pb, const std::string &prefix)
      : GadgetT(pb, prefix),

        balance(make_variable(pb, FMT(prefix, ".balance"))),
        storageRoot(make_variable(pb, FMT(prefix, ".storageRoot")))
  {
  }

  void generate_r1cs_witness(const BalanceLeaf &balanceLeaf)
  {
    pb.val(balance) = balanceLeaf.balance;
    pb.val(storageRoot) = balanceLeaf.storageRoot;
  }
};

class UpdateBalanceGadget : public GadgetT
{
public:
  HashBalanceLeaf leafBefore;
  HashBalanceLeaf leafAfter;

  BalanceState stateBefore;
  BalanceState stateAfter;

  const VariableArrayT proof;
  VerifyMerklePath rootBeforeVerifier;
  ComputeMerklePath rootAfter;

  UpdateBalanceGadget(
    ProtoboardT &pb,
    const VariableT &rootBefore,
    const VariableArrayT &tokenID,
    const BalanceState _stateBefore,
    const BalanceState _stateAfter,
    const std::string &prefix)
      : GadgetT(pb, prefix),

        stateBefore(_stateBefore), stateAfter(_stateAfter),

        leafBefore(
          pb,
          var_array({_stateBefore.balance, _stateBefore.storageRoot}),
          FMT(prefix, ".leafBefore")),
        leafAfter(
          pb,
          var_array({_stateAfter.balance, _stateAfter.storageRoot}),
          FMT(prefix, ".leafAfter")),

        proof(make_var_array(pb, TREE_DEPTH_TOKENS * 3, FMT(prefix, ".proof"))),
        rootBeforeVerifier(
          pb,
          TREE_DEPTH_TOKENS,
          tokenID,
          leafBefore.result(),
          rootBefore,
          proof,
          FMT(prefix, ".pathBefore")),
        rootAfter(
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
    rootBeforeVerifier.generate_r1cs_witness();
    rootAfter.generate_r1cs_witness();

    // ASSERT(pb.val(rootBeforeVerifier.m_expected_root) == update.rootBefore,
    // annotation_prefix);
    if (pb.val(rootAfter.result()) != update.rootAfter)
      {
        std::cout << "Before:" << std::endl;
        printBalance(pb, stateBefore);
        std::cout << "After:" << std::endl;
        printBalance(pb, stateAfter);
        ASSERT(pb.val(rootAfter.result()) == update.rootAfter, annotation_prefix);
      }
  }

  void generate_r1cs_constraints()
  {
    leafBefore.generate_r1cs_constraints();
    leafAfter.generate_r1cs_constraints();

    rootBeforeVerifier.generate_r1cs_constraints();
    rootAfter.generate_r1cs_constraints();
  }

  const VariableT &result() const { return rootAfter.result(); }
};

// Calculcates the state of a user's open position
class DynamicBalanceGadget : public DynamicVariableGadget
{
public:
  DynamicBalanceGadget(ProtoboardT &pb, const VariableT &balance, const std::string &prefix)
      : DynamicVariableGadget(pb, prefix)
  {
    add(balance);
    allowGeneratingWitness = false;
  }

  DynamicBalanceGadget(ProtoboardT &pb, const BalanceGadget &balance, const std::string &prefix)
      : DynamicBalanceGadget(pb, balance.balance, prefix)
  {
  }

  void generate_r1cs_witness() {}

  void generate_r1cs_constraints() {}

  const VariableT &balance() const { return back(); }
};

} // namespace Loopring

#endif
