#include <string>
#include <chrono>

#define NDEBUG 1

#include <prover_reference_functions.hpp>

#include "multiexp/reduce.cu"

extern void run_preprocess(const char *params_path, const char *preprocess_path);
// This is where all the FFTs happen

// template over the bundle of types and functions.
// Overwrites ca!
template <typename B>
typename B::vector_Fr *compute_H(size_t d, typename B::vector_Fr *ca,
                                 typename B::vector_Fr *cb,
                                 typename B::vector_Fr *cc) {
  auto domain = B::get_evaluation_domain(d + 1 + 1);

  B::domain_iFFT(domain, ca);
  B::domain_iFFT(domain, cb);

  size_t m = B::domain_get_m(domain);
  typename B::vector_Fr *coefficients_for_H = B::vector_Fr_zeros(m + 1);

  /* add coefficients of the polynomial (d2*A + d1*B - d3) + d1*d2*Z */
  B::domain_mul_add_sub(coefficients_for_H, ca, cb, m);
  B::domain_add_poly_Z(domain, coefficients_for_H);

  B::domain_cosetFFT(domain, ca);
  B::domain_cosetFFT(domain, cb);

  // Use ca to store H
  auto H_tmp = ca;

  // for i in 0 to m: H_tmp[i] = ca[i] * cb[i]
  B::vector_Fr_muleq(H_tmp, ca, cb, m);

  B::domain_iFFT(domain, cc);
  B::domain_cosetFFT(domain, cc);

  // for i in 0 to m: H_tmp[i] -= cc[i]
  B::vector_Fr_subeq(H_tmp, cc, m);

  B::domain_divide_by_Z_on_coset(domain, H_tmp);

  B::domain_icosetFFT(domain, H_tmp);

  // coefficients_for_H[i] += H_tmp[i];
  B::vector_Fr_add(coefficients_for_H, coefficients_for_H, H_tmp, m);

  return coefficients_for_H;
}

static size_t read_size_t(FILE* input) {
  size_t n;
  size_t readSize = fread((void *) &n, sizeof(size_t), 1, input);
  if (readSize != 1) {
    fprintf(stderr, "fread error");
    abort();
  }
  return n;
}

template< typename B >
struct ec_type;

template<>
struct ec_type<alt_bn128_libsnark> {
    typedef ECp_ALT_BN128 ECp;
    typedef ECp2_ALT_BN128 ECpe;
};


void
check_trailing(FILE *f, const char *name) {
    long bytes_remaining = 0;
    while (fgetc(f) != EOF)
        ++bytes_remaining;
    if (bytes_remaining > 0)
        fprintf(stderr, "!! Trailing characters in \"%s\": %ld\n", name, bytes_remaining);
}


static inline auto now() -> decltype(std::chrono::high_resolution_clock::now()) {
    return std::chrono::high_resolution_clock::now();
}

template<typename T>
void
print_time(T &t1, const char *str) {
    auto t2 = std::chrono::high_resolution_clock::now();
    auto tim = std::chrono::duration_cast<std::chrono::milliseconds>(t2 - t1).count();
    printf("%s: %ld ms\n", str, tim);
    t1 = t2;
}

template <typename B>
void run_prover(
        const char *params_path,
        const char *input_path,
        const char *output_path,
        const char *preprocessed_path)
{
    B::init_public_params();

    size_t primary_input_size = 1;

    auto beginning = now();
    auto t = beginning;

    FILE *params_file = fopen(params_path, "r");
    size_t d = read_size_t(params_file);
    size_t orig_d = read_size_t(params_file);
    size_t m = read_size_t(params_file);
    rewind(params_file);

    printf("d = %zu, orig_d = %zu, m = %zu\n", d, orig_d, m);

    typedef typename ec_type<B>::ECp ECp;
    typedef typename ec_type<B>::ECpe ECpe;

    typedef typename B::G1 G1;
    typedef typename B::G2 G2;

    static constexpr int R = 32;
    static constexpr int C = 4;
    FILE *preprocessed_file = fopen(preprocessed_path, "r");

    size_t space = ((m + 1) + R - 1) / R;
    size_t space_H = ((d) + R - 1) / R;

    auto A_mults = load_points_affine<ECp>(((1U << C) - 1)*(m + 1), preprocessed_file);
    auto out_A = allocate_memory(space * ECp::NELTS * ELT_BYTES);

    auto B1_mults = load_points_affine<ECp>(((1U << C) - 1)*(m + 1), preprocessed_file);
    auto out_B1 = allocate_memory(space * ECp::NELTS * ELT_BYTES);

    auto B2_mults = load_points_affine<ECpe>(((1U << C) - 1)*(m + 1), preprocessed_file);
    auto out_B2 = allocate_memory(space * ECpe::NELTS * ELT_BYTES);

    auto L_mults = load_points_affine<ECp>(((1U << C) - 1)*(m - 1), preprocessed_file);
    auto out_L = allocate_memory(space * ECp::NELTS * ELT_BYTES);

    auto H_mults = load_points_affine<ECp>(((1U << C) - 1)*(d), preprocessed_file);
    auto out_H = allocate_memory(space_H * ECp::NELTS * ELT_BYTES);

    fclose(preprocessed_file);

    print_time(t, "load preprocessing");

    auto params = B::read_params(params_file, d, m);
    fclose(params_file);
    print_time(t, "load params");

    auto t_main = t;

    FILE *inputs_file = fopen(input_path, "r");
    auto w_ = load_scalars(m + 1, inputs_file);
    rewind(inputs_file);
    auto inputs = B::read_input(inputs_file, d, orig_d + 1, m);
    fclose(inputs_file);
    print_time(t, "load inputs");

    const var *w = w_.get();

    auto t_gpu = t;

    cudaStream_t sA, sB1, sB2, sL, sH;

    ec_reduce_straus<ECp, C, R>(sA, out_A.get(), A_mults.get(), w, m + 1);
    ec_reduce_straus<ECp, C, R>(sB1, out_B1.get(), B1_mults.get(), w, m + 1);
    ec_reduce_straus<ECpe, C, 2*R>(sB2, out_B2.get(), B2_mults.get(), w, m + 1);
    ec_reduce_straus<ECp, C, R>(sL, out_L.get(), L_mults.get(), w + (primary_input_size + 1) * ELT_LIMBS, m - 1);
    print_time(t, "gpu launch");

    //G1 *evaluation_At = B::multiexp_G1(B::input_w(inputs), B::params_A(params), m + 1);
    //G1 *evaluation_Bt1 = B::multiexp_G1(B::input_w(inputs), B::params_B1(params), m + 1);
    //G2 *evaluation_Bt2 = B::multiexp_G2(B::input_w(inputs), B::params_B2(params), m + 1);

    // Do calculations relating to H on CPU after having set the GPU in
    // motion
    auto coefficients_for_H =
        compute_H<B>(orig_d, B::input_ca(inputs), B::input_cb(inputs), B::input_cc(inputs));
    print_time(t, "coefficients_for_H");

    auto H_coeff_mem = allocate_memory(d * ELT_BYTES);
    B::coefficients_for_H_to_mem(coefficients_for_H, (uint8_t *)H_coeff_mem.get(), ELT_BYTES, d);
    print_time(t, "coefficients_H_mem");
#if 0
    auto H = B::params_H(params);
    G1 *evaluation_Ht = B::multiexp_G1(coefficients_for_H, H, d);
    B::delete_vector_G1(H);
    print_time(t, "evaluation_Ht");
#else
    ec_reduce_straus<ECp, C, R>(sH, out_H.get(), H_mults.get(), H_coeff_mem.get(), d);
#endif

    print_time(t, "cpu 1");

    cudaDeviceSynchronize();
    cudaStreamSynchronize(sA);
    G1 *alpha_g1 = B::alpha_g1(params);
    G1 *evaluation_At = B::read_pt_ECp(out_A.get());
    auto final_At = B::G1_add(alpha_g1, evaluation_At);

    cudaStreamSynchronize(sB1);
    G1 *evaluation_Bt1 = B::read_pt_ECp(out_B1.get());
    auto final_Bt1 = B::G1_add(B::beta_g1(params), evaluation_Bt1);

    cudaStreamSynchronize(sB2);
    G2 *evaluation_Bt2 = B::read_pt_ECpe(out_B2.get());
    auto final_Bt2 = B::G2_add(B::beta_g2(params), evaluation_Bt2);

    cudaStreamSynchronize(sL);
    G1 *evaluation_Lt = B::read_pt_ECp(out_L.get());

    cudaStreamSynchronize(sH);
    G1 *evaluation_Ht = B::read_pt_ECp(out_H.get());

    print_time(t_gpu, "gpu e2e");


    auto scaled_Bt1 = B::G1_scale(B::input_r(inputs), final_Bt1);
    auto Lt1_plus_scaled_Bt1 = B::G1_add(evaluation_Lt, scaled_Bt1);
    auto final_C = B::G1_add(evaluation_Ht, evaluation_Lt);

    print_time(t, "cpu 2");

    B::groth16_output_write(final_At, final_Bt2, final_C, inputs, output_path);

    print_time(t, "store");

    print_time(t_main, "Total time from input to output: ");

    cudaStreamDestroy(sA);
    cudaStreamDestroy(sB1);
    cudaStreamDestroy(sB2);
    cudaStreamDestroy(sL);
    cudaStreamDestroy(sH);

    B::delete_G1(evaluation_At);
    B::delete_G1(evaluation_Bt1);
    B::delete_G2(evaluation_Bt2);
    B::delete_G1(evaluation_Ht);
    B::delete_G1(evaluation_Lt);
    B::delete_G1(scaled_Bt1);
    B::delete_G1(Lt1_plus_scaled_Bt1);
    B::delete_vector_Fr(coefficients_for_H);
    B::delete_groth16_input(inputs);
    B::delete_groth16_params(params);

    print_time(t, "cleanup");
    print_time(beginning, "Total runtime (incl. file reads)");
}

int main(int argc, char **argv) {
  printf("main start\n");
  setbuf(stdout, NULL);
  std::string mode(argv[1]);

  const char *params_path = argv[2];

  if (mode == "compute") {
      const char *input_path = argv[3];
      const char *preprocess_path = argv[4];
      const char *output_path = argv[5];
      run_prover<alt_bn128_libsnark>(params_path, input_path, output_path, preprocess_path);
  } else if (mode == "preprocess") {
        const char *preprocess_path = argv[3];
        run_preprocess(params_path, preprocess_path);
  }

  return 0;
}
