---
title: "Building Production LLM Infrastructure on Kubernetes"
description: "Learned how to build production-grade Kubernetes infrastructure for LLM serving with custom CRDs, operators, and fleet autoscaling patterns"
date: 2025-02-12
tags: ["kubernetes", "llm", "vllm", "crd", "operators", "autoscaling"]
---

Completed building a production-grade LLM serving infrastructure on Kubernetes from scratch, learning how to orchestrate large language model inference through custom resources, operators, and sophisticated autoscaling patterns.

## Project Overview

The nano-k8s-cluster project demonstrates how to serve LLMs on Kubernetes at production scale, moving beyond simple deployments to sophisticated orchestration patterns that handle the unique constraints of tensor-parallel models.

**Core Technologies:**
- **Kubernetes**: Control plane with minikube for local development
- **vLLM**: High-throughput LLM inference engine
- **Go Operators**: Production-grade controllers using Kubebuilder
- **Observability Stack**: Prometheus, Grafana, AlertManager

**Two Serving Architectures:**
1. **Monolithic**: Single TP instance with router load balancing
2. **Disaggregated**: Separate prefill (TP-8) and decode (TP-4) clusters with coordinated scaling

## Fundamental Learning: Fixed-Shape Tensor Parallelism

The most critical insight is that **tensor parallelism requires fixed GPU counts per model instance**.

**Mathematical Constraint:**
```
tensorParallelSize = replicas × gpusPerPod
```

**Example**: For Llama-3-70B with TP-8:
- Need exactly 8 GPUs working as one unit
- Could be: 2 pods × 4 GPUs/pod, or 8 pods × 1 GPU/pod
- Cannot arbitrarily add/remove pods without breaking tensor parallelism

**Implication**: Traditional Kubernetes HPA fails for LLM serving because it tries to scale pods within a TP instance. Horizontal scaling means creating whole new LLMCluster instances, not adding pods to existing ones.

## CRD Architecture Design

### LLMCluster Custom Resource

**Key Design Decisions:**
```yaml
spec:
  replicas: 2              # Number of pods
  gpusPerPod: 4           # GPUs per pod (TP / replicas = gpusPerPod)
  tensorParallelSize: 8   # Must equal replicas × gpusPerPod
  model: "llama-3-70b"
  routerEnabled: true
```

**Validation**: CRD validates that `tensorParallelSize = replicas × gpusPerPod` before creation, preventing invalid configurations.

**Status Subresource**: Separates status from spec to prevent user modification and enable proper condition tracking.

**Conditions**: Rich status communication (Ready, Progressing, Degraded) for operators to react to.

### LLMClusterAutoscaler Custom Resource

**Fleet Scaling Pattern**: Unlike traditional HPA that scales pods, this operator creates/destroys entire LLMCluster instances based on multi-metric evaluation with hysteresis to prevent oscillation.

**Why Not Standard HPA:**
- HPA scales pods within a deployment
- TP models require scaling whole instances
- Pod-level scaling breaks tensor parallelism constraints

## Control/Data Plane Separation

The architecture implements clean separation between control and data planes:

### Control Plane
- CRDs defining desired state
- Operators watching and reconciling
- Autoscaler making scaling decisions
- Controllers managing pod lifecycle

### Data Plane
- Model serving pods (vLLM instances)
- Routers distributing requests
- Redis queues for request management
- Actual inference computation

**Benefits:**
- Independent evolution of control logic and serving stack
- Clear RBAC boundaries between teams
- Isolated failure domains
- Easier testing and debugging

## Disaggregated Serving Architecture

### Two-Phase Serving Pattern

**Prefill Cluster (TP-8)**:
- Processes entire prompts
- Computes KV cache for all tokens
- Higher compute requirements
- Outputs: KV cache + last hidden state

**Decode Cluster (TP-4)**:
- Generates tokens incrementally
- Uses cached KV from prefill
- Lower compute per token but higher frequency
- Continues generation until completion

### Critical Coordination Constraint

```yaml
maxPrefillPerDecode: 2  # Ratio limit
```

**Purpose**: Prevents decode cluster starvation from faster prefill operations.

**Why It Matters**: Without this constraint, rapid prefill operations could flood the decode cluster with pending requests, causing excessive latency for token generation.

**Implementation**: Router enforces the ratio in admission control, queuing prefill requests when decode cluster is at capacity.

## StatefulSet vs Deployment

**Why StatefulSet:**
- Provides stable pod identity required for tensor parallelism
- Each pod has a consistent hostname (pods-0, pods-1, etc.)
- TP initialization relies on stable pod ordering
- Enables controlled rolling updates

**OnDelete Update Strategy:**
- Manual pod deletion for rolling updates
- Prevents uncontrolled simultaneous restarts
- Maintains 50% availability with PodDisruptionBudget
- Zero-downtime deployments

## Performance Characteristics

**Latency Budget:**
- **2500ms p95** total for production serving
- Includes prefill, decode, and network overhead
- Drives architecture decisions (disaggregation helps meet this)

**Throughput Calculation:**
- **Theoretical max**: tokens/second based on GPU specs
- **Real-world**: ~85% efficiency
- **Overhead**: Network, coordination, queuing, KV cache transfer

**Model Loading Time:**
- **~45 seconds** for Llama-3-70B TP-8
- Impacts autoscaling reaction time
- Must be accounted for in capacity planning

## Fleet Autoscaling Logic

### Multi-Metric Evaluation

**Decision Factors:**
- Request queue length (Redis)
- GPU utilization metrics (Prometheus)
- Request latency percentiles
- Pending request count
- Current instance count

**Hysteresis:**
```yaml
scaleUpThreshold: 80
scaleDownThreshold: 30
cooldownPeriod: 300s
```

**Purpose**: Prevent oscillation by requiring thresholds to be crossed significantly before scaling actions, with cooldown periods between actions.

### Scaling Decision Flow


![Diagram](/mermaid/diagram-1770884116788-0.svg)


## Operational Learnings

### Resource Management

**GPU Allocation Strategies:**
- **Dedicated Instances**: Full GPUs for production workloads
- **MIG Profiles**: Multi-Instance GPU for multi-tenant scenarios
- **Trade-off**: MIG increases utilization but adds complexity

**Right-Sizing:**
- Model loading time vs utilization trade-off
- Larger batches = better GPU utilization but higher latency
- Smaller instances = faster scaling but more overhead

### Failure Tolerance

**Automatic Recovery:**
- Controllers self-heal pod failures
- StatefulSet maintains stable identity
- Restart policies replace crashed pods

**Rolling Updates:**
- OnDelete strategy enables controlled updates
- PodDisruptionBudget ensures minimum availability
- Health checks determine readiness

### Observability is Critical

**What to Measure:**
- Request queue depth and wait times
- Token generation throughput (tokens/second)
- GPU utilization (memory and compute)
- Pod lifecycle events (scheduling, startup, termination)
- Request latency percentiles (p50, p95, p99)

**Why It Matters:**
- Can't optimize what you don't measure
- GPUs are expensive—underutilization wastes money
- Latency budgets drive architectural decisions
- Capacity planning requires accurate data

## Implementation Patterns Discovered

### Fixed-Shape Scaling Pattern

**Problem**: Traditional HPA scales pods within a deployment, breaking tensor parallelism.

**Solution**: Fleet scaling creates/destroys entire LLMCluster instances.

**Implementation**:
```go
// Pseudo-code
func (r *AutoscalerReconciler) Reconcile() {
  currentInstances := listLLMClusters()
  metrics := collectMetrics()

  if shouldScaleUp(metrics) {
    newInstance := createLLMCluster(spec)
  } else if shouldScaleDown(metrics) {
    deleteInstance(oldestInstance)
  }
}
```

### Phase Coordination Pattern

**Problem**: Disaggregated serving requires coordinating prefill and decode phases.

**Solution**: Router enforces `maxPrefillPerDecode` ratio and manages KV cache transfer.

**Implementation**:
```go
func (r *Router) routeRequest(req Request) error {
  decodeCount := countDecodeInstances()
  prefillCount := countPrefillInstances()

  if prefillCount/decodeCount >= maxPrefillPerDecode {
    return queueRequest(req, "prefill-backlog")
  }

  if req.hasKVCache {
    return sendToDecode(req)
  }
  return sendToPrefill(req)
}
```

### Declarative Infrastructure Pattern

**Problem**: Manual infrastructure management is error-prone and doesn't scale.

**Solution**: CRD-based declarative definitions—operators manage the "how".

**Benefits**:
- Single source of truth (Git)
- Self-healing through reconciliation
- Version controlled infrastructure
- Easier testing and validation

## Development Approach

### Progressive Learning Path

**1. Foundation:**
- Basic CRDs and RBAC
- Simple operators with Kubebuilder
- Understanding Kubernetes reconciliation loop

**2. Monolithic Serving:**
- Single TP instance deployment
- Basic request routing
- Simple metrics collection

**3. Production Features:**
- Router integration with load balancing
- Fleet autoscaling with hysteresis
- Comprehensive observability

**4. Advanced:**
- Disaggregated prefill/decode serving
- Phase coordination and KV cache transfer
- Multi-metric scaling decisions

### Testing Strategy

**Integration Tests:**
- End-to-end request flows
- CRD creation and reconciliation
- Scaling decision logic

**Load Testing:**
- Locust for performance verification
- Validate latency budgets
- Measure throughput under load

**Failure Scenarios:**
- Pod crashes and restarts
- Network partitions
- GPU out-of-memory errors
- Queue overflow conditions

## Key Takeaways

### Technical Insights

1. **Kubernetes excels at stateful AI workloads** when combined with proper operators
2. **CRDs extend Kubernetes** to handle domain-specific logic (fixed-shape TP)
3. **Tensor parallelism is the fundamental constraint** that drives all architectural decisions
4. **Disaggregation enables optimization** but adds coordination complexity
5. **Observability is non-negotiable** for production LLM serving

### Architectural Principles

1. **Fixed-shape scaling**: Scale instances, not pods, for TP models
2. **Control/data plane separation**: Independent evolution and clear boundaries
3. **Declarative infrastructure**: Define desired state, let operators handle implementation
4. **Hysteresis in scaling**: Prevent oscillation through thresholds and cooldowns

### Operational Lessons

1. **Start simple**: Progress from monolithic to disaggregated
2. **Measure everything**: Comprehensive metrics drive good decisions
3. **Failure recovery must be automatic**: Manual intervention doesn't scale
4. **Cost awareness matters**: GPU resources are expensive—optimize utilization
5. **Documentation is learning**: Document as you build, not after you're done

### Future Directions

- **Predictive Scaling**: ML-based traffic prediction for proactive scaling
- **Multi-tenancy**: MIG partitioning for cost optimization
- **Global Schedulers**: Cross-cluster request routing
- **Training Integration**: Adding training workloads to the same infrastructure
