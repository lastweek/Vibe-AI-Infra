---
title: "Nano-RL and Nano-Coder: Producing and Consuming Agentic Models"
description: "Starting two complementary projects: nano-RL for training agentic models with reinforcement learning, and nano-coder for building agent systems that consume these models"
date: 2026-02-28
tags: ["rl", "agents", "llm", "reinforcement-learning", "tool-use", "code-execution"]
---

Starting two complementary projects that explore both sides of agentic AI systems:

- **nano-rl**: Produces agentic models via reinforcement learning
- **nano-coder**: Consumes agentic models for tool use and code execution

This producer-consumer duality provides a complete view of how agentic AI systems are built and used.

---

## The Producer: nano-RL

**Goal**: Train models that can act as agents using reinforcement learning.

### Why RL for Agents?

Supervised fine-tuning (SFT) teaches models what to say, but RL teaches models what to **do**. For agents:
- **SFT**: "If you want to search, output `search(query)`"
- **RL**: "If searching achieves the goal, you get rewarded"

RL optimizes for **outcomes**, not just imitation. This is crucial for:
- Multi-step reasoning
- Tool use strategies
- Error recovery
- Long-horizon tasks

### Approach

Starting with basic RLHF (Reinforcement Learning from Human Feedback):
1. **Reward model**: Learn what humans consider good agent behavior
2. **Policy training**: Optimize agent to maximize rewards
3. **Iterative refinement**: Improve both reward model and policy

Moving toward more advanced methods:
- **RLAIF** (AI Feedback): Use stronger models to provide rewards
- **Constitutional AI**: Encode principles as reward signals
- **Multi-objective RL**: Balance task completion, safety, efficiency

## The Consumer: nano-coder

**Goal**: Build systems that use agentic models for code execution and tool use.

### Why Tool Use Matters

Agents need to interact with the world:
- **Code execution**: Run programs, test outputs
- **File operations**: Read/write files, manage state
- **API calls**: Query databases, call services
- **Shell access**: Execute commands, manage systems

Tool use transforms LLMs from chatbots into **autonomous systems**.

### Architecture Design

Core components:
1. **Tool registry**: Define available tools and their interfaces
2. **Execution sandbox**: Safe environment for running tools
3. **Result parsing**: Convert tool outputs back to model context
4. **Decision loop**: Model chooses tools, executes, observes, repeats

```python
# Simplified agent loop
while not done:
    # Model decides what to do
    action = agent.choose(next_observation)

    # Execute the action
    result = tools.execute(action)

    # Observe and continue
    next_observation = result.observation
```

## The Synergy

These projects are complementary:

| Aspect | nano-rl | nano-coder |
|--------|---------|------------|
| **Role** | Producer | Consumer |
| **Output** | Trained agent models | Agent runtime systems |
| **Focus** | Training dynamics | Execution reliability |
| **Method** | RL optimization | Tool orchestration |

### Feedback Loop

The two systems can improve each other:
- **nano-rl** trains better agents for **nano-coder** to use
- **nano-coder** provides execution data for **nano-rl** to learn from
- **Combined**: End-to-end agent development pipeline

## Key Design Principles

### For nano-rl (Producer)
1. **Reward design**: The hardest part - encode what matters
2. **Exploration**: Balance trying new things vs exploiting knowledge
3. **Training stability**: RL is notoriously unstable, needs careful tuning
4. **Sample efficiency**: RL requires lots of data, need to use it well

### For nano-coder (Consumer)
1. **Safety**: Sandboxing is non-negotiable for code execution
2. **Observability**: Need to see what agents are doing
3. **Error handling**: Tools fail, agents need to recover
4. **Tool selection**: Right tool for the right task

## What Makes This Different

**Compared to existing work**:
- **nano-rl**: Focus on learning agent behavior, not just chat responses
- **nano-coder**: Focus on execution reliability, not just API calls

**Complementary insight**: Most people work on one side or the other. Building both provides:
- Understanding of how training affects runtime behavior
- Visibility into how runtime constraints should shape training
- End-to-end view of agent development

## Next Steps

**nano-rl**:
- [ ] Set up basic RLHF training loop
- [ ] Define reward structure for tool use tasks
- [ ] Train simple agent on code execution tasks

**nano-coder**:
- [ ] Implement tool registry and execution engine
- [ ] Build sandbox for safe code execution
- [ ] Create observation/action formatting for agents

**Integration**:
- [ ] Connect nano-rl trained models to nano-coder
- [ ] Collect execution data for reward modeling
- [ ] Iterate on both systems based on real behavior

## Takeaways

1. **Producer-consumer duality**: Understanding both sides of agent systems
2. **RL for agency**: Training outcomes, not just outputs
3. **Tool use as interface**: Agents interact with world through tools
4. **Safety first**: Sandboxing and observability from the start
5. **Iterative refinement**: Both systems improve each other

This parallel exploration provides a complete picture: how to train agents that can act, and how to build systems that let them act safely and effectively.
