export interface Project {
  id: string
  name: string
  category: string
  status: 'TBD' | 'WIP' | 'Done'
  github?: string
  description: string
  goals: string[]
}

export const projects: Project[] = [
  // Silicon
  {
    id: 'silicon',
    name: 'Nano GPU',
    category: 'Silicon',
    status: 'TBD',
    description: 'SIMT + DSA architecture providing Scalar, Vector, Cube / Memory ISA APIs with Linux kernel drivers.',
    goals: [
      'Provide SIMT + DSA architecture',
      'Provide Scalar, Vector, Cube / Memory ISA APIs',
      'Has Linux kernel drivers',
      'Has test code',
      'Eventually hook into our torch',
    ],
  },
  // Virt
  {
    id: 'nano-kvm',
    name: 'Nano KVM',
    category: 'Virt',
    status: 'WIP',
    description: 'Nano VMM - Virtual Machine Monitor for KVM/HV APIs.',
    goals: [
      'Able to start VM using KVM/HV APIs',
      'Able to handle basic console print',
      'Able to handle SR-IOV device',
      'Able to run cross-platform (ARM64 and x86_64)',
      'Include basic kernel image',
    ],
  },
  {
    id: 'nano-container',
    name: 'Nano Container',
    category: 'Virt',
    status: 'WIP',
    description: 'Lightweight container runtime for isolation and resource management.',
    goals: [],
  },
  // Compiler
  {
    id: 'nano-tvm',
    name: 'Nano TVM',
    category: 'Compiler',
    status: 'TBD',
    description: 'Tensor Virtual Machine based compiler stack for deep learning.',
    goals: [],
  },
  {
    id: 'nano-mlir',
    name: 'Nano MLIR',
    category: 'Compiler',
    status: 'TBD',
    description: 'Multi-Level Intermediate Representation compiler infrastructure.',
    goals: [],
  },
  {
    id: 'nano-tilelang',
    name: 'Nano TileLang',
    category: 'Compiler',
    status: 'TBD',
    description: 'Tiling-based language for optimizing tensor computations.',
    goals: [],
  },
  {
    id: 'nano-kernelgen',
    name: 'Nano KernelGen',
    category: 'Compiler',
    status: 'TBD',
    description: 'Kernel generation system for producing optimized compute kernels.',
    goals: [],
  },
  // Framework
  {
    id: 'nano-collective',
    name: 'Nano Collective',
    category: 'Framework',
    status: 'TBD',
    description: 'Distributed collective communication operations for training.',
    goals: [],
  },
  {
    id: 'nano-torch',
    name: 'Nano Torch',
    category: 'Framework',
    status: 'WIP',
    description: 'Deep learning framework with PyTorch-like API.',
    goals: [
      'Able to train a simple transformer module',
      'Able to run on the CPU backend, possibly the vibe-gpu',
    ],
  },
  {
    id: 'nano-megatron',
    name: 'Nano Megatron',
    category: 'Framework',
    status: 'TBD',
    description: 'Large-scale distributed training framework inspired by Megatron.',
    goals: [],
  },
  {
    id: 'nano-serving',
    name: 'Nano Serving',
    category: 'Framework',
    status: 'TBD',
    description: 'Model serving and inference optimization system.',
    goals: [],
  },
  {
    id: 'nano-areal',
    name: 'Nano AReal',
    category: 'Framework',
    status: 'TBD',
    description: 'Analog computing and real-time processing framework.',
    goals: [],
  },
  // Agent
  {
    id: 'nano-opencode',
    name: 'Nano OpenCode',
    category: 'Agent',
    status: 'TBD',
    description: 'AI-powered code generation and analysis agent.',
    goals: [],
  },
]

export const categories = ['Silicon', 'Virt', 'Compiler', 'Framework', 'Agent'] as const

export const statusOrder = { Done: 0, WIP: 1, TBD: 2 }
