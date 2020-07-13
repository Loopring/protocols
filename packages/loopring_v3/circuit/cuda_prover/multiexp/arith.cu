#pragma once

#include "fixnum.cu"

__device__ __constant__
const var ALPHA_VALUE[BIG_WIDTH] = {
    //0x3c208c16d87cfd46ULL, 0x97816a916871ca8dULL,
    //0xb85045b68181585dULL, 0x30644e72e131a029ULL
    0x68c3488912edefaaULL, 0x8d087f6872aabf4fULL,
    0x51e1a24709081231ULL, 0x2259d6b14729c0faULL
};

__device__ __constant__
const var MOD_Q[BIG_WIDTH] = {
    0x3c208c16d87cfd47ULL, 0x97816a916871ca8dULL,
    0xb85045b68181585dULL, 0x30644e72e131a029ULL
};

// -Q^{-1} (mod 2^64)
static constexpr var Q_NINV_MOD = 0x87d20782e4866389ULL;

// 2^256 mod Q
__device__ __constant__
const var X_MOD_Q[BIG_WIDTH] = {
    0xd35d438dc58f0d9dULL, 0xa78eb28f5c70b3dULL,
    0x666ea36f7879462cULL, 0xe0a77c19a07df2fULL
};

//template< const var *mod_, const var ninv_mod_, const var *binpow_mod_ >
//struct modulus_info {
struct ALT_BN128_MOD {
    __device__ __forceinline__ static int lane() { return fixnum::layout().thread_rank(); }
    __device__ __forceinline__ static var mod() { return MOD_Q[lane()]; }
    static constexpr var ninv_mod = Q_NINV_MOD;
    __device__ __forceinline__ static var monty_one() { return X_MOD_Q[lane()]; }
};

__device__ __constant__
const var MOD_R[BIG_WIDTH] = {
    0x43e1f593f0000001ULL, 0x2833e84879b97091ULL,
    0xb85045b68181585dULL, 0x30644e72e131a029ULL
};

// -R^{-1} (mod 2^64)
static constexpr var R_NINV_MOD = 0xc2e1f593efffffffULL;

// 2^256 mod R
__device__ __constant__
const var X_MOD_R[BIG_WIDTH] = {
    0xac96341c4ffffffbULL, 0x36fc76959f60cd29ULL,
    0x666ea36f7879462eULL, 0xe0a77c19a07df2fULL
};

//template< const var *mod_, const var ninv_mod_, const var *binpow_mod_ >
//struct modulus_info {
struct ALT_BN128_MOD_R {
    __device__ __forceinline__ static int lane() { return fixnum::layout().thread_rank(); }
    __device__ __forceinline__ static var mod() { return MOD_R[lane()]; }
    static constexpr var ninv_mod = R_NINV_MOD;
    __device__ __forceinline__ static var monty_one() { return X_MOD_R[lane()]; }
};
// Apparently we still can't do partial specialisation of function
// templates in C++, so we do it in a class instead. Woot.
template< int n >
struct mul_ {
    template< typename G >
    __device__ static void x(G &z, const G &x);
};

template<>
template< typename G >
__device__ void
mul_<2>::x(G &z, const G &x) {
    // TODO: Shift by one bit
    G::add(z, x, x);
}

template<>
template< typename G >
__device__ void
mul_<4>::x(G &z, const G &x) {
    // TODO: Shift by two bits
    mul_<2>::x(z, x);  // z = 2x
    mul_<2>::x(z, z);  // z = 4x
}

template<>
template< typename G >
__device__ void
mul_<8>::x(G &z, const G &x) {
    // TODO: Shift by three bits
    mul_<4>::x(z, x);  // z = 4x
    mul_<2>::x(z, z);  // z = 8x
}

template<>
template< typename G >
__device__ void
mul_<16>::x(G &z, const G &x) {
    // TODO: Shift by four bits
    mul_<8>::x(z, x);  // z = 8x
    mul_<2>::x(z, z);  // z = 16x
}

template<>
template< typename G >
__device__ void
mul_<32>::x(G &z, const G &x) {
    // TODO: Shift by five bits
    mul_<16>::x(z, x); // z = 16x
    mul_<2>::x(z, z);  // z = 32x
}

template<>
template< typename G >
__device__ void
mul_<64>::x(G &z, const G &x) {
    // TODO: Shift by six bits
    mul_<32>::x(z, x); // z = 32x
    mul_<2>::x(z, z);  // z = 64x
}

template<>
template< typename G >
__device__ void
mul_<3>::x(G &z, const G &x) {
    G t;
    mul_<2>::x(t, x);
    G::add(z, t, x);
}

template<>
template< typename G >
__device__ void
mul_<11>::x(G &z, const G &x) {
    // TODO: Do this without carry/overflow checks
    // TODO: Check that this is indeed optimal
    // 11 = 8 + 2 + 1
    G t;
    mul_<2>::x(t, x);  // t = 2x
    G::add(z, t, x);   // z = 3x
    mul_<4>::x(t, t);  // t = 8x
    G::add(z, z, t);   // z = 11x
}

template<>
template< typename G >
__device__ void
mul_<13>::x(G &z, const G &x) {
    // 13 = 8 + 4 + 1
    G t;
    mul_<4>::x(t, x);  // t = 4x
    G::add(z, t, x);   // z = 5x
    mul_<2>::x(t, t);  // t = 8x
    G::add(z, z, t);   // z = 13x
}

template<>
template< typename G >
__device__ void
mul_<26>::x(G &z, const G &x) {
    // 26 = 16 + 8 + 2
    G t;
    mul_<2>::x(z, x); // z = 2x
    mul_<4>::x(t, z); // t = 8x
    G::add(z, z, t);  // z = 10x
    mul_<2>::x(t, t); // t = 16x
    G::add(z, z, t);  // z = 26x
}

template<>
template< typename G >
__device__ void
mul_<121>::x(G &z, const G &x) {
    // 121 = 64 + 32 + 16 + 8 + 1
    G t;
    mul_<8>::x(t, x); // t = 8x
    G::add(z, t, x);  // z = 9x
    mul_<2>::x(t, t); // t = 16x
    G::add(z, z, t);  // z = 25x
    mul_<2>::x(t, t); // t = 32x
    G::add(z, z, t);  // z = 57x
    mul_<2>::x(t, t); // t = 64x
    G::add(z, z, t);  // z = 121x
}

template< typename modulus_info >
struct Fp {
    typedef Fp PrimeField;

    var a;

    static constexpr int DEGREE = 1;

    __device__
    static void
    load(Fp &x, const var *mem) {
        int t = fixnum::layout().thread_rank();
        x.a = (t < ELT_LIMBS) ? mem[t] : 0UL;
    }

    __device__
    static void
    load_alpha(Fp &x) {
        int t = fixnum::layout().thread_rank();
        x.a = (t < ELT_LIMBS) ? ALPHA_VALUE[t] : 0UL;
    }

    __device__
    static void
    store(var *mem, const Fp &x) {
        int t = fixnum::layout().thread_rank();
        if (t < ELT_LIMBS)
            mem[t] = x.a;
    }

    __device__
    static int
    are_equal(const Fp &x, const Fp &y) { return fixnum::cmp(x.a, y.a) == 0; }

    __device__
    static void
    set_zero(Fp &x) { x.a = fixnum::zero(); }

    __device__
    static int
    is_zero(const Fp &x) { return fixnum::is_zero(x.a); }

    __device__
    static void
    set_one(Fp &x) { x.a = modulus_info::monty_one(); }

    __device__
    static void
    add(Fp &zz, const Fp &xx, const Fp &yy) {
        int br;
        var x = xx.a, y = yy.a, z, r;
        var mod = modulus_info::mod();
        fixnum::add(z, x, y);
        fixnum::sub_br(r, br, z, mod);
        zz.a = br ? z : r;
    }

    __device__
    static void
    neg(Fp &z, const Fp &x) {
        var mod = modulus_info::mod();
        fixnum::sub(z.a, mod, x.a);
    }

    __device__
    static void
    sub(Fp &z, const Fp &x, const Fp &y) {
        int br;
        var r, mod = modulus_info::mod();
        fixnum::sub_br(r, br, x.a, y.a);
        if (br)
            fixnum::add(r, r, mod);
        z.a = r;
    }

    __device__
    static void
    mul(Fp &zz, const Fp &xx, const Fp &yy) {
        auto grp = fixnum::layout();
        int L = grp.thread_rank();
        var mod = modulus_info::mod();

        var x = xx.a, y = yy.a, z = digit::zero();
        var tmp;
        digit::mul_lo(tmp, x, modulus_info::ninv_mod);
        digit::mul_lo(tmp, tmp, grp.shfl(y, 0));
        int cy = 0;

        for (int i = 0; i < ELT_LIMBS; ++i) {
            var u;
            var xi = grp.shfl(x, i);
            var z0 = grp.shfl(z, 0);
            var tmpi = grp.shfl(tmp, i);

            digit::mad_lo(u, z0, modulus_info::ninv_mod, tmpi);
            digit::mad_lo_cy(z, cy, mod, u, z);
            digit::mad_lo_cy(z, cy, y, xi, z);

            assert(L || z == 0);  // z[0] must be 0
            z = grp.shfl_down(z, 1); // Shift right one word
            z = (L >= ELT_LIMBS - 1) ? 0 : z;

            digit::add_cy(z, cy, z, cy);
            digit::mad_hi_cy(z, cy, mod, u, z);
            digit::mad_hi_cy(z, cy, y, xi, z);
        }
        // Resolve carries
        int msb = grp.shfl(cy, ELT_LIMBS - 1);
        cy = grp.shfl_up(cy, 1); // left shift by 1
        cy = (L == 0) ? 0 : cy;

        fixnum::add_cy(z, cy, z, cy);
        msb += cy;
        assert(msb == !!msb); // msb = 0 or 1.

        // br = 0 ==> z >= mod
        var r;
        int br;
        fixnum::sub_br(r, br, z, mod);
        if (msb || br == 0) {
            // If the msb was set, then we must have had to borrow.
            assert(!msb || msb == br);
            z = r;
        }
        zz.a = z;
    }

    __device__
    static void
    sqr(Fp &z, const Fp &x) {
        // TODO: Find a faster way to do this. Actually only option
        // might be full squaring with REDC.
        mul(z, x, x);
    }

#if 0
    __device__
    static void
    inv(Fp &z, const Fp &x) {
        // FIXME: Implement!  See HEHCC Algorithm 11.12.
        z = x;
    }
#endif

    __device__
    static void
    from_monty(Fp &y, const Fp &x) {
        Fp one;
        one.a = fixnum::one();
        mul(y, x, one);
    }
};



// Reference for multiplication and squaring methods below:
// https://pdfs.semanticscholar.org/3e01/de88d7428076b2547b60072088507d881bf1.pdf

template< typename Fp, int ALPHA >
struct Fp2 {
    typedef Fp PrimeField;

    // TODO: Use __builtin_align__(8) or whatever they use for the
    // builtin vector types.
    Fp a0, a1;

    static constexpr int DEGREE = 2;

    __device__
    static void
    load(Fp2 &x, const var *mem) {
        Fp::load(x.a0, mem);
        Fp::load(x.a1, mem + ELT_LIMBS);
    }

    __device__
    static void
    store(var *mem, const Fp2 &x) {
        Fp::store(mem, x.a0);
        Fp::store(mem + ELT_LIMBS, x.a1);
    }

    __device__
    static int
    are_equal(const Fp2 &x, const Fp2 &y) {
        return Fp::are_equal(x.a0, y.a0) && Fp::are_equal(x.a1, y.a1);
    }

    __device__
    static void
    set_zero(Fp2 &x) { Fp::set_zero(x.a0); Fp::set_zero(x.a1); }

    __device__
    static int
    is_zero(const Fp2 &x) { return Fp::is_zero(x.a0) && Fp::is_zero(x.a1); }

    __device__
    static void
    set_one(Fp2 &x) { Fp::set_one(x.a0); Fp::set_zero(x.a1); }

    __device__
    static void
    add(Fp2 &s, const Fp2 &x, const Fp2 &y) {
        Fp::add(s.a0, x.a0, y.a0);
        Fp::add(s.a1, x.a1, y.a1);
    }

    __device__
    static void
    sub(Fp2 &s, const Fp2 &x, const Fp2 &y) {
        Fp::sub(s.a0, x.a0, y.a0);
        Fp::sub(s.a1, x.a1, y.a1);
    }

    __device__
    static void
    mul(Fp2 &p, const Fp2 &a, const Fp2 &b) {
        Fp a0_b0, a1_b1, a0_plus_a1, b0_plus_b1, c, t0, t1;
        Fp xx;

        Fp::mul(a0_b0, a.a0, b.a0);
        Fp::mul(a1_b1, a.a1, b.a1);

        Fp::add(a0_plus_a1, a.a0, a.a1);
        Fp::add(b0_plus_b1, b.a0, b.a1);
        Fp::mul(c, a0_plus_a1, b0_plus_b1);

        //mul_<ALPHA>::x(t0, a1_b1);
        Fp::load_alpha(xx);
        Fp::mul(t0, xx, a1_b1);
        Fp::sub(t1, c, a0_b0);

        Fp::add(p.a0, a0_b0, t0);
        Fp::sub(p.a1, t1, a1_b1);
    }


    __device__
    static void
    sqr(Fp2 &s, const Fp2 &a) {
        Fp a0_a1, a0_plus_a1, a0_plus_13_a1, t0, t1, t2;
        Fp xx;

        Fp::mul(a0_a1, a.a0, a.a1);
        Fp::add(a0_plus_a1, a.a0, a.a1);
        //mul_<ALPHA>::x(t0, a.a1);
        Fp::load_alpha(xx);
        Fp::mul(t0, xx, a.a1);
        Fp::add(a0_plus_13_a1, a.a0, t0);
        Fp::mul(t0, a0_plus_a1, a0_plus_13_a1);
        // TODO: Could do mul_14 to save a sub?
        Fp::sub(t1, t0, a0_a1);
        //mul_<ALPHA>::x(t2, a0_a1);
        Fp::load_alpha(xx);
        Fp::mul(t2, xx, a0_a1);
        Fp::sub(s.a0, t1, t2);
        mul_<2>::x(s.a1, a0_a1);
    }
};

typedef Fp<ALT_BN128_MOD> Fp_ALT_BN128;
typedef Fp2<Fp_ALT_BN128, 13> Fp2_ALT_BN128;

typedef Fp<ALT_BN128_MOD_R> Fp_ALT_BN128_R;
typedef Fp2<Fp_ALT_BN128_R, 11> Fp2_ALT_BN128_R;
