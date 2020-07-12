#pragma once

#include "arith.cu"

// All algorithms from
// https://www.hyperelliptic.org/EFD/g1p/auto-shortw-jacobian.html#addition-add-2007-bl
template< typename FF, int CRV_A, typename Grp >
struct ec_jac {
    typedef FF field_type;

    // NB: This is corresponds to the group of rational points for
    // curves over prime field; it is a lie for curves over extension
    // fields.
    typedef Grp group_type;

    // TODO: See if using Chudnovsky coordinates improves things much
    // (ie. store Z^2 and Z^3 as well)
    FF x, y, z;

    static constexpr int NELTS = 3 * FF::DEGREE; // *3 for x, y and z

    __device__
    static void
    load_affine(ec_jac &P, const var *mem) {
        FF::load(P.x, mem);
        FF::load(P.y, mem + FF::DEGREE * ELT_LIMBS);
        FF::set_one(P.z);

        // FIXME: This is an odd convention, but that's how they do it.
        if (FF::is_zero(P.x))
            set_zero(P);
    }

    __device__
    static void
    load_jac(ec_jac &P, const var *mem) {
        FF::load(P.x, mem);
        FF::load(P.y, mem + FF::DEGREE * ELT_LIMBS);
        FF::load(P.z, mem + 2 * FF::DEGREE * ELT_LIMBS);
    }

    __device__
    static int
    is_affine(const ec_jac &P) {
        FF one;
        FF::set_one(one);
        return FF::are_equal(P.z, one);
    }

    __device__
    static int
    are_equal(const ec_jac &P, const ec_jac &Q) {
        FF zPzP, zPzPzP, zQzQ, zQzQzQ;

        FF::sqr(zPzP, P.z);
        FF::sqr(zQzQ, Q.z);

        FF t0, t1;
        FF::mul(t0, P.x, zQzQ);
        FF::mul(t1, Q.x, zPzP);

        if ( ! FF::are_equal(t0, t1))
            return 0;

        // x-coordinates are equal; now check the y-coordinates.

        FF::mul(zPzPzP, zPzP, P.z);
        FF::mul(zQzQzQ, zQzQ, Q.z);
        FF::mul(t0, P.y, zQzQzQ);
        FF::mul(t1, Q.y, zPzPzP);

        return FF::are_equal(t0, t1);
    }

#if 0
    __device__
    static void
    store_affine(var *mem, const ec_jac &P) {
        FF z_inv, z2_inv, z3_inv, aff_x, aff_y;

        // NB: Very expensive!
        // TODO: Consider (i) doing this on the host and (ii) implementing
        // simultaneous inversion.
        FF::inv(z inv, P.z);
        FF::sqr(z2_inv, z_inv);
        FF::mul(z3_inv, z2_inv, z_inv);

        FF::mul(aff_x, P.x, z2_inv);
        FF::store(mem, aff_x);

        FF::mul(aff_y, P.y, z3_inv);
        FF::store(mem + FF::DEGREE * ELT_LIMBS, aff_y);
    }
#endif

    __device__
    static void
    store_jac(int t, var *mem, const ec_jac &P) {
#if 0
        printf("t %d store_jac\n", t);
        printf("t %d P.x %llx\n", t, P.x);
        printf("t %d P.y %llx\n", t, P.y);
        printf("t %d P.z %llx\n", t, P.z);
#endif
        FF::store(mem, P.x);
        FF::store(mem + FF::DEGREE * ELT_LIMBS, P.y);
        FF::store(mem + 2 * FF::DEGREE * ELT_LIMBS, P.z);
    }

    __device__
    static void
    set_zero(ec_jac &P) {
#if 0
        FF::set_one(P.x);
        FF::set_one(P.y);
        FF::set_zero(P.z);
#else
        FF::set_zero(P.x);
        FF::set_one(P.y);
        FF::set_zero(P.z);
#endif
    }

    __device__
    static int
    is_zero(const ec_jac &P) { return FF::is_zero(P.z); }

#if 0
    // TODO: Needs double-checking
    __device__
    static void
    mixed_dbl(ec_jac &R, const ec_jac &P) {
        FF xx, yy, yyyy, s, m, t, t0, t1;

        FF::sqr(xx, P.x);      // XX = X1^2
        FF::sqr(yy, P.y);      // YY = Y1^2
        FF::sqr(yyyy, yy);     // YYYY = YY^2
        FF::add(s, P.x, yy);   // t0 = X1+YY
        FF::sqr(s, s);         // t1 = t0^2
        FF::sub(s, s, xx);     // t2 = t1-XX
        FF::sub(s, s, yyyy);   // t3 = t2-YYYY
        mul_<2>::x(s);         // S = 2*t3
        mul_<3>::x(m, xx);     // t4 = 3*XX

        // FIXME: Won't work
        FF::add(m, m, CRV_A);  // M = t4+a

        FF::sqr(t, m);         // t5 = M^2
        mul_<2>::x(t0, s);     // t6 = 2*S
        FF::sub(t, t, t0);     // T = t5-t6
        R.x = t;               // X3 = T
        mul_<2>::x(R.z, P.y);  // Z3 = 2*Y1
        FF::sub(t0, s, t);     // t7 = S-T
        mul_<8>::x(t1, yyyy);  // t8 = 8*YYYY
        FF::mul(R.y, m, t0);   // t9 = M*t7
        FF::sub(R.y, R.y, t1); // Y3 = t9-t8
    }
#endif

    __device__
    static void
    mixed_add(int t, ec_jac &R, const ec_jac &P, const ec_jac &Q) {
#if 0
        printf("t %d mixed add\n", t);
        printf("t %d P.x a0 %llx\n", t, P.x.a0);
        printf("t %d P.x a1 %llx\n", t, P.x.a1);
        printf("t %d P.y a0 %llx\n", t, P.y.a0);
        printf("t %d P.y a1 %llx\n", t, P.y.a1);
        printf("t %d P.z a0 %llx\n", t, P.z.a0);
        printf("t %d P.z a1 %llx\n", t, P.z.a1);
        printf("t %d Q.x a0 %llx\n", t, Q.x.a0);
        printf("t %d Q.x a1 %llx\n", t, Q.x.a1);
        printf("t %d Q.y a0 %llx\n", t, Q.y.a0);
        printf("t %d Q.y a1 %llx\n", t, Q.y.a1);
        printf("t %d Q.z a0 %llx\n", t, Q.z.a0);
        printf("t %d Q.z a1 %llx\n", t, Q.z.a1);
#endif
        // Would be better to know that Q != 0
        if (is_zero(Q)) {
            R = P;
            return;
        } else if (is_zero(P)) {
            R = Q;
            return;
        }
        assert(is_affine(Q));

        FF t0, t1;
#if 0
        FF z1z1, u2, s2, h, hh, i, j, r, v;

        FF::sqr(z1z1, P.z);     // Z1Z1 = Z1^2
        FF::mul(u2, Q.x, z1z1); // U2 = X2*Z1Z1
        FF::mul(s2, Q.y, P.z);
        FF::mul(s2, s2, z1z1);  // S2 = Y2*Z1*Z1Z1
        if (FF::are_equal(u2, P.x) && FF::are_equal(s2, P.y)) {
            // P == Q
            //mixed_dbl(R, Q);
            dbl(R, Q);
            return;
        }
        FF::sub(h, u2, P.x);    // H = U2-X1
        FF::sqr(hh, h);         // HH = H^2
        mul_<4>::x(i, hh);      // I = 4*HH
        FF::mul(j, h, i);       // J = H*I
        FF::sub(r, s2, P.y);    // t1 = S2-Y1
        mul_<2>::x(r, r);       // r = 2*t1
        FF::mul(v, P.x, i);     // V = X1*I

        FF::sqr(t0, r);         // t2 = r^2
        mul_<2>::x(t1, v);      // t3 = 2*V
        FF::sub(t0, t0, j);     // t4 = t2-J
        FF::sub(R.x, t0, t1);   // X3 = t4-t3

        FF::sub(t0, v, R.x);    // t5 = V-X3
        FF::mul(t1, P.y, j);    // t6 = Y1*J
        mul_<2>::x(t1, t1);     // t7 = 2*t6
        FF::mul(t0, r, t0);     // t8 = r*t5
        FF::sub(R.y, t0, t1);   // Y3 = t8-t7

        FF::add(t0, P.z, h);    // t9 = Z1+H
        FF::sqr(t0, t0);        // t10 = t9^2
        FF::sub(t0, t0, z1z1);  // t11 = t10-Z1Z1
        FF::sub(R.z, t0, hh);   // Z3 = t11-HH
#endif
#if 1
        FF Z1Z1, U2, Z1_cubed, S2;
        FF::sqr(Z1Z1, P.z);
        FF::mul(U2, Q.x, Z1Z1);
        FF::mul(Z1_cubed, P.z, Z1Z1);
        FF::mul(S2, Q.y, Z1_cubed);

        if (FF::are_equal(P.x, U2) && FF::are_equal(P.y, S2))
        {
            dbl(t, R, Q);
            return;
        }

        FF H, HH, I, J, r, V;


        FF::sub(H, U2, P.x);
        FF::sqr(HH, H);
        mul_<4>::x(I, HH);

        FF::mul(J, H, I);
        FF::sub(t0, S2, P.y);
        mul_<2>::x(r, t0);
        FF::mul(V, P.x, I);

        FF::sqr(t0, r);
        FF::sub(t1, t0, J);
        FF::sub(t0, t1, V);
        FF::sub(R.x, t0, V);

        FF t2;
        FF::sub(t0, V, R.x);
        FF::mul(t1, r, t0);
        FF::mul(t0, P.y, J);
        mul_<2>::x(t2, t0);
        FF::sub(R.y, t1, t2);

        FF::add(t0, R.z, H);
        FF::sqr(t1, t0);
        FF::sub(t0, t1, Z1Z1);
        FF::sub(R.z, t0, HH);
#endif
#if 0
        printf("t %d mixed add result\n", t);
        printf("t %d R.x a0 %llx\n", t, R.x.a0);
        printf("t %d R.x a1 %llx\n", t, R.x.a1);
        printf("t %d R.y a0 %llx\n", t, R.y.a0);
        printf("t %d R.y a1 %llx\n", t, R.y.a1);
        printf("t %d R.z a0 %llx\n", t, R.z.a0);
        printf("t %d R.z a1 %llx\n", t, R.z.a1);
#endif
    }

    // NB: This is not valid if P = Q or if P == 0 or Q == 0
    __device__
    static void
    add_unsafe(int t, ec_jac &R, const ec_jac &P, const ec_jac &Q) {
#if 0
        printf("t %d add unsafe\n", t);
        printf("t %d P.x a0 %llx\n", t, P.x.a0);
        printf("t %d P.x a1 %llx\n", t, P.x.a1);
        printf("t %d P.y a0 %llx\n", t, P.y.a0);
        printf("t %d P.y a1 %llx\n", t, P.y.a1);
        printf("t %d P.z a0 %llx\n", t, P.z.a0);
        printf("t %d P.z a1 %llx\n", t, P.z.a1);
        printf("t %d Q.x a0 %llx\n", t, Q.x.a0);
        printf("t %d Q.x a1 %llx\n", t, Q.x.a1);
        printf("t %d Q.y a0 %llx\n", t, Q.y.a0);
        printf("t %d Q.y a1 %llx\n", t, Q.y.a1);
        printf("t %d Q.z a0 %llx\n", t, Q.z.a0);
        printf("t %d Q.z a1 %llx\n", t, Q.z.a1);
#endif
#if 0
        printf("t %d unsafe add\n", t);
        printf("t %d P.x %llx\n", t, P.x);
        printf("t %d P.y %llx\n", t, P.y);
        printf("t %d P.z %llx\n", t, P.z);
        printf("t %d Q.x %llx\n", t, Q.x);
        printf("t %d Q.y %llx\n", t, Q.y);
        printf("t %d Q.z %llx\n", t, Q.z);
#endif
        FF t0, t1;
#if 0
        FF z1z1, z2z2, u1, u2, s1, s2, h, i, j, r, v;

        FF::sqr(z1z1, P.z); // Z1Z1 = Z1^2
        FF::sqr(z2z2, Q.z); // Z2Z2 = Z2^2
        FF::mul(u1, P.x, z2z2); // U1 = X1*Z2Z2
        FF::mul(u2, Q.x, z1z1); // U2 = X2*Z1Z1
        FF::mul(s1, P.y, Q.z);
        FF::mul(s1, s1, z2z2); // S1 = Y1*Z2*Z2Z2
        FF::mul(s2, Q.y, P.z);
        FF::mul(s2, s2, z1z1); // S2 = Y2*Z1*Z1Z1
        FF::sub(h, u2, u1); // H = U2-U1
        mul_<2>::x(i, h);
        FF::sqr(i, i); // I = (2*H)^2
        FF::mul(j, h, i); // J = H*I
        FF::sub(r, s2, s1);
        mul_<2>::x(r, r); // r = 2*(S2-S1)
        FF::mul(v, u1, i); // V = U1*I

        // X3 = r^2-J-2*V
        FF::sqr(t0, r);
        FF::sub(t0, t0, j);
        mul_<2>::x(t1, v);
        FF::sub(R.x, t0, t1);

        // Y3 = r*(V-X3)-2*S1*J
        FF::sub(t0, v, R.x);
        FF::mul(t0, r, t0);
        FF::mul(t1, s1, j);
        mul_<2>::x(t1, t1);
        FF::sub(R.y, t0, t1);

        // Z3 = ((Z1+Z2)^2-Z1Z1-Z2Z2)*H
        FF::add(t0, P.z, Q.z);
        FF::sqr(t0, t0);
        FF::add(t1, z1z1, z2z2);
        FF::sub(t0, t0, t1);
        FF::mul(R.z, t0, h);
#else
        FF Z1Z1, Z2Z2, U1, U2, Z1_cubed, Z2_cubed, S1, S2;

        FF::sqr(Z1Z1, P.z);
        FF::sqr(Z2Z2, Q.z);

        FF::mul(U1, P.x, Z2Z2);
        FF::mul(U2, Q.x, Z1Z1);

        FF::mul(Z1_cubed, P.z, Z1Z1);
        FF::mul(Z2_cubed, Q.z, Z2Z2);

        FF::mul(S1, P.y, Z2_cubed);
        FF::mul(S2, Q.y, Z1_cubed);

        if (FF::are_equal(U1, U2) && FF::are_equal(S1, S2))
        {
            dbl(t, R, Q);
            return;
        }

        FF H, S2_minus_S1, I, J, r, V, S1_J;

        FF::sub(H, U2, U1);
        FF::sub(S2_minus_S1, S2, S1);
        FF::add(t0, H, H);
        FF::sqr(I, t0);
        FF::mul(J, H, I);
        FF::add(r, S2_minus_S1, S2_minus_S1);
        FF::mul(V, U1, I);

        FF::sqr(t0, r);
        FF::sub(t1, t0, J);
        FF::sub(t0, t1, V);
        FF::sub(R.x, t0, V);

        FF::mul(S1_J, S1, J);
        FF::sub(t0, V, R.x);
        FF::mul(t1, r, t0);
        mul_<2>::x(t0, S1_J);
        FF::sub(R.y, t1, t0);

        FF::add(t0, P.z, Q.z);
        FF::sqr(t1, t0);
        FF::sub(t0, t1, Z1Z1);
        FF::sub(t1, t0, Z2Z2);
        FF::mul(R.z, t1, H);
#if 0
        printf("t %d unsafe add result\n", t);
        printf("t %d R.x %llx\n", t, R.x);
        printf("t %d R.y %llx\n", t, R.y);
        printf("t %d R.z %llx\n", t, R.z);
#endif
#if 0
        printf("t %d unsafe add result\n", t);
        printf("t %d R.x a0 %llx\n", t, R.x.a0);
        printf("t %d R.x a1 %llx\n", t, R.x.a1);
        printf("t %d R.y a0 %llx\n", t, R.y.a0);
        printf("t %d R.y a1 %llx\n", t, R.y.a1);
        printf("t %d R.z a0 %llx\n", t, R.z.a0);
        printf("t %d R.z a1 %llx\n", t, R.z.a1);
#endif
#endif
    }

    __device__
    static void
    add(int t, ec_jac &R, const ec_jac &P, const ec_jac &Q) {
        // TODO: It should be the caller's responsibility to check if
        // the operands are zero
        // Need P != 0 and Q != 0 for computation below to work
        if (is_zero(P)) {
            R = Q;
            return;
        } else if (is_zero(Q)) {
            R = P;
            return;
        }

        // need to save P (or Q) just in case &R = &P and we need to
        // double P after the add.
        ec_jac PP = P;
        add_unsafe(t, R, P, Q);

        // If P = Q, then add returns all zeros.
        if (FF::is_zero(R.x) && FF::is_zero(R.y) && FF::is_zero(R.z)) {
            dbl(t, R, PP);
        }
    }

    __device__
    static void
    dbl(int t, ec_jac &R, const ec_jac &P) {
        FF t0, t1;

#if 0
        printf("t %d dbl\n", t);
        printf("t %d P.x a0 %llx\n", t, P.x.a0);
        printf("t %d P.x a1 %llx\n", t, P.x.a1);
        printf("t %d P.y a0 %llx\n", t, P.y.a0);
        printf("t %d P.y a1 %llx\n", t, P.y.a1);
        printf("t %d P.z a0 %llx\n", t, P.z.a0);
        printf("t %d P.z a1 %llx\n", t, P.z.a1);
#endif
#if 0
        printf("t %d dbl\n", t);
        printf("T %d P.x %llx\n", t, P.x);
        printf("T %d P.y %llx\n", t, P.y);
        printf("T %d P.z %llx\n", t, P.z);
#endif
#ifndef NDEBUG
        // TODO: It should be the caller's responsibility to check if
        // the operand is zero
        // Need P != 0 for computation below to work.
        if (is_zero(P)) {
            set_zero(R);
            return;
        }
#endif

#if 0
        FF xx, yy, yyyy, zz, s, m, t;
        FF::sqr(xx, P.x); // XX = X1^2
        FF::sqr(yy, P.y); // YY = Y1^2
        FF::sqr(yyyy, yy); // YYYY = YY^2
        FF::sqr(zz, P.z); // ZZ = Z1^2
        FF::add(t0, P.x, yy);
        FF::sqr(t0, t0);
        FF::add(t1, xx, yyyy);
        FF::sub(t0, t0, t1);
        mul_<2>::x(s, t0); // S = 2*((X1+YY)^2-XX-YYYY)
        mul_<3>::x(t0, xx);
        FF::sqr(t1, zz);
        mul_<CRV_A>::x(t1, t1);
        FF::add(m, t0, t1); // M = 3*XX+a*ZZ^2
        FF::sqr(t0, m);
        mul_<2>::x(t1, s);
        FF::sub(t, t0, t1); // T = M^2-2*S

        // X3 = T
        R.x = t;

        // NB: Need to do Z3 before Y3 in case &R = &P, since we need
        // to use P.y here.
        // Z3 = (Y1+Z1)^2-YY-ZZ
        FF::add(t0, P.y, P.z);
        FF::sqr(t0, t0);
        FF::add(t1, yy, zz);
        FF::sub(R.z, t0, t1);

        // Y3 = M*(S-T)-8*YYYY
        FF::sub(t0, s, t);
        FF::mul(t0, m, t0);
        mul_<8>::x(t1, yyyy);
        FF::sub(R.y, t0, t1);
#else
        FF A, B, C, D, E, F, eightC, Y1Z1;
        FF::sqr(A, P.x);
        FF::sqr(B, P.y);
        FF::sqr(C, B);

        FF::add(t0, P.x, B);
        FF::sqr(t1, t0);
        FF::sub(t0, t1, A);
        FF::sub(t1, t0, C);
        FF::add(D, t1, t1);

        mul_<3>::x(E, A);

        FF::sqr(F, E);

        FF::add(t0, D, D);
        FF::sub(R.x, F, t0);

        FF::mul(Y1Z1, P.y, P.z);
        FF::add(R.z, Y1Z1, Y1Z1);

        mul_<8>::x(eightC, C);
        FF::sub(t0, D, R.x);
        FF::mul(t1, E, t0);
        FF::sub(R.y, t1, eightC);

#endif
#if 0
        printf("t %d dbl result\n", t);
        printf("t %d R.x %llx\n", t, R.x);
        printf("t %d R.y %llx\n", t, R.y);
        printf("t %d R.z %llx\n", t, R.z);
#endif
#if 0
        printf("t %d dbl result\n", t);
        printf("t %d R.x a0 %llx\n", t, R.x.a0);
        printf("t %d R.x a1 %llx\n", t, R.x.a1);
        printf("t %d R.y a0 %llx\n", t, R.y.a0);
        printf("t %d R.y a1 %llx\n", t, R.y.a1);
        printf("t %d R.z a0 %llx\n", t, R.z.a0);
        printf("t %d R.z a1 %llx\n", t, R.z.a1);
#endif
    }

    template< int EXP >
    __device__ __forceinline__
    static void
    mul_2exp(int t, ec_jac &R, const ec_jac &P) {
        dbl(t, R, P);
        #pragma unroll
        for (int k = 1; k < EXP; ++k)
            dbl(t, R, R);
    }

    __device__
    static void
    neg(ec_jac &R, const ec_jac &P) {
        R.x = P.x;
        FF::neg(R.y, P.y);
        R.z = P.z;
    }

    __device__
    static void
    mul(ec_jac &R, const var &n, const ec_jac &P) {
        printf("mul n %d\n", n);
        // TODO: This version makes an effort to prevent intrawarp
        // divergence at a performance cost. This is probably no
        // longer a worthwhile trade-off.

        // TODO: Work out how to use add instead of add_safe.

        static constexpr int WINDOW_SIZE = 4;

        // TODO: I think it is better to use the remainder window
        // first rather than last. When it's last we sometimes miss
        // opportunities to use precomputed values.

        // Window decomposition: digit::BITS = q * WINDOW_SIZE + r.
        static constexpr unsigned WINDOW_REM_BITS = digit::BITS % WINDOW_SIZE;
        static constexpr unsigned WINDOW_MAX = (1U << WINDOW_SIZE);

        static constexpr unsigned WINDOW_MASK = (1U << WINDOW_SIZE) - 1U;
        static constexpr unsigned WINDOW_REM_MASK = (1U << WINDOW_REM_BITS) - 1U;

        if (is_zero(P)) {
            R = P;
            return;
        }

        /* G[t] = [t]P, t >= 0 */
        // TODO: This should be precomputed for all P.
        ec_jac G[WINDOW_MAX];
        set_zero(G[0]);
        G[1] = P;
        dbl(0, G[2], P);
        for (int t = 3; t < WINDOW_MAX; ++t)
            add(G[t], G[t - 1], P);

        auto g = fixnum::layout();

        int digit_idx = fixnum::most_sig_dig(n);
        if (digit_idx < 0) {
            // n == 0
            R = G[0];
            return;
        }

        // First iteration
        var f = g.shfl(n, digit_idx);

        // "Remainder"
        int j = digit::BITS - WINDOW_REM_BITS;
        var win = (f >> j) & WINDOW_REM_MASK;
        R = G[win];
        j -= WINDOW_SIZE;

        for (; j >= 0; j -= WINDOW_SIZE) {
            mul_2exp<WINDOW_SIZE>(0, R, R);
            win = (f >> j) & WINDOW_MASK;
            add(R, R, G[win]);
        }

        --digit_idx;
        for ( ; digit_idx >= 0; --digit_idx) {
            var f = g.shfl(n, digit_idx);
            var win; // TODO: Morally this should be an int

            // "Remainder"
            int j = digit::BITS - WINDOW_REM_BITS;
            mul_2exp<WINDOW_REM_BITS>(0, R, R);
            win = (f >> j) & WINDOW_REM_MASK;
            add(R, R, G[win]);

            j -= WINDOW_SIZE;

            for (; j >= 0; j -= WINDOW_SIZE) {
                mul_2exp<WINDOW_SIZE>(0, R, R);
                win = (f >> j) & WINDOW_MASK;
                add(R, R, G[win]);
            }
        }
    }
};



typedef ec_jac< Fp_ALT_BN128, 2, Fp_ALT_BN128_R > ECp_ALT_BN128;
typedef ec_jac< Fp2_ALT_BN128, 2*13, Fp_ALT_BN128_R > ECp2_ALT_BN128;
