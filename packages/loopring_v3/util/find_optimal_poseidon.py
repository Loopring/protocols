import sys
sys.path.insert(0, 'ethsnarks')
from math import *

from ethsnarks.poseidon import poseidon, poseidon_params, poseidon_constants
from ethsnarks.field import SNARK_SCALAR_FIELD

def _poseidon_params(p, t, nRoundsF, nRoundsP, e, constants_C=None, constants_M=None, security_target=None):
    assert nRoundsF % 2 == 0 and nRoundsF >= 6
    assert nRoundsP > 0
    assert t >= 2

    n = floor(log2(p))
    if security_target is None:
        M = n  # security target, in bits
    else:
        M = security_target
    assert n >= M

    # Size of the state (in bits)
    N = n * t

    if p % 3 == 2:
        assert e == 3
        grobner_attack_ratio_rounds = 0.32
        grobner_attack_ratio_sboxes = 0.18
        interpolation_attack_ratio = 0.63
    elif p % 5 != 1:
        assert e == 5
        grobner_attack_ratio_rounds = 0.21
        grobner_attack_ratio_sboxes = 0.14
        interpolation_attack_ratio = 0.4306
    else:
        # XXX: in other cases use, can we use 7?
        raise ValueError('Invalid p for congruency')

    # Verify that the parameter choice exceeds the recommendations to prevent attacks
    # iacr.org/2019/458 § 3 Cryptanalysis Summary of Starkad and Poseidon Hashes (pg 10)
    # Figure 1
    #print('(nRoundsF + nRoundsP)', (nRoundsF + nRoundsP))
    #print('Interpolation Attackable Rounds', ((interpolation_attack_ratio * min(n, M)) + log2(t)))
    assert (nRoundsF + nRoundsP) > ((interpolation_attack_ratio * min(n, M)) + log2(t))
    # Figure 3
    #print('grobner_attack_ratio_rounds', ((2 + min(M, n)) * grobner_attack_ratio_rounds))
    assert (nRoundsF + nRoundsP) > ((2 + min(M, n)) * grobner_attack_ratio_rounds)
    # Figure 4
    #print('grobner_attack_ratio_sboxes', (M * grobner_attack_ratio_sboxes))
    assert (nRoundsF + (t * nRoundsP)) > (M * grobner_attack_ratio_sboxes)


    # iacr.org/2019/458 § 4.1 6 SNARKs Application via Poseidon-π
    # page 16 formula (8) and (9)
    n_constraints = (nRoundsF * t) + nRoundsP
    if e == 5:
        n_constraints *= 3
    elif e == 3:
        n_constraints *= 2

    return n_constraints


e = 5
p = 21888242871839275222246405745257275088548364400416034343698204186575808495617

if len(sys.argv) != 2:
    print("Invalid arguments! Pass in the number of inputs into the hash function.")
    sys.exit()

t = int(sys.argv[1]) + 1

best_constraints = 9999999
best_nRoundsF = 0
best_nRoundsP = 0

for nRoundsF in range(1, 16):
  for nRoundsP in range(1, 128):
    try:
      constraints = _poseidon_params(p, t, nRoundsF, nRoundsP, e, None, None, 128)
      #print("constraints: " + str(constraints))
      if constraints < best_constraints:
        best_constraints = constraints
        best_nRoundsF = int(nRoundsF)
        best_nRoundsP = int(nRoundsP)
    except:
      pass


print("t: " + str(t))
print("best_constraints: " + str(best_constraints))
print("best_nRoundsF: " + str(best_nRoundsF))
print("best_nRoundsP: " + str(best_nRoundsP))

print("cost: " + str(best_constraints / (t - 1)))

constants = list(poseidon_constants(SNARK_SCALAR_FIELD, b'poseidon_matrix_0000', t * 2))
print("values = " + str(constants))
params = poseidon_params(SNARK_SCALAR_FIELD, t, best_nRoundsF, best_nRoundsP, b'poseidon', 5, security_target=128)
print("expected_matrix = " + str(params.constants_M))
