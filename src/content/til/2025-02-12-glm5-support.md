---
title: "SGLang Model Support: Native DeepSeek-V2 Mapping and Transformers Backend Fallback"
description: "Learned how SGLang supports models like GLM-5 via native DeepSeek-V2 inheritance, and falls back to Transformers backend for unsupported models with hot-path replacement"
date: 2025-02-12
tags: ["sglang", "vllm", "glm5", "deepseek", "transformers", "model-architecture"]
---

Learned two key patterns for how SGLang supports models: (1) **Native support** for architectures like GLM-5 by mapping them to DeepSeek-V2 implementations, and (2) **Transformers backend fallback** for unsupported models with performance-critical hot-path replacement.

---

## Part 1: GLM-5 Native Support via DeepSeek-V2 Mapping

Both SGLang and vLLM support GLM-5 models by mapping the `GlmMoeDsaForCausalLM` architecture onto their existing DeepSeek-V2 family implementations, enabling native DeepSeek-style attention (MLA/DSA), MoE routing, and KV cache paths without requiring a Transformers backend.

### Core Architecture Mapping

Both inference engines use the same strategy: **map GLM-5 to DeepSeek-V2 code paths**. The HF config for GLM-5 specifies:
- `architectures = ["GlmMoeDsaForCausalLM"]`
- `model_type = "glm_moe_dsa"`

Both engines recognize this architecture and route it to their DeepSeek-V2 implementation:
```python
class GlmMoeDsaForCausalLM(DeepseekV2ForCausalLM):
    pass
```

This simple inheritance gives GLM-5 full access to DeepSeek's optimized MLA/DSA attention, MoE routing, and KV cache management.

## SGLang: Registration-Based Native Support

### Registration Flow
1. **Model Registry Auto-Discovery**: SGLang's `ModelRegistry.register("sglang.srt.models")` loads all model modules and their `EntryClass` exports
2. **GLM-5 Native Class**: `sglang/python/sglang/srt/models/glm4_moe.py` defines `GlmMoeDsaForCausalLM` and exports it via `EntryClass`
3. **Architecture Detection**: Model loader checks if `config.architectures` is in the registry—if found, uses native class; otherwise falls back to `TransformersForCausalLM`

### DSA/NSA Attention Path
```python
# sglang/python/sglang/srt/configs/model_config.py
is_deepseek_nsa(hf_config)  # Returns True for GlmMoeDsaForCausalLM
```

When `is_deepseek_nsa()` returns true, SGLang:
- Selects `nsa` attention backend in server args
- Adds GLM-5-specific handling for SM100 devices
- Routes through `DeepseekV2AttentionMLA` with DSA/NSA logic

### Forward Path
```
DeepseekV2ForCausalLM.forward()
  → DeepseekV2Model.forward()
    → DecoderLayer loop:
      - Input layernorm
      - DeepseekV2AttentionMLA (DSA/NSA, RadixAttention)
      - Post-attn layernorm
      - MLP or MoE (based on n_routed_experts)
  → LogitsProcessor + lm_head
```

**Files**:
- `sglang/python/sglang/srt/models/registry.py`
- `sglang/python/sglang/srt/models/glm4_moe.py`
- `sglang/python/sglang/srt/models/deepseek_v2.py`
- `sglang/python/sglang/srt/model_loader/utils.py`

## vLLM: Registry Mapping Resolution

### Registry Mapping
```python
# vllm/vllm/model_executor/models/registry.py
_TEXT_GENERATION_MODELS = {
    "GlmMoeDsaForCausalLM": ("deepseek_v2", "GlmMoeDsaForCausalLM"),
    ...
}
```

This mapping tells vLLM: when you see `GlmMoeDsaForCausalLM` in the config, load the `deepseek_v2` module and use the `GlmMoeDsaForCausalLM` class defined there.

### Config Conversion
```python
# vllm/vllm/transformers_utils/model_arch_config_convertor.py
is_deepseek_mla(hf_config)  # Returns True for model_type == "glm_moe_dsa"
```

When `is_deepseek_mla()` returns true, vLLM enables the correct head dimension logic for MLA attention.

### Speculative Decoding Override
For speculative decoding, GLM-5 gets additional special handling:
```python
# vllm/vllm/config/speculative.py
if hf_config.model_type in ("deepseek_v3", "deepseek_v32", "glm_moe_dsa"):
    # Convert to deepseek_mtp with architectures=["DeepSeekMTPModel"]
```

### Forward Path
```
DeepseekV2ForCausalLM.forward()
  → DeepseekV2Model.forward()
    → DecoderLayer loop:
      - Input RMSNorm
      - DeepseekAttention or DeepseekV2MLAAttention
      - Post-attn RMSNorm
      - MLP or MoE (based on n_routed_experts)
  → LogitsProcessor (last PP rank)
```

**Files**:
- `vllm/vllm/model_executor/models/registry.py`
- `vllm/vllm/model_executor/models/deepseek_v2.py`
- `vllm/vllm/transformers_utils/model_arch_config_convertor.py`
- `vllm/vllm/config/speculative.py`

## Key Differences

| Aspect | SGLang | vLLM |
|--------|--------|------|
| **Registration** | `EntryClass` export in model module | `_TEXT_GENERATION_MODELS` dictionary mapping |
| **Class location** | `glm4_moe.py` (separate file) | `deepseek_v2.py` (inline definition) |
| **Attention selection** | `is_deepseek_nsa()` + server args | `use_mla` flag + cache_config |
| **Special handling** | SM100 device logic | Speculative decoding MTP mapping |
| **Fallback condition** | Arch not registered OR `--model-impl transformers` | `model_impl=transformers` OR arch not resolved |

## Verification Checklist

### SGLang
```python
from transformers import AutoConfig
cfg = AutoConfig.from_pretrained("zai-org/GLM-5-FP8", trust_remote_code=True)
print("architectures:", cfg.architectures)  # Should include GlmMoeDsaForCausalLM
print("model_type:", cfg.model_type)        # Should be glm_moe_dsa

from sglang.srt.models.registry import ModelRegistry
print("GlmMoeDsaForCausalLM" in ModelRegistry.get_supported_archs())  # Should be True
```

### vLLM
```python
from vllm.model_executor.models import registry
print(registry._TEXT_GENERATION_MODELS.get("GlmMoeDsaForCausalLM"))
# Should output: ("deepseek_v2", "GlmMoeDsaForCausalLM")
```

## Practical Implications

1. **No Transformers overhead**: GLM-5 runs through native, optimized DeepSeek code paths
2. **Full MoE support**: Inherits DeepSeek-V2's expert routing and load balancing
3. **MLA/DSA attention**: Uses compressed KV cache and sparse attention optimizations
4. **Tensor parallelism**: Works with DeepSeek-V2's distributed inference strategies
5. **When fallback occurs**: Only if HF config changes architecture name OR explicit `model_impl=transformers` flag

## Architecture Flow Diagram


![Diagram](/mermaid/diagram-1770881550941-0.svg)


---

## Part 2: Transformers Backend Fallback for Unsupported Models

When a model's HF `architectures` is not registered in SGLang, SGLang falls back to `TransformersForCausalLM`, builds the model via Transformers, then replaces hot paths (attention and linear layers) with SGLang implementations for performance.

### Design Pattern: Adapter/Facade + Hot-Path Swap

**Core idea**: Transformers builds the structure, SGLang swaps hot modules.

The decisive factors are:
- HF `architectures` resolves to a usable Transformers class
- SGLang can wrap it with its backend

### From `--model` to Model Init (Unsupported Model)

Example: `--model acme-ai/AcmeLM-1` where HF config has `architectures = ["AcmeLMForCausalLM"]` (not in SGLang registry)

**Step-by-step:**
1. **CLI parse**: `--model` → `ServerArgs.model_path`
2. **ModelConfig**: `get_config()` pulls HF config, determines `architectures`
3. **Model class selection**: Not registered → fallback to `TransformersForCausalLM`
4. **Weights**: Downloaded from HF and loaded

**Files:**
- `python/sglang/srt/server_args.py`
- `python/sglang/srt/configs/model_config.py`
- `python/sglang/srt/model_loader/utils.py`
- `python/sglang/srt/models/registry.py`


![Diagram](/mermaid/diagram-1770882390501-0.svg)



![Diagram](/mermaid/diagram-1770882392671-1.svg)


### Three-Layer Replacement Strategy

#### 1. Model Construction via Transformers
```python
AutoModel.from_config(
  config,
  attn_implementation="sglang",
  trust_remote_code=True,
)
```

- `AutoModel.from_config` builds the model from HF config
- `attn_implementation="sglang"` redirects attention calls to SGLang

**File**: `python/sglang/srt/models/transformers.py`

#### 2. Attention: Call-Site Routing (Not Class Replacement)

SGLang registers a custom attention function and routes HF attention through it into `RadixAttention`:
```python
ALL_ATTENTION_FUNCTIONS["sglang"] = sglang_flash_attention_forward
```

This is **entry-point swapping**, not class rewriting.

**File**: `python/sglang/srt/models/transformers.py`

#### 3. Linear Layers: In-Place Object Replacement

`tensor_parallel()` walks the model and replaces `nn.Linear` instances with:
- `ColumnParallelLinear`
- `RowParallelLinear`

This requires `base_model_tp_plan` in config—no plan means no TP replacement.

**File**: `python/sglang/srt/models/transformers.py`

#### 4. Embedding + LM Head: Parallel Versions
- Input embedding → `VocabParallelEmbedding`
- Output head → `ParallelLMHead`
- Weight tying supported

**File**: `python/sglang/srt/models/transformers.py`

### Performance Impact by Module

| Module | Performance impact | SGLang handling (Transformers backend) | Notes |
|--------|-------------------|----------------------------------------|-------|
| **Attention** | Dominant compute + KV traffic | Hook → `RadixAttention` | Entry-point swap, not class rewrite |
| **Linear/MLP** | Large matmuls, TP critical | Replace via `base_model_tp_plan` | No TP plan → no replacement |
| **Embedding/LM head** | Large vocab, comm heavy | Parallel embedding + head | Only I/O layers replaced |
| **MoE routing** | Gating/dispatch overhead | **Not replaced** | Remains HF logic |
| **KV cache dtype** | Memory/bandwidth tradeoff | Global config | Independent of model class |
| **CUDA Graph** | Reduce launch overhead | Capture/replay for decode | Can be disabled |
| **Scheduling** | Throughput/latency | Scheduler-level | Backend-agnostic |

### Performance Bottleneck Analysis

| Area | Impact | Handling | Knobs |
|------|--------|----------|-------|
| **Prefill vs decode** | Prefill compute, decode bandwidth | Scheduler separates | `--chunked-prefill-size`, `--max-prefill-tokens` |
| **Batch sizing** | Throughput vs latency | Scheduler policies | `--schedule-policy`, `--max-running-requests` |
| **TP/DP comms** | All-reduce cost | TP linears | `--tp-size`, `--disable-custom-all-reduce` |
| **KV cache** | Memory & bandwidth | Configured centrally | `--kv-cache-dtype` |
| **CUDA Graph** | Kernel launch overhead | `ModelRunner` capture | `--disable-cuda-graph`, `--cuda-graph-bs` |
| **MoE experts** | Routing + dispatch | Not replaced | Needs native model class |
| **Quantization** | Load + speed | Generic loader | `--quantization`, `--load-format` |
| **Memory headroom** | Limits batch | Memory management | `--mem-fraction-static` |

### Runtime Forward Path (Condensed)

1. Request → Tokenizer → Scheduler → ModelRunner
2. HF model forward executes:
   - Attention routed to `RadixAttention`
   - MLP uses TP linears
3. Output logits via `ParallelLMHead`

### What This Means for Unsupported Models

- **No native class** → No model-specific kernels
- **Load depends on Transformers** (local install or `--trust-remote-code`)
- **Performance is generic**: TP + RadixAttention, but no custom MoE or model-specific tuning
- **MoE limitation**: Transformers backend doesn't replace MoE routing

### Performance Optimization Advice

1. **Enable CUDA Graph** for decode (don't disable it)
2. **Choose TP size** to avoid communication bottlenecks
3. **Tune KV cache dtype** for concurrency/VRAM tradeoff
4. **Adjust prefill chunking** to reduce tail latency
5. **For best MoE performance**, add a native model class

### Transformers Backend vs Native Support

| Aspect | Native Support (GLM-5) | Transformers Backend (Unsupported) |
|--------|------------------------|-----------------------------------|
| **Model class** | Registered in SGLang registry | Falls back to `TransformersForCausalLM` |
| **Implementation** | Direct DeepSeek-V2 inheritance | Wrapped via Transformers, then hot-path swap |
| **Attention** | Native DeepSeek MLA/DSA | `RadixAttention` via call-site routing |
| **MoE routing** | Native DeepSeek MoE | **Not replaced** (HF native logic) |
| **TP support** | Native DeepSeek TP | Via `base_model_tp_plan` if available |
| **Custom kernels** | Model-specific optimizations | Generic optimizations only |

### Key Code Locations

- CLI args: `python/sglang/srt/server_args.py`
- Config load: `python/sglang/srt/configs/model_config.py`
- HF config utils: `python/sglang/srt/utils/hf_transformers_utils.py`
- Model selection: `python/sglang/srt/model_loader/utils.py`
- Transformers backend: `python/sglang/srt/models/transformers.py`
- Weight loader: `python/sglang/srt/model_loader/loader.py`

### Performance Hot Paths


![Diagram](/mermaid/diagram-1770882394319-2.svg)


---

## Overall Key Takeaways

### For GLM-5 (Native Support)

1. **GLM-5 ≈ DeepSeek-V2**: Both engines treat GLM-5 as a DeepSeek-V2 family model through simple class inheritance
2. **Native over Transformers**: Preference for native implementation with Transformers fallback only when necessary
3. **Architecture name matters**: The `GlmMoeDsaForCausalLM` string in HF config unlocks native support
4. **Full optimization pipeline**: GLM-5 gets all DeepSeek optimizations—MLA attention, DSA sparsity, MoE routing, TP distribution
5. **Simple but powerful**: A one-line class definition enables entire DeepSeek optimization stack

### For Unsupported Models (Transformers Backend)

1. **Adapter/Facade pattern**: TransformersForCausalLM wraps arbitrary HF models
2. **Hot-path swap**: Attention (call routing), Linear (object replacement), Embedding (parallel)
3. **Performance is generic**: Works for all models, but model-specific features (MoE) get HF treatment
4. **TP requires config**: Linear layer replacement only works if `base_model_tp_plan` exists in config
5. **When to add native class**: For model-specific optimizations (especially MoE routing)
