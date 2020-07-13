#include "../ThirdParty/catch.hpp"
#include "TestUtils.h"

#include "../Gadgets/MathGadgets.h"

TEST_CASE("Variable selection", "[TernaryGadget]")
{
    protoboard<FieldT> pb;

    pb_variable<FieldT> b, A, B;
    b.allocate(pb, "b");
    A.allocate(pb, "A");
    B.allocate(pb, "B");

    pb.val(A) = FieldT("1");
    pb.val(B) = FieldT("2");

    TernaryGadget ternaryGadget(pb, b, A, B, "ternaryGadget");
    ternaryGadget.generate_r1cs_constraints();

    SECTION("true")
    {
        pb.val(b) = FieldT("1");
        ternaryGadget.generate_r1cs_witness();

        REQUIRE(pb.is_satisfied());
        REQUIRE((pb.val(ternaryGadget.result()) == pb.val(A)));
    }

    SECTION("false")
    {
        pb.val(b) = FieldT("0");
        ternaryGadget.generate_r1cs_witness();

        REQUIRE(pb.is_satisfied());
        REQUIRE((pb.val(ternaryGadget.result()) == pb.val(B)));
    }

    SECTION("non-boolean")
    {
        pb.val(b) = FieldT("2");
        ternaryGadget.generate_r1cs_witness();

        REQUIRE(!pb.is_satisfied());
    }
}

TEST_CASE("AND", "[AndGadget]")
{
    unsigned int maxNumInputs = 64;
    unsigned int numIterations = 128;
    for (unsigned int n = 2; n < maxNumInputs; n++) {
        DYNAMIC_SECTION("Num inputs: " << n)
    {
        for (unsigned int j = 0; j < numIterations; j++)
        {
            protoboard<FieldT> pb;
            std::vector<VariableT> inputs;
            for (unsigned int i = 0; i < n; i++)
            {
                // Bias to 1s the more inputs there are, otherwise the result is almost always 0
                inputs.emplace_back(make_variable(pb, (rand() % n == 0) ? 0 : 1, "i"));
            }

            AndGadget andGadget(pb, inputs, "andGadget");
            andGadget.generate_r1cs_constraints();
            andGadget.generate_r1cs_witness();

            bool expectedResult = true;
            for (unsigned int i = 0; i < n; i++)
            {
                expectedResult &= pb.val(inputs[i]) == FieldT::one() ? true : false;
            }
            FieldT exepectedValue = expectedResult ? 1 : 0;

            REQUIRE(pb.is_satisfied());
            REQUIRE((pb.val(andGadget.result()) == exepectedValue));
        }
    }}
}

TEST_CASE("OR", "[OrGadget]")
{
    unsigned int maxNumInputs = 64;
    unsigned int numIterations = 128;
    for (unsigned int n = 2; n < maxNumInputs; n++) {
        DYNAMIC_SECTION("Num inputs: " << n)
    {
        for (unsigned int j = 0; j < numIterations; j++)
        {
            protoboard<FieldT> pb;
            std::vector<VariableT> inputs;
            for (unsigned int i = 0; i < n; i++)
            {
                // Bias to 0s the more inputs there are, otherwise the result is almost always 1
                inputs.emplace_back(make_variable(pb, (rand() % n == 0) ? 1 : 0, "i"));
            }

            OrGadget orGadget(pb, inputs, "orGadget");
            orGadget.generate_r1cs_constraints();
            orGadget.generate_r1cs_witness();

            bool expectedResult = false;
            for (unsigned int i = 0; i < n; i++)
            {
                expectedResult |= pb.val(inputs[i]) == FieldT::one() ? true : false;
            }
            FieldT exepectedValue = expectedResult ? 1 : 0;

            REQUIRE(pb.is_satisfied());
            REQUIRE((pb.val(orGadget.result()) == exepectedValue));
        }
    }}
}

TEST_CASE("NOT", "[NotGadget]")
{
    protoboard<FieldT> pb;

    pb_variable<FieldT> b;
    b.allocate(pb, "b");

    NotGadget notGadget(pb, b, "notGadget");
    notGadget.generate_r1cs_constraints();

    SECTION("true")
    {
        pb.val(b) = FieldT("1");
        notGadget.generate_r1cs_witness();

        REQUIRE(pb.is_satisfied());
        REQUIRE((pb.val(notGadget.result()) == FieldT::zero()));
    }

    SECTION("false")
    {
        pb.val(b) = FieldT("0");
        notGadget.generate_r1cs_witness();

        REQUIRE(pb.is_satisfied());
        REQUIRE((pb.val(notGadget.result()) == FieldT::one()));
    }
}

TEST_CASE("XOR array", "[XorArrayGadget]")
{
    unsigned int maxNumInputs = 128;
    unsigned int numIterations = 16;
    for (unsigned int n = 1; n < maxNumInputs; n++) {
        DYNAMIC_SECTION("Num inputs: " << n)
    {
        for (unsigned int j = 0; j < numIterations; j++)
        {
            protoboard<FieldT> pb;
            VariableArrayT A = make_var_array(pb, n, ".A");
            VariableArrayT B = make_var_array(pb, n, ".A");
            for (unsigned int i = 0; i < n; i++)
            {
                pb.val(A[i]) = rand() % 2;
                pb.val(B[i]) = rand() % 2;
            }

            XorArrayGadget xorArrayGadget(pb, A, B, "xorArrayGadget");
            xorArrayGadget.generate_r1cs_constraints();
            xorArrayGadget.generate_r1cs_witness();

            VariableArrayT expectedResult = make_var_array(pb, n, ".expectedResult");
            for (unsigned int i = 0; i < n; i++)
            {
                pb.val(expectedResult[i]) = pb.val(A[i]).as_bigint().as_ulong() ^ pb.val(B[i]).as_bigint().as_ulong();
                REQUIRE((pb.val(xorArrayGadget.result()[i]) == pb.val(expectedResult[i])));
            }

            REQUIRE(pb.is_satisfied());
        }
    }}
}

TEST_CASE("Equal", "[EqualGadget]")
{
    unsigned int numIterations = 128;

    auto equalChecked = [](const FieldT& _A, const FieldT& _B)
    {
        protoboard<FieldT> pb;

        pb_variable<FieldT> a = make_variable(pb, _A, ".A");
        pb_variable<FieldT> b = make_variable(pb, _B, ".B");

        EqualGadget equalGadget(pb, a, b, "equalGadget");
        equalGadget.generate_r1cs_constraints();
        equalGadget.generate_r1cs_witness();

        FieldT expectedResult = (_A == _B) ? FieldT::one() : FieldT::zero();
        REQUIRE(pb.is_satisfied());
        REQUIRE((pb.val(equalGadget.result()) == expectedResult));
    };

    FieldT max = getMaxFieldElement();

    SECTION("0 == 0")
    {
        equalChecked(0, 0);
    }

    SECTION("max == max")
    {
        equalChecked(max, max);
    }

    SECTION("random == random")
    {
        for (unsigned int i = 0; i < numIterations; i++)
        {
            FieldT r = getRandomFieldElement();
            equalChecked(r, r);
        }
    }

    SECTION("random")
    {
        for (unsigned int i = 0; i < numIterations; i++)
        {
            equalChecked(getRandomFieldElement(), getRandomFieldElement());
        }
    }
}

TEST_CASE("RequireEqual", "[RequireEqualGadget]")
{
    unsigned int numIterations = 128;

    auto requireEqualChecked = [](const FieldT& _A, const FieldT& _B)
    {
        protoboard<FieldT> pb;

        pb_variable<FieldT> a = make_variable(pb, _A, ".A");
        pb_variable<FieldT> b = make_variable(pb, _B, ".B");

        RequireEqualGadget requireEqualGadget(pb, a, b, "requireEqualGadget");
        requireEqualGadget.generate_r1cs_constraints();
        requireEqualGadget.generate_r1cs_witness();

        bool expectedSatisfied = (_A == _B);
        REQUIRE(pb.is_satisfied() == expectedSatisfied);
    };

    FieldT max = getMaxFieldElement();

    SECTION("0 == 0")
    {
        requireEqualChecked(0, 0);
    }

    SECTION("max == max")
    {
        requireEqualChecked(max, max);
    }

    SECTION("random == random")
    {
        for (unsigned int i = 0; i < numIterations; i++)
        {
            FieldT r = getRandomFieldElement();
            requireEqualChecked(r, r);
        }
    }

    SECTION("random")
    {
        for (unsigned int i = 0; i < numIterations; i++)
        {
            requireEqualChecked(getRandomFieldElement(), getRandomFieldElement());
        }
    }
}

TEST_CASE("RequireZeroAorB", "[RequireZeroAorBGadget]")
{
    unsigned int numIterations = 128;

    auto requireZeroAorBChecked = [](const FieldT& _A, const FieldT& _B)
    {
        protoboard<FieldT> pb;

        pb_variable<FieldT> a = make_variable(pb, _A, ".A");
        pb_variable<FieldT> b = make_variable(pb, _B, ".B");

        RequireZeroAorBGadget requireZeroAorBGadget(pb, a, b, "requireZeroAorBGadget");
        requireZeroAorBGadget.generate_r1cs_constraints();
        requireZeroAorBGadget.generate_r1cs_witness();

        bool expectedSatisfied = (_A == 0) || (_B == 0);
        REQUIRE(pb.is_satisfied() == expectedSatisfied);
    };

    SECTION("0 || 0")
    {
        requireZeroAorBChecked(0, 0);
    }

    SECTION("0 || random")
    {
        for (unsigned int i = 0; i < numIterations; i++)
        {
            requireZeroAorBChecked(0, getRandomFieldElement());
        }
    }

    SECTION("random || 0")
    {
        for (unsigned int i = 0; i < numIterations; i++)
        {
            requireZeroAorBChecked(getRandomFieldElement(), 0);
        }
    }

    SECTION("random || random")
    {
        for (unsigned int i = 0; i < numIterations; i++)
        {
            requireZeroAorBChecked(getRandomFieldElement(), getRandomFieldElement());
        }
    }
}

TEST_CASE("RequireNotZero", "[RequireNotZeroGadget]")
{
    unsigned int numIterations = 256;

    protoboard<FieldT> pb;

    pb_variable<FieldT> a = make_variable(pb, ".a");

    RequireNotZeroGadget requireNotZeroGadget(pb, a, "requireNotZeroGadget");
    requireNotZeroGadget.generate_r1cs_constraints();

    SECTION("0")
    {
        pb.val(a) = 0;
        requireNotZeroGadget.generate_r1cs_witness();

        REQUIRE(!pb.is_satisfied());
    }

    SECTION("non-zero")
    {
        for (unsigned int i = 0; i < numIterations; i++)
        {
            pb.val(a) = getRandomFieldElement();
            while(pb.val(a) == 0)
            {
                pb.val(a) = getRandomFieldElement();
            }
            requireNotZeroGadget.generate_r1cs_witness();

            REQUIRE(pb.is_satisfied());
        }
    }
}

TEST_CASE("IsNonZero", "[IsNonZero]")
{
    unsigned int numIterations = 1024;

    protoboard<FieldT> pb;

    pb_variable<FieldT> a = make_variable(pb, ".a");

    IsNonZero isNonZero(pb, a, "isNonZero");
    isNonZero.generate_r1cs_constraints();

    SECTION("0")
    {
        pb.val(a) = 0;
        isNonZero.generate_r1cs_witness();

        REQUIRE(pb.is_satisfied());
        REQUIRE((pb.val(isNonZero.result()) == FieldT::zero()));
    }

    SECTION("non-zero")
    {
        for (unsigned int i = 0; i < numIterations; i++)
        {
            pb.val(a) = getRandomFieldElement();
            while(pb.val(a) == 0)
            {
                pb.val(a) = getRandomFieldElement();
            }
            isNonZero.generate_r1cs_witness();

            REQUIRE(pb.is_satisfied());
            REQUIRE((pb.val(isNonZero.result()) == FieldT::one()));
        }
    }
}

TEST_CASE("RequireNotEqual", "[RequireNotEqualGadget]")
{
    unsigned int maxLength = 254;
    unsigned int numIterations = 8;
    for (unsigned int n = 1; n <= maxLength; n++) {
        DYNAMIC_SECTION("Bit-length: " << n)
    {
        auto requireNotEqualChecked = [n](const FieldT& _A, const FieldT& _B)
        {
            protoboard<FieldT> pb;

            pb_variable<FieldT> a = make_variable(pb, _A, ".A");
            pb_variable<FieldT> b = make_variable(pb, _B, ".B");

            RequireNotEqualGadget requireNotEqualGadget(pb, a, b, "requireNotEqualGadget");
            requireNotEqualGadget.generate_r1cs_constraints();
            requireNotEqualGadget.generate_r1cs_witness();

            bool expectedSatisfied = (_A != _B);
            REQUIRE(pb.is_satisfied() == expectedSatisfied);
        };

        FieldT max = getMaxFieldElement(n);

        SECTION("0 != 0")
        {
            requireNotEqualChecked(0, 0);
        }

        SECTION("max != max")
        {
            requireNotEqualChecked(max, max);
        }

        SECTION("Random value")
        {
            FieldT r = getRandomFieldElement(n);
            requireNotEqualChecked(r, r);
        }

        SECTION("0 != max")
        {
            requireNotEqualChecked(0, max);
        }

        SECTION("max != 0")
        {
            requireNotEqualChecked(max, 0);
        }

        SECTION("Random")
        {
            for (unsigned int j = 0; j < numIterations; j++)
            {
                requireNotEqualChecked(getRandomFieldElement(n), getRandomFieldElement(n));
            }
        }
    }}
}

TEST_CASE("Min", "[MinGadget]")
{
    unsigned int maxLength = 252;
    unsigned int numIterations = 8;
    for (unsigned int n = 1; n <= maxLength; n++) {
        DYNAMIC_SECTION("Bit-length: " << n)
    {
        auto requireLeqChecked = [n](const BigInt& _A, const BigInt& _B)
        {
            protoboard<FieldT> pb;

            pb_variable<FieldT> a = make_variable(pb, toFieldElement(_A), ".A");
            pb_variable<FieldT> b = make_variable(pb, toFieldElement(_B), ".B");

            MinGadget minGadget(pb, a, b, n, "minGadget");
            minGadget.generate_r1cs_constraints();
            minGadget.generate_r1cs_witness();

            BigInt expectedResult = (_A < _B) ? _A : _B;
            REQUIRE(pb.is_satisfied());
            REQUIRE((pb.val(minGadget.result()) == toFieldElement(expectedResult)));
        };

        BigInt max = getMaxFieldElementAsBigInt(n);

        SECTION("min(0, 0)")
        {
            requireLeqChecked(0, 0);
        }

        SECTION("min(1, 0)")
        {
            requireLeqChecked(1, 0);
        }

        SECTION("min(0, 1)")
        {
            requireLeqChecked(0, 1);
        }

        SECTION("min(max, max)")
        {
            requireLeqChecked(max, max);
        }

        SECTION("min(max - 1, max)")
        {
            requireLeqChecked(max - 1, max);
        }

        SECTION("min(max, max - 1)")
        {
            requireLeqChecked(max, max - 1);
        }

        SECTION("min(0, max)")
        {
            requireLeqChecked(0, max);
        }

        SECTION("min(max, 0)")
        {
            requireLeqChecked(max, 0);
        }

        SECTION("Random")
        {
            requireLeqChecked(getRandomFieldElementAsBigInt(n), getRandomFieldElementAsBigInt(n));
        }
    }}
}

TEST_CASE("Leq", "[LeqGadget]")
{
    unsigned int maxLength = 252;
    unsigned int numIterations = 8;
    for (unsigned int n = 1; n <= maxLength; n++) {
        DYNAMIC_SECTION("Bit-length: " << n)
    {
        auto leqChecked = [n](const BigInt& _A, const BigInt& _B)
        {
            protoboard<FieldT> pb;

            pb_variable<FieldT> a = make_variable(pb, toFieldElement(_A), ".A");
            pb_variable<FieldT> b = make_variable(pb, toFieldElement(_B), ".B");

            LeqGadget leqGadget(pb, a, b, n, "leqGadget");
            leqGadget.generate_r1cs_constraints();
            leqGadget.generate_r1cs_witness();

            bool expectedLt = _A < _B;
            bool expectedLeq = _A <= _B;
            REQUIRE(pb.is_satisfied());
            REQUIRE((pb.val(leqGadget.lt()) == (expectedLt ? FieldT::one() : FieldT::zero())));
            REQUIRE((pb.val(leqGadget.leq()) == (expectedLeq ? FieldT::one() : FieldT::zero())));
        };

        BigInt max = getMaxFieldElementAsBigInt(n);

        SECTION("0 <(=) 0")
        {
            leqChecked(0, 0);
        }

        SECTION("0 <(=) 1")
        {
            leqChecked(0, 1);
        }

        SECTION("max <(=) max")
        {
            leqChecked(max, max);
        }

        SECTION("max - 1 <(=) max")
        {
            leqChecked(max - 1, max);
        }

        SECTION("max <(=) max - 1")
        {
            leqChecked(max, max - 1);
        }

        SECTION("0 <(=) max")
        {
            leqChecked(0, max);
        }

        SECTION("max <(=) 0")
        {
            leqChecked(max, 0);
        }

        SECTION("Random")
        {
            for (unsigned int j = 0; j < numIterations; j++)
            {
                leqChecked(getRandomFieldElementAsBigInt(n), getRandomFieldElementAsBigInt(n));
            }
        }
    }}
}

TEST_CASE("RequireLeq", "[RequireLeqGadget]")
{
    unsigned int maxLength = 252;
    unsigned int numIterations = 8;
    for (unsigned int n = 1; n <= maxLength; n++) {
        DYNAMIC_SECTION("Bit-length: " << n)
    {
        auto requireLeqChecked = [n](const BigInt& _A, const BigInt& _B)
        {
            protoboard<FieldT> pb;

            pb_variable<FieldT> a = make_variable(pb, toFieldElement(_A), ".A");
            pb_variable<FieldT> b = make_variable(pb, toFieldElement(_B), ".B");

            RequireLeqGadget requireLeqGadget(pb, a, b, n, "requireLeqGadget");
            requireLeqGadget.generate_r1cs_constraints();
            requireLeqGadget.generate_r1cs_witness();

            bool expectedSatisfied = _A <= _B;
            REQUIRE(pb.is_satisfied() == expectedSatisfied);
        };

        BigInt max = getMaxFieldElementAsBigInt(n);

        SECTION("0 <= 0")
        {
            requireLeqChecked(0, 0);
        }

        SECTION("0 <= 1")
        {
            requireLeqChecked(0, 1);
        }

        SECTION("max <= max")
        {
            requireLeqChecked(max, max);
        }

        SECTION("max - 1 <= max")
        {
            requireLeqChecked(max - 1, max);
        }

        SECTION("max <= max - 1")
        {
            requireLeqChecked(max, max - 1);
        }

        SECTION("0 <= max")
        {
            requireLeqChecked(0, max);
        }

        SECTION("max <= 0")
        {
            requireLeqChecked(max, 0);
        }

        SECTION("Random")
        {
            for (unsigned int j = 0; j < numIterations; j++)
            {
                requireLeqChecked(getRandomFieldElementAsBigInt(n), getRandomFieldElementAsBigInt(n));
            }
        }
    }}
}

TEST_CASE("RequireLt", "[RequireLtGadget]")
{
    unsigned int maxLength = 252;
    unsigned int numIterations = 8;
    for (unsigned int n = 1; n <= maxLength; n++) {
        DYNAMIC_SECTION("Bit-length: " << n)
    {
        auto requireLtChecked = [n](const BigInt& _A, const BigInt& _B)
        {
            protoboard<FieldT> pb;

            pb_variable<FieldT> a = make_variable(pb, toFieldElement(_A), ".A");
            pb_variable<FieldT> b = make_variable(pb, toFieldElement(_B), ".B");

            RequireLtGadget requireLtGadget(pb, a, b, n, "requireLtGadget");
            requireLtGadget.generate_r1cs_constraints();
            requireLtGadget.generate_r1cs_witness();

            bool expectedSatisfied = _A < _B;
            REQUIRE(pb.is_satisfied() == expectedSatisfied);
        };

        BigInt max = getMaxFieldElementAsBigInt(n);

        SECTION("0 < 0")
        {
            requireLtChecked(0, 0);
        }

        SECTION("max < max")
        {
            requireLtChecked(max, max);
        }

        SECTION("0 < max")
        {
            requireLtChecked(0, max);
        }

        SECTION("max < 0")
        {
            requireLtChecked(max, 0);
        }

        SECTION("Random")
        {
            for (unsigned int j = 0; j < numIterations; j++)
            {
                requireLtChecked(getRandomFieldElementAsBigInt(n), getRandomFieldElementAsBigInt(n));
            }
        }
    }}
}

TEST_CASE("MulDiv", "[MulDivGadget]")
{
    unsigned int maxLength = 253/2;
    unsigned int numIterations = 8;
    for (unsigned int n = 1; n <= maxLength; n++) {
        DYNAMIC_SECTION("Bit-length: " << n)
    {
        auto mulDivChecked = [n](const BigInt& _value, const BigInt& _numerator, const BigInt& _denominator,
                                 bool expectedSatisfied, bool bModifyRemainder = false)
        {
            protoboard<FieldT> pb;

            pb_variable<FieldT> value = make_variable(pb, toFieldElement(_value), "value");
            pb_variable<FieldT> numerator = make_variable(pb, toFieldElement(_numerator), "numerator");
            pb_variable<FieldT> denominator = make_variable(pb, toFieldElement(_denominator), "denominator");

            Constants constants(pb, "constants");
            MulDivGadget mulDivGadget(pb, constants, value, numerator, denominator, n, n, n, "mulDivGadget");
            mulDivGadget.generate_r1cs_constraints();
            mulDivGadget.generate_r1cs_witness();

            if (bModifyRemainder)
            {
                pb.val(mulDivGadget.remainder.packed) += pb.val(denominator);
                mulDivGadget.remainder.generate_r1cs_witness_from_packed();
                pb.val(mulDivGadget.quotient) -= FieldT::one();
            }

            REQUIRE(pb.is_satisfied() == expectedSatisfied);
            if (expectedSatisfied)
            {
                BigInt product = _value * _numerator;
                BigInt remainder = product % _denominator;
                BigInt result = product / _denominator;

                REQUIRE((pb.val(mulDivGadget.result()) == toFieldElement(result)));
                REQUIRE((pb.val(mulDivGadget.getRemainder()) == toFieldElement(remainder)));
                REQUIRE((pb.val(mulDivGadget.getProduct()) == toFieldElement(product)));
            }
        };

        BigInt max = getMaxFieldElementAsBigInt(n);

        SECTION("Divide by zero")
        {
            for (unsigned int j = 0; j < numIterations; j++)
            {
                mulDivChecked(getRandomFieldElementAsBigInt(n), getRandomFieldElementAsBigInt(n), 0, false);
            }
        }

        SECTION("0 * 0 / 1 = 0")
        {
             mulDivChecked(0, 0, 1, true);
        }

        SECTION("1 * 1 / 1 = 1")
        {
             mulDivChecked(1, 1, 1, true);
        }

        SECTION("max * max / max = max")
        {
             mulDivChecked(max, max, max, true);
        }

        SECTION("max * max / 1 = max * max")
        {
             mulDivChecked(max, max, 1, true);
        }

        SECTION("remainder >= C")
        {
             mulDivChecked(max, max, max, false, true);
        }

        SECTION("Random")
        {
            for (unsigned int j = 0; j < numIterations; j++)
            {
                BigInt denominator = getRandomFieldElementAsBigInt(n);
                while (denominator == 0)
                {
                    denominator = getRandomFieldElementAsBigInt(n);
                }
                mulDivChecked(getRandomFieldElementAsBigInt(n), getRandomFieldElementAsBigInt(n), denominator, true);
            }
        }
    }}
}

TEST_CASE("UnsafeAdd", "[UnsafeAddGadget]")
{
    unsigned int numIterations = 256;

    protoboard<FieldT> pb;

    pb_variable<FieldT> a = make_variable(pb, ".a");
    pb_variable<FieldT> b = make_variable(pb, ".b");

    UnsafeAddGadget unsafeAddGadget(pb, a, b, "unsafeAddGadget");
    unsafeAddGadget.generate_r1cs_constraints();

    SECTION("Random")
    {
        for (unsigned int j = 0; j < numIterations; j++)
        {
            pb.val(a) = getRandomFieldElement();
            pb.val(b) = getRandomFieldElement();
            unsafeAddGadget.generate_r1cs_witness();

            REQUIRE(pb.is_satisfied());
            REQUIRE((pb.val(unsafeAddGadget.result()) == pb.val(a) + pb.val(b)));
        }
    }
}

TEST_CASE("UnsafeSub", "[UnsafeSubGadget]")
{
    unsigned int numIterations = 256;

    protoboard<FieldT> pb;

    pb_variable<FieldT> a = make_variable(pb, ".a");
    pb_variable<FieldT> b = make_variable(pb, ".b");

    UnsafeSubGadget unsafeSubGadget(pb, a, b, "unsafeSubGadget");
    unsafeSubGadget.generate_r1cs_constraints();

    SECTION("Random")
    {
        for (unsigned int j = 0; j < numIterations; j++)
        {
            pb.val(a) = getRandomFieldElement();
            pb.val(b) = getRandomFieldElement();
            unsafeSubGadget.generate_r1cs_witness();

            REQUIRE(pb.is_satisfied());
            REQUIRE((pb.val(unsafeSubGadget.result()) == pb.val(a) - pb.val(b)));
        }
    }
}

TEST_CASE("UnsafeMul", "[UnsafeMulGadget]")
{
    unsigned int numIterations = 256;

    protoboard<FieldT> pb;

    pb_variable<FieldT> a = make_variable(pb, ".a");
    pb_variable<FieldT> b = make_variable(pb, ".b");

    UnsafeMulGadget unsafeMulGadget(pb, a, b, "unsafeMulGadget");
    unsafeMulGadget.generate_r1cs_constraints();

    SECTION("Random")
    {
        for (unsigned int j = 0; j < numIterations; j++)
        {
            pb.val(a) = getRandomFieldElement();
            pb.val(b) = getRandomFieldElement();
            unsafeMulGadget.generate_r1cs_witness();

            REQUIRE(pb.is_satisfied());
            REQUIRE((pb.val(unsafeMulGadget.result()) == pb.val(a) * pb.val(b)));
        }
    }
}

TEST_CASE("Add", "[AddGadget]")
{
    unsigned int maxLength = 252;
    for (unsigned int n = 1; n <= maxLength; n++) {
        DYNAMIC_SECTION("Bit-length: " << n)
    {
        auto addChecked = [n](const BigInt& _A, const BigInt& _B)
        {
            protoboard<FieldT> pb;

            pb_variable<FieldT> A = make_variable(pb, toFieldElement(_A), "A");
            pb_variable<FieldT> B = make_variable(pb, toFieldElement(_B), "B");

            AddGadget addGadget(pb, A, B, n, "addGadget");
            addGadget.generate_r1cs_constraints();
            addGadget.generate_r1cs_witness();

            BigInt sum = _A + _B;
            bool expectedSatisfied = (sum <= getMaxFieldElementAsBigInt(n));

            REQUIRE(pb.is_satisfied() == expectedSatisfied);
            if (expectedSatisfied)
            {
                REQUIRE(((pb.val(addGadget.result())) == toFieldElement(sum)));
            }
        };

        BigInt max = getMaxFieldElementAsBigInt(n);
        BigInt halfMax = getMaxFieldElementAsBigInt(n - 1);

        SECTION("0 + 0")
        {
            addChecked(0, 0);
        }

        SECTION("0 + 1")
        {
            addChecked(0, 1);
        }

        SECTION("max + 0")
        {
            addChecked(max, 0);
        }

        SECTION("halfMax + halfMax + 1")
        {
            addChecked(halfMax, halfMax + 1);
        }

        SECTION("max + 1 (overflow)")
        {
            addChecked(max, 1);
        }

        SECTION("max + max (overflow)")
        {
            addChecked(max, max);
        }

        SECTION("halfMax + halfMax + 2 (overflow)")
        {
            addChecked(halfMax, halfMax + 2);
        }
    }}
}

TEST_CASE("subadd", "[subadd_gadget]")
{
    unsigned int maxLength = 252;
    for (unsigned int n = 1; n <= maxLength; n++) {
        DYNAMIC_SECTION("Bit-length: " << n)
    {
        auto subaddChecked = [n](const FieldT& _from, const FieldT& _to, const FieldT& _amount,
                                 bool expectedSatisfied, const FieldT& expectedFromAfter = 0, const FieldT& expectedToAfter = 0)
        {
            protoboard<FieldT> pb;

            pb_variable<FieldT> from = make_variable(pb, _from, "from");
            pb_variable<FieldT> to = make_variable(pb, _to, "to");
            pb_variable<FieldT> amount = make_variable(pb, _amount, "amount");

            subadd_gadget subAddGadget(pb, n, from, to, amount, "subAddGadget");
            subAddGadget.generate_r1cs_constraints();
            subAddGadget.generate_r1cs_witness();

            REQUIRE(pb.is_satisfied() == expectedSatisfied);
            if (expectedSatisfied)
            {
                REQUIRE(((pb.val(subAddGadget.X)) == expectedFromAfter));
                REQUIRE(((pb.val(subAddGadget.Y)) == expectedToAfter));
            }
        };

        FieldT max = getMaxFieldElement(n);
        FieldT halfMax = getMaxFieldElement(n - 1);

        SECTION("(0, 0) -+ 0")
        {
            subaddChecked(0, 0, 0, true, 0, 0);
        }

        SECTION("(1, 0) -+ 1")
        {
            subaddChecked(1, 0, 1, true, 0, 1);
        }

        SECTION("(max, 0) -+ 0")
        {
            subaddChecked(max, 0, 0, true, max, 0);
        }

        SECTION("(max, 0) -+ max")
        {
            subaddChecked(max, 0, max, true, 0, max);
        }

        SECTION("(halfMax, halfMax + 1) -+ halfMax")
        {
            subaddChecked(halfMax, halfMax + 1, halfMax, true, 0, max);
        }

        SECTION("(max, max) -+ max  (overflow)")
        {
            subaddChecked(max, max, max, false);
        }

        SECTION("(halfMax, halfMax + 2) -+ halfMax  (overflow)")
        {
            subaddChecked(halfMax, halfMax + 2, halfMax, false);
        }

        SECTION("(halfMax - 1, halfMax + 1) -+ halfMax (underflow)")
        {
            subaddChecked(halfMax - 1, halfMax + 1, halfMax, false);
        }

        SECTION("(0, 0) -+ 1 (underflow)")
        {
            subaddChecked(0, 0, 1, false);
        }

        SECTION("(0, 0) -+ max (underflow)")
        {
            subaddChecked(0, 0, max, false);
        }

        SECTION("(max - 1, 0) -+ max  (underflow)")
        {
            subaddChecked(max - 1, 0, max, false);
        }

        SECTION("(max, 1) -+ max  (overflow)")
        {
            subaddChecked(max, 1, max, false);
        }
    }}
}

TEST_CASE("Range limit", "[dual_variable_gadget]")
{
    unsigned int maxLength = 254;
    unsigned int numIterations = 16;
    for (unsigned int n = 1; n <= maxLength; n++) {
        DYNAMIC_SECTION("Bit-length: " << n)
    {
        auto rangeLimitChecked = [n](const FieldT& v, bool expectedSatisfied)
        {
            protoboard<FieldT> pb;

            pb_variable<FieldT> value = make_variable(pb, "value");
            libsnark::dual_variable_gadget<FieldT> rangeLimitedValue(pb, value, n, "dual_variable_gadget");
            rangeLimitedValue.generate_r1cs_constraints(true);

            pb.val(value) = v;
            rangeLimitedValue.generate_r1cs_witness_from_packed();

            REQUIRE(pb.is_satisfied() == expectedSatisfied);
            if (expectedSatisfied)
            {
                REQUIRE((pb.val(rangeLimitedValue.packed) == pb.val(value)));
                REQUIRE(compareBits(rangeLimitedValue.bits.get_bits(pb), toBits(pb.val(value), n)));
            }
        };

        SECTION("0")
        {
            rangeLimitChecked(0, true);
        }

        SECTION("1")
        {
            rangeLimitChecked(0, true);
        }

        SECTION("max")
        {
            rangeLimitChecked(getMaxFieldElement(n), true);
        }

        SECTION("max + 1")
        {
            // max + 1 == 0 if n == 254
            if (n < 254)
            {
                rangeLimitChecked(getMaxFieldElement(n) + 1, false);
            }
        }

        SECTION("max + 1 + max (1 bit too many, LSB the same as max)")
        {
            // We need to be able to set all bits to 1s
            if (n < 253)
            {
                rangeLimitChecked(getMaxFieldElement(n) * 2 + 1, false);
            }
        }

        SECTION("max snark field element")
        {
            // max snark field element == max field element when n == 254
            if (n < 254)
            {
                rangeLimitChecked(getMaxFieldElement(), false);
            }
        }

        SECTION("random value in range")
        {
            for (unsigned int j = 0; j < numIterations; j++)
            {
                rangeLimitChecked(getRandomFieldElement(n), true);
            }
        }
    }}
}
