---
title: Roofline Analysis
description: Model compute and memory ceilings to locate bottlenecks in AI workloads.
status: active
publishDate: 2026-02-08
tags:
  - performance
  - hardware-modeling
---

## Why This Matters

AGI workloads run into performance limits that are often misunderstood. Roofline modeling gives a direct way to identify whether a workload is constrained by compute throughput or memory bandwidth, so optimization work can target the right bottleneck first.

## What This Covers

This insight outlines a practical roofline workflow for AI kernels:

1. Select target hardware and establish peak compute/bandwidth limits.
2. Estimate arithmetic intensity for representative operations.
3. Map kernels to the roofline and classify likely bottlenecks.

## Build Next

1. Add hardware presets for common accelerators.
2. Add repeatable arithmetic-intensity templates for model components.
3. Export chart data with assumptions attached for reproducibility.
