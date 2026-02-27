---
title: "Mixed Precision Training: FP16 → FP8 → DeepSeek-Style Fine-Grained Scaling"
description: "Implemented mixed-precision training in nano-train and studied FP8 quantization theory, from loss scaling basics to DeepSeek-V3's fine-grained tile/block scaling approach"
date: 2026-02-27
tags: ["training", "fp8", "quantization", "deepseek", "nano-train"]
---

## Mixed Precision Training in nano-train

Added mixed-precision training support to nano-train, our distributed LLM training framework. This involved implementing FP8 quantization for compute-intensive GEMM operations while maintaining numerical stability for sensitive operations.

## FP16 vs FP8: The Core Challenge

### Why FP16 Needs Loss Scaling
FP16 has limited representable range:
- Smallest positive normal: ~`6.10e-5`
- Max finite: `65504`

**Problem**: Gradients can underflow to zero in FP16.

**Solution**: Loss scaling multiplies gradients by `S` to prevent underflow, then unscales before optimizer step. Dynamic scaling adjusts `S` during training as gradient magnitudes change.

### Why FP8 Needs Per-Tensor Scaling
FP8 has even tighter constraints than FP16. A single global loss scale is too crude because:
- Different tensors (activations, weights, gradients) have different magnitude distributions
- Outliers can dominate scaling decisions

**Solution**: Per-tensor scaling with metadata:
1. Measure `amax = max(abs(X))`
2. Choose scale `s` so `X*s` fits FP8 range
3. Quantize: `X_fp8 = cast_fp8(X * s)`
4. Store `inv_s = 1/s` as metadata

## Transformer FP8 Precision Map

### FP8 (High Value, Lower Risk)
- Linear GEMMs: QKV projection, attention output, MLP up/gate/down
- Forward GEMM + backward dgrad + wgrad all use FP8 operands

### Keep BF16/FP16 (Numerically Sensitive)
- LayerNorm/RMSNorm: reduction-heavy
- Attention core: QKᵀ, softmax, AV
- Elementwise: residual adds, dropout, activations

### Keep FP32 (Stability-Critical)
- Optimizer state (Adam moments `m, v`)
- Master weights and gradient accumulation

## DeepSeek-V3/R1: Fine-Grained Scaling Innovation

DeepSeek's FP8 training goes beyond per-tensor scaling with **fine-grained scaling**:

### What's Quantized
- **GEMM-heavy paths**: FP8 operands (forward + dgrad + wgrad)
- **Kept higher precision**: embeddings, output head, MoE gating, normalization, attention operators
- **Optimizer moments**: BF16 (not FP32) for memory/comm savings

### Fine-Grained Scaling Granularity

Instead of one scale per entire tensor:

**Activations**: Scale per **1×128 tile**
- For each token, split hidden vector into 128-channel chunks
- Each chunk gets its own `amax` and scale (computed online)
- Outliers only affect small groups, not entire 7168-d vector

**Weights**: Scale per **128×128 block**
- Each block stores scale metadata (`weight_scale_inv` per block)

**Benefits**:
- Reduces clipping risk compared to tensor-wise scaling
- Minimizes quantization noise
- Isolates outliers to small regions

### Serving: Dynamic Activation Quantization
Official DeepSeek checkpoints include FP8 weight quantization metadata:
- Weights stored with block scaling (128×128)
- Serving-time activation quantization is **dynamic** per token per 128 channels

## FP8 Recipes and Scaling Policies

An FP8 "recipe" defines how scales are updated:

**Two modes**:
- **Current scaling**: Compute `amax` and scale immediately from current stats
- **Delayed scaling**: Use `amax` history buffer with policy-based updates

**Key knobs**:
- `fp8_format`: HYBRID (E4M3 forward, E5M2 backward)
- `margin`: Headroom to avoid clipping
- `amax_history_len`: History window for delayed scaling
- `amax_compute_algo`: Max over window vs most recent

**Tuning intuition**:
- **Loss spikes/divergence**: Be more conservative (larger margin, longer history, max-over-history)
- **Stable but worse quality**: Reduce quant noise (smaller margin, more adaptive scaling, finer granularity)

## Key Takeaways

- **FP16 mixed precision** = Global loss scaling + protect optimizer state
- **FP8 mixed precision** = Per-tensor scaling + FP8 GEMMs + protect fragile ops
- **DeepSeek FP8** = Fine-grained scaling (activations: 1×128 tiles, weights: 128×128 blocks) + selective higher precision ops

The evolution shows a clear pattern: as precision decreases, scaling granularity must increase to maintain numerical stability while maximizing throughput benefits.
