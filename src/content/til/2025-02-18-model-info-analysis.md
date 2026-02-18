---
title: "From Simple Model Dump to Comprehensive Roofline Analysis: Evolution of dump_model_info()"
description: "Learned how a simple model architecture dumping function evolved into a comprehensive performance analysis tool with roofline bottleneck detection and optimization guidance"
date: 2025-02-18
tags: ["performance-analysis", "roofline", "model-analysis", "bottleneck-detection", "llm-training"]
---

While building the nano-train project, I created a `dump_model_info()` function that started as a simple model architecture dumper but gradually evolved into a comprehensive performance analysis tool capable of identifying roofline bottlenecks and providing actionable optimization guidance.

## Initial Motivation: Simple Model Architecture Dumping

The function began with a modest goal: **just dump the model architecture**. I wanted to understand:
- Model structure and layers
- Parameter counts per module
- Basic configuration details
- Memory footprint estimates

This was purely for documentation and understanding the models I was working with.

## Evolution: Discovering AI Could Do More

As I worked with the function, I realized that once I had access to the model's computational graph and architecture, I could extract much more valuable information:

### What Became Possible

1. **FLOPs Calculation**: Count theoretical floating-point operations for each phase
   - Training: Full forward + backward passes
   - Prefill: Initial prompt processing
   - Decode: Auto-regressive token generation

2. **Byte Traffic Analysis**: Model memory access patterns
   - Weight streaming (bytes read from HBM for parameters)
   - Activations (input/output tensors for each layer)
   - KV cache (read/write for attention mechanisms)
   - Temporary buffers (intermediate computations)

3. **Roofline Analysis**: Determine performance bottlenecks
   - Arithmetic intensity: FLOPs per byte of memory traffic
   - Ridge point: Where compute-bound becomes memory-bound
   - Regime classification: compute-bound vs HBM-bound vs network-bound

4. **Time Modeling**: Predict step times under different scenarios
   - Compute time: Based on FLOPs and peak compute throughput
   - HBM time: Based on bytes and memory bandwidth
   - Network time: For distributed training/inference
   - Bottleneck identification: Which resource limits performance

5. **Sensitivity Analysis**: Understand what knobs actually matter
   - Batch size effects on throughput
   - Sequence length impacts on prefill/decode
   - KV cache dtype trade-offs
   - MoE routing parameters

## Comprehensive Report Structure

The final `dump_model_info()` generates detailed markdown reports like [deepseek_model_report.md](https://github.com/lastweek/nano-train/blob/main/examples/outputs/model_reports/deepseek_model_report.md) with:

### 1. Architecture Overview
- Model fingerprint (family, attention type, MoE configuration)
- Parameter distribution by module
- Memory requirements breakdown
- Architecture diagrams (Mermaid)

### 2. Analytical Model
- **FLOPs decomposition**: Per-module operation counts
- **Byte accounting**: Weights, activations, KV, temporaries
- **Execution assumptions**: Naive vs efficient kernels (WRF, fusion factors)
- **Time estimation**: `T_est = max(T_comp, T_hbm, T_net)`

### 3. Roofline Analysis
- **Regime classification**: Compute-bound vs memory-bound for each phase
- **Arithmetic intensity**: `AI_hbm = FLOPs / bytes_hbm`
- **Chip ceilings**: Plot points against hardware roofline curves
- **Batch sweeps**: How decode behavior changes with batch size
- **Sequence sweeps**: How prefill behavior changes with prompt length

### 4. Sensitivity Analysis
- **Knob ranking**: Which parameters most affect performance
- **Combinatorial grid**: Full factorial sweep of configuration space
- **Regime transitions**: When bottlenecks shift from compute to memory

### 5. Optimization Guidance
- **Next prioritizations**: What to optimize based on bottleneck analysis
- **Byte dominance tests**: Which memory terms matter most
- **Critical batch sizes**: Where compute-bound transitions occur

## Key Technical Insights

### 1. Separating Theory from Realizable Performance

Critical distinction: `F_theory` (algorithmic FLOPs) vs `F_realizable` (peak-equivalent compute cost after utilization model)

```python
# Theory: pure mathematical operations
F_theory = 2 * M * K * N  # GEMM FLOPs

# Realizable: accounts for tensor core utilization
eta_tc = min(1.0, M_eff / B_sat)  # Utilization factor
F_tensorcore = ...  # Tensor-core-eligible FLOPs
F_realizable = F_tensorcore / eta_tc + (F_theory - F_tensorcore) / eta_scalar
```

**Why it matters**: Tiny-batch decode and thin GEMMs can leave tensor cores under-saturated, so `F_theory` overestimates achievable performance.

### 2. Weight Residency Factor (WRF) Model

Effective streamed weight bytes depend on how many times weights are reused:

```python
W_eff = W / WRF  # Effective streamed bytes
```

Different module families have different reuse patterns:
- **Attention**: `WRF_attn = 4.0` (efficient mode) - weights reused across sequence
- **Dense**: `WRF_dense = 4.0` - reused across batch
- **MoE**: `WRF_moe = 2.0` - less reuse due to routing

**Impact**: Weight traffic can dominate memory bandwidth, especially for large models.

### 3. KV Cache Dominance in Long Context

Decode arithmetic intensity declines with KV length:

```python
# As L → ∞, KV reads dominate
OI_inf_hbm(L) ~ 1/L  # Asymptotic intensity
```

**Implication**: Long-context serving can never become compute-bound if KV cache bytes dominate memory traffic.

### 4. Experts ≠ Runtime Cost

Common fallacy: Parameter share equals runtime cost share.

**Reality from analysis**:
- Experts hold ~97.8% of parameters (DeepSeek-V3)
- But attention/activation terms can dominate runtime
- Weight streaming depends on WRF, not parameter count
- KV cache traffic scales with sequence length, not parameters

### 5. Naive vs Efficient Execution Models

| Aspect | Naive | Efficient |
|--------|-------|-----------|
| Attention | Materializes S×S score/prob matrices | Flash attention (no S×S HBM traffic) |
| Activation fusion | No fusion | Fused kernels reduce HBM trips |
| Elementwise ops | Full temporaries | Reduced temporary buffers |
| WRF | 1.0 (no reuse) | 2-4× (weight reuse) |

**Result**: Efficient mode can shift regimes from HBM-bound to compute-bound.

## Implementation Patterns

### Modular FLOP Computation

```python
def _compute_attention_flops_prefill_mla(
    B, S, H, h, r_q, r_kv, d_nope, d_rope, d_v
):
    """MLA-specific FLOP calculation for prefill phase"""
    # Q projection: B*S*H*r_q
    # KV projection: 2*B*S*H*r_kv
    # Attention: 8*B*S*H^2 + 4*B*S^2*H + ...
    return total_flops
```

### Byte Decomposition

```python
bytes_hbm = (
    bytes_weights +      # Streaming parameter reads
    bytes_activations +  # Input/output tensors
    bytes_kv +           # KV cache read/write
    bytes_temporary      # Intermediate buffers
)
```

### Time Model

```python
T_comp = F_realizable / P_peak
T_hbm = bytes_hbm / BW_hbm
T_net = bytes_net / BW_net
T_est = max(T_comp, T_hbm, T_net)
regime = argmax(T_comp, T_hbm, T_net)
```

## Roofline Workflow

### Step 1: Classify Limiting Regime
- Compare `AI_hbm` to `OI_knee = P_peak / BW_hbm`
- Inspect `T_comp`, `T_hbm`, `T_net` to find bottleneck

### Step 2: Locate Dominant Byte Term
- Calculate `share(weights)`, `share(kv)`, `share(temporary)`
- Identify which memory traffic dominates

### Step 3: Map to Optimization Family
- **Compute-bound**: Improve utilization, fusion
- **HBM(weight)-bound**: Increase residency, compression
- **HBM(KV)-bound**: KV format/dtype/layout optimization
- **Network-bound**: Topology, compression, overlap

## Practical Examples

### DeepSeek-V3 Analysis

**Training**:
- Efficient mode: `AI_hbm = 652.03` > `OI_knee = 412.29` → **compute-bound**
- Naive mode: `AI_hbm = 319.1` < `OI_knee` → **HBM-bound**
- Conclusion: Efficient kernels (flash attention, fusion) are critical

**Prefill**:
- Efficient mode: `AI_hbm = 434.68` > `OI_knee` → **compute-bound**
- Similar to training: optimization focus on compute path

**Decode**:
- Efficient mode: `AI_hbm = 7.70` << `OI_knee` → **HBM-bound**
- Remains memory-bound across all sampled batches
- Conclusion: Batching policy and KV management are key

### Sensitivity Insights

For decode, ranked by effect size on `T_est`:
1. **top-k experts**: 189.4% impact
2. **hidden scale**: 153.4% impact
3. **KV length (L)**: 9.4% impact
4. **KV dtype bytes**: 3.3% impact

**Actionable insight**: MoE routing parameters matter more than KV cache dtype for this model.

## Key Takeaways

### Tool Evolution Lessons

1. **Start simple, iterate fast**: Basic architecture dump → comprehensive analysis
2. **Follow the data**: Once you have FLOPs/bytes, analysis naturally extends
3. **Static analysis is powerful**: No runtime profiling needed for bottleneck identification
4. **Automation scales**: Manual analysis for one model → automated for any model

### Technical Insights

1. **Roofline is actionable**: Tells you exactly what to optimize
2. **Bottlenecks differ by phase**: Training/prefill often compute-bound, decode often memory-bound
3. **Bytes matter as much as FLOPs**: Memory traffic can limit performance even with fast compute
4. **Model architecture determines regime**: MLA attention, MoE routing, tensor parallelism all affect bottlenecks

### Design Patterns

1. **Modular computation**: Separate FLOP/byte calculators per module type
2. **Configurable assumptions**: Pluggable execution models (naive/efficient)
3. **Sweep-based analysis**: Grid search over configuration space
4. **Visualization for insight**: Roofline plots, regime tables, sensitivity charts

## Future Enhancements

- **Measured performance**: Integrate actual profiler data
- **Cost modeling**: Dollar estimates for cloud deployments
- **Power modeling**: Energy consumption predictions
- **Autotuning**: Automatic optimization parameter search
- **Multi-chip analysis**: TP/DP/PP scaling behavior

## Resources

- Example report: [deepseek_model_report.md](https://github.com/lastweek/nano-train/blob/main/examples/outputs/model_reports/deepseek_model_report.md)
- Implementation: [nano-train](https://github.com/lastweek/nano-train)
