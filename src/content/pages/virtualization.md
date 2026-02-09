---
title: Virtualization Stack
description: Complete virtualization stack from hardware virtualization through container runtime for isolating AI agents.
summary: Hardware virtualization, hypervisor abstraction, and container runtime for agent isolation.
showInNav: true
navLabel: Virtualization
navOrder: 15
updated: 2026-02-09
---

## Why Virtualization Matters for AI Agents

AI agents execute untrusted code, access external resources, and require strict resource limits. The Vibe virtualization stack provides three layers of isolation to run agents safely:

- **Security**: Isolate agent code from host systems and other agents
- **Resource Control**: CPU, memory, and disk limits per agent
- **Sandboxing**: Network and filesystem isolation
- **Multi-tenancy**: Run many agents safely on one host
- **Reproducibility**: Consistent execution environment across deployments

## Stack Architecture

The virtualization stack forms a complete isolation foundation, from hardware to containers:

| Layer | Project | Isolation Level | Primary Use Case |
|-------|---------|-----------------|------------------|
| Hardware Virtualization | [Vibe KVM](/nano-infra/virt/vibe-kvm) | CPU/Memory | Learning VT-x, building hypervisors |
| Hypervisor Abstraction | [Vibe VMM](/nano-infra/virt/vibe-vmm) | Full VM | Cross-platform VM execution |
| Container Runtime | [Nano Sandbox](/nano-infra/virt/nano-sandbox) | Process/MicroVM | Lightweight agent workloads |

### Layer Interaction

```
┌─────────────────────────────────────────────────────────────┐
│                    AI Agent Workload                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Nano Sandbox (OCI Runtime)                     │
│  ┌────────────────────┐    ┌────────────────────────────┐  │
│  │ Pure-Container     │    │ Firecracker microVM        │  │
│  │ namespaces/cgroups │    │ (via Vibe VMM)             │  │
│  └────────────────────┘    └────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Vibe VMM (Hypervisor)                          │
│  ┌────────────────────┐    ┌────────────────────────────┐  │
│  │ Linux KVM          │    │ macOS HVF                  │  │
│  └────────────────────┘    └────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Vibe KVM (Hardware Interface)                  │
│         Intel VT-x / AMD-V Virtualization Extensions        │
└─────────────────────────────────────────────────────────────┘
```

## Vibe KVM: Hardware Virtualization

[Vibe KVM](https://github.com/lastweek/vibe-kvm) is an educational implementation of the Linux KVM API, demonstrating how Intel VT-x hardware virtualization works at the processor level.

### Key Concepts

**VMX Operation Modes**
- **VMX Root Mode**: Hypervisor runs here, has full control
- **VMX Non-Root Mode**: Guest VMs run here, with restricted privileges
- **VM Entry**: Transition from root to non-root (launch VM)
- **VM Exit**: Transition from non-root to root (VM needs hypervisor)

**VMCS (Virtual Machine Control Structure)**
The VMCS controls VM behavior and stores state:
- Guest state: registers, control fields
- Host state: where to return on VM exit
- VM execution controls: what causes exits
- VM exit controls: what information to save

**EPT (Extended Page Tables)**
Second-level address translation for memory virtualization:
- Guest physical → Host physical translation
- Reduces VM exits for memory access
- 4-level paging (PML4, PDP, PD, PT)

**Virtio Device Framework**
Para-virtualized I/O for better performance:
- Virtqueues for communication
- Block and network device support
- Shared memory for data transfer

**SR-IOV Device Assignment**
Direct hardware access for high-performance I/O:
- Physical Function (PF) and Virtual Functions (VF)
- VF passthrough via VFIO
- Bypasses hypervisor for near-native speed

### Code Example: Simple VM Entry

```c
// Initialize VMCS for basic VM execution
int init_vmcs(struct vmm_context *ctx) {
    // Set VMCS link pointer to ourselves (current VMCS)
    vmwrite(VMX_LINK_POINTER, ~0ULL);

    // Set guest IA32_DEBUGCTL to 0 (no debug exceptions)
    vmwrite(GUEST_IA32_DEBUGCTL, 0);

    // Configure VM-exit controls
    vmwrite(VM_EXIT_CONTROLS,
            VM_EXIT_IA32E_MODE |      // 64-bit guest
            VM_EXIT_HOST_ADDR_SPACE);  // Logical address space

    // Configure VM-entry controls
    vmwrite(VM_ENTRY_CONTROLS,
            VM_ENTRY_IA32E_MODE);     // 64-bit guest

    // Set guest RIP (where guest starts execution)
    vmwrite(GUEST_RIP, ctx->guest_entry);

    return 0;
}

// Run the VM
int run_vm(struct vmm_context *ctx) {
    while (1) {
        // VMRESUME resumes the guest
        int ret = asm_vmresume();

        if (ret == 0) {
            // VM exit occurred, handle it
            struct vm_exit *exit = &ctx->last_exit;
            handle_vm_exit(ctx, exit);
        } else {
            // VM entry failed
            fprintf(stderr, "VM entry failed: %d\n", ret);
            return -1;
        }
    }
}
```

## Vibe VMM: Hypervisor Abstraction

[Vibe VMM](https://github.com/lastweek/vibe-vmm) provides a clean hypervisor abstraction layer, supporting both Linux KVM and macOS HVF for cross-platform VM execution.

### Design Philosophy

**Minimal Core**
- Single-responsibility components
- Clear separation between platform code and generic logic
- No external dependencies beyond platform APIs

**Multi-Architecture Support**
- x86_64 Linux: Uses `/dev/kvm` ioctl interface
- x86_64 macOS: Uses `Hypervisor.framework`
- ARM64 macOS: Uses `Hypervisor.framework`

**VM Lifecycle**
```c
// Create a new VM
int vm_create(struct vmm **vmm_out) {
    struct vmm *vmm = calloc(1, sizeof(*vmm));
    if (!vmm) return -ENOMEM;

    // Initialize platform-specific hypervisor
    if (platform_init(vmm) != 0) {
        free(vmm);
        return -1;
    }

    // Create virtual CPU (vCPU)
    if (vcpu_create(vmm, &vmm->vcpu) != 0) {
        platform_cleanup(vmm);
        free(vmm);
        return -1;
    }

    *vmm_out = vmm;
    return 0;
}

// Map guest memory
int vm_map_mem(struct vmm *vmm, void *hva, size_t len) {
    // Allocate memory region
    struct mem_region *region = calloc(1, sizeof(*region));
    region->hva = hva;
    region->size = len;

    // Register with hypervisor (KVM: kvm_set_user_memory_region)
    platform_map_memory(vmm, region);

    // Add to VM's memory list
    list_add(&vmm->regions, region);
    return 0;
}

// Run the VM
int vm_run(struct vmm *vmm) {
    while (1) {
        // Run vCPU until exit
        struct vm_exit exit;
        int ret = platform_run_vcpu(vmm->vcpu, &exit);

        if (ret < 0) {
            // Error or shutdown
            return ret;
        }

        // Handle VM exit
        handle_vm_exit(vmm, &exit);
    }
}
```

### Virtio Device Emulation

Vibe VMM implements virtio device emulation in userspace:

```c
// Virtio block device read
int virtio_block_read(struct virtio_dev *dev, uint64_t sector,
                      void *buf, size_t len) {
    // Get virtqueue from device
    struct virtqueue *vq = &dev->vqs[VIRTIO_BLOCK_QUEUE];

    // Get available descriptor from guest
    struct vring_desc *desc;
    if (vq_get_avail(vq, &desc) != 0) {
        return -EAGAIN;  // No available descriptors
    }

    // Copy sector data to guest memory
    memcpy(buf, dev->backend->data + sector * 512, len);

    // Mark descriptor as used
    vq_add_used(vq, desc->index, len);

    // Notify guest (interrupt/KICK)
    if (dev->features & VIRTIO_F_EVENT_IDX) {
        vq_notify(vq);
    }

    return 0;
}
```

### SR-IOV VF Passthrough

Direct device assignment for high-performance I/O:

```c
// Assign a VF to a VM
int vfio_assign_device(struct vmm *vmm, const char *pci_addr) {
    // Open VFIO container
    int container = open("/dev/vfio/vfio", O_RDWR);

    // Get VFIO group for device
    int group = vfio_get_group(pci_addr);

    // Get device file descriptor
    int device = vfio_get_device_fd(group, pci_addr);

    // Get device info (IOMMU, regions, irqs)
    struct vfio_device_info info;
    ioctl(device, VFIO_DEVICE_GET_INFO, &info);

    // Map device BARs to guest
    for (int i = 0; i < info.num_regions; i++) {
        struct vfio_region_info reg;
        reg.argsz = sizeof(reg);
        reg.index = i;
        ioctl(device, VFIO_DEVICE_GET_REGION_INFO, &reg);

        // Map region to guest physical address
        platform_map_device_region(vmm, reg.offset, reg.size, i);
    }

    // Set up MSI-X interrupts
    for (int i = 0; i < info.num_irqs; i++) {
        struct vfio_irq_set irq;
        irq.argsz = sizeof(irq);
        irq.index = i;
        ioctl(device, VFIO_DEVICE_SET_IRQS, &irq);
    }

    return 0;
}
```

## Nano Sandbox: Container Runtime

[Nano Sandbox](https://github.com/lastweek/vibe-sandbox) is an OCI-compatible container runtime supporting both traditional Linux containers and Firecracker microVMs for stronger isolation.

### OCI Runtime Interface

Nano Sandbox implements the OCI runtime spec for standard container operations:

```c
// Create a container
int sandbox_create(const char *id, const char *bundle_path) {
    struct container *cnt = calloc(1, sizeof(*cnt));
    cnt->id = strdup(id);

    // Load OCI config.json
    char config_path[PATH_MAX];
    snprintf(config_path, sizeof(config_path), "%s/config.json", bundle_path);
    oci_load_config(config_path, &cnt->config);

    // Create container state directory
    char state_dir[PATH_MAX];
    snprintf(state_dir, sizeof(state_dir), "/var/run/sandbox/%s", id);
    mkdir(state_dir, 0755);

    // Persist container state
    cnt->state_file = fopen(state_dir, "w");
    save_container_state(cnt);

    return 0;
}

// Start a container
int sandbox_start(const char *id) {
    struct container *cnt = load_container(id);

    if (cnt->config.runtime == RUNTIME_FIRECRACKER) {
        return start_firecracker_container(cnt);
    } else {
        return start_native_container(cnt);
    }
}

// Native Linux container (namespaces + cgroups)
int start_native_container(struct container *cnt) {
    // Create new namespaces
    unshare(CLONE_NEWUTS |  // hostname
            CLONE_NEWPID |  // process IDs
            CLONE_NEWNS |   // mount
            CLONE_NEWNET |  // network
            CLONE_NEWIPC);  // IPC

    // Setup cgroup v2
    setup_cgroup(cnt->id, &cnt->config.linux_resources);

    // Setup root filesystem (pivot_root)
    setup_rootfs(cnt);

    // Execute container process
    execve(cnt->config.process.args[0],
           cnt->config.process.args,
           cnt->config.process.env);

    return 0;
}
```

### Linux Isolation Primitives

**Namespaces** (process isolation):
- `UTS`: hostname and domain name
- `PID`: process IDs
- `MOUNT`: filesystem mount points
- `NET`: network stack
- `IPC`: System V IPC and POSIX queues
- `USER`: user and group IDs

**cgroups v2** (resource control):
```c
// Set up cgroup for CPU and memory limits
int setup_cgroup(const char *name, struct linux_resources *res) {
    char cgroup_path[PATH_MAX];
    snprintf(cgroup_path, sizeof(cgroup_path),
             "/sys/fs/cgroup/%s", name);
    mkdir(cgroup_path, 0755);

    // CPU limit (e.g., 500000 = 0.5 CPU)
    if (res->cpu_quota) {
        char cpu_path[PATH_MAX];
        snprintf(cpu_path, sizeof(cpu_path),
                 "%s/cpu.max", cgroup_path);
        write_file(cpu_path, "%d %d",
                   res->cpu_quota, res->cpu_period);
    }

    // Memory limit (in bytes)
    if (res->memory_limit) {
        char mem_path[PATH_MAX];
        snprintf(mem_path, sizeof(mem_path),
                 "%s/memory.max", cgroup_path);
        write_file(mem_path, "%ld", res->memory_limit);
    }

    // Move current process into cgroup
    char procs_path[PATH_MAX];
    snprintf(procs_path, sizeof(procs_path), "%s/cgroup.procs", cgroup_path);
    write_file(procs_path, "%d", getpid());

    return 0;
}
```

**Mount Namespace** (filesystem isolation):
```c
// Setup container root filesystem
int setup_rootfs(struct container *cnt) {
    // Pivot to new root
    if (pivot_root(cnt->rootfs, cnt->rootfs) != 0) {
        return -1;
    }

    // Mount proc filesystem
    mount("proc", "/proc", "proc", 0, NULL);

    // Mount tmpfs for /tmp
    mount("tmpfs", "/tmp", "tmpfs", 0, NULL);

    // Bind mount specific directories if needed
    for (int i = 0; i < cnt->config.mounts.len; i++) {
        struct mount *m = &cnt->config.mounts.data[i];
        mount(m->source, m->destination, "none",
              MS_BIND | MS_REC, NULL);
    }

    return 0;
}
```

### Firecracker Integration

For stronger isolation, Nano Sandbox can run containers as Firecracker microVMs:

```c
// Start container in Firecracker microVM
int start_firecracker_container(struct container *cnt) {
    // Create VMM instance via Vibe VMM
    struct vmm *vmm;
    vm_create(&vmm);

    // Set up guest memory (e.g., 128 MB)
    void *mem = mmap(NULL, 128 << 20, PROT_READ | PROT_WRITE,
                     MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);
    vm_map_mem(vmm, mem, 128 << 20);

    // Load kernel+initrd (or use vmlinux+rootfs)
    load_kernel(vmm, "/boot/vmlinux-container");
    load_initrd(vmm, "/var/lib/sandbox/rootfs.img");

    // Configure virtio devices (console, block)
    setup_virtio_console(vmm);
    setup_virtio_block(vmm, cnt->rootfs);

    // Start the VM
    vm_run(vmm);

    return 0;
}
```

### Dual Execution Modes

| Mode | Isolation | Startup Time | Memory Overhead | Use Case |
|------|-----------|--------------|-----------------|----------|
| Pure-Container | Namespaces + cgroups | ~50ms | ~2MB | Trusted workloads, fast startup |
| Firecracker | Full VM (via Vibe VMM) | ~200ms | ~30MB | Untrusted code, strong isolation |

## AI Agent Deployment Scenarios

The virtualization stack supports multiple deployment patterns for AI agents:

### Scenario 1: Lightweight Agent Tasks

**Use case**: Rapid agent execution with minimal overhead

**Configuration**: Nano Sandbox pure-container mode

```bash
# Run agent in container (fast, lightweight)
sandbox run --name agent-task-123 \
    --memory 128m \
    --cpu 0.5 \
    --network bridge \
    agent-image:latest
```

**Characteristics**:
- Startup: ~50ms
- Memory overhead: ~2MB
- Isolation: Process-level (Linux namespaces)
- Security: Moderate (sufficient for trusted code)

### Scenario 2: Untrusted Code Execution

**Use case**: Running agent-provided code that cannot be trusted

**Configuration**: Nano Sandbox Firecracker mode

```bash
# Run agent in microVM (strong isolation)
sandbox run --name agent-untrusted-456 \
    --runtime firecracker \
    --memory 256m \
    --cpu 1.0 \
    --network none \
    --readonly-rootfs \
    agent-image:latest
```

**Characteristics**:
- Startup: ~200ms
- Memory overhead: ~30MB
- Isolation: Full VM (via Vibe VMM)
- Security: Strong (hardware-enforced)

### Scenario 3: High-Performance Compute

**Use case**: Agents requiring GPU or high-speed network access

**Configuration**: Vibe VMM with SR-IOV passthrough

```c
// Create VM with direct device access
struct vmm *vmm;
vm_create(&vmm);

// Assign GPU VF to VM
vfio_assign_device(vmm, "0000:01:00.1");

// Assign NIC VF for high-speed networking
vfio_assign_device(vmm, "0000:02:00.2");

// Run agent workload
vm_run(vmm);
```

**Characteristics**:
- Near-native performance (bypasses hypervisor)
- Direct hardware access
- Requires SR-IOV-capable hardware

### Performance vs Security Tradeoffs

| Scenario | Isolation | Performance | Overhead | Best For |
|----------|-----------|-------------|----------|----------|
| Pure Container | Low | Highest | Minimal | Trusted agents, high-density |
| Firecracker | High | Good | Moderate | Untrusted code, multi-tenant |
| Full VM + VFIO | Very High | Near-native | High | GPU/ML workloads |

## Technical Deep-Dive

### VMX Root vs Non-Root Operation

Intel VT-x introduces two modes of operation:

**VMX Root Operation** (Hypervisor)
- Full access to all CPU features
- Can execute VMX instructions (VMCALL, VMCLEAR, VMPTRLD, etc.)
- Controls VM behavior via VMCS
- Entered via VMXON instruction

**VMX Non-Root Operation** (Guest)
- Restricted subset of instructions
- Sensitive instructions cause VM exits
- Cannot access VMCS directly
- Transitions to root on VM exit

### VM Exit Handling

When a VM exit occurs, the processor saves state to the VMCS and transfers control to the hypervisor:

```c
void handle_vm_exit(struct vmm *vmm, struct vm_exit *exit) {
    switch (exit->reason) {
    case EXIT_REASON_EXTERNAL_INTERRUPT:
        // Handle interrupt, reinject if needed
        handle_interrupt(vmm, exit);
        break;

    case EXIT_REASON_IO_INSTRUCTION:
        // Emulate I/O instruction
        handle_io(vmm, exit);
        break;

    case EXIT_REASON_CR_ACCESS:
        // Handle control register access
        handle_cr_access(vmm, exit);
        break;

    case EXIT_REASON_CPUID:
        // Emulate CPUID instruction
        handle_cpuid(vmm, exit);
        break;

    case EXIT_REASON_VMCALL:
        // Hypercall from guest
        handle_hypercall(vmm, exit);
        break;

    case EXIT_REASON_EPT_VIOLATION:
        // Handle EPT violation (MMIO, nested paging)
        handle_ept_violation(vmm, exit);
        break;

    default:
        fprintf(stderr, "Unhandled VM exit: %d\n", exit->reason);
        vmm->running = false;
        break;
    }
}
```

### EPT (Extended Page Tables)

EPT provides second-level address translation for memory virtualization:

```
Guest Virtual Address (GVA)
        ↓ (Guest page tables)
Guest Physical Address (GPA)
        ↓ (EPT page tables)
Host Physical Address (HPA)
```

**Benefits**:
- Reduces VM exits for memory translation
- Guest manages its own page tables
- Hypervisor controls GPA → HPA mapping
- Supports memory overcommitment

### Virtio Device Model

Virtio uses virtqueues for efficient communication:

```
┌─────────────────────────────────────────────────────────┐
│ Guest                                                   │
│  ┌─────────────────────────────────────────────────────┤
│  │ Virtqueue                                           │
│  │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                  │
│  │  │Desc │ │Desc │ │Desc │ │Desc │ ...              │
│  │  └─────┘ └─────┘ └─────┘ └─────┘                  │
│  │    ↓       ↓       ↓       ↓                        │
│  │  ┌──────────────────────────────────────────────┐  │
│  │  │ Available Ring (guest → host)                │  │
│  │  └──────────────────────────────────────────────┘  │
│  │  ┌──────────────────────────────────────────────┐  │
│  │  │ Used Ring (host → guest)                     │  │
│  │  └──────────────────────────────────────────────┘  │
│  └─────────────────────────────────────────────────────┤
└─────────────────────────────────────────────────────────┘
         ↓ (shared memory via mmap)
┌─────────────────────────────────────────────────────────┐
│ Host (Hypervisor)                                       │
│  ┌─────────────────────────────────────────────────────┤
│  │ Device Backend                                     │
│  │  Reads from Available Ring, processes,            │
│  │  writes to Used Ring                               │
│  └─────────────────────────────────────────────────────┤
└─────────────────────────────────────────────────────────┘
```

### OCI Runtime Specification

Nano Sandbox implements the OCI runtime spec for compatibility:

**config.json structure**:
```json
{
  "ociVersion": "1.0.2",
  "process": {
    "terminal": true,
    "user": {
      "uid": 0,
      "gid": 0
    },
    "args": ["/bin/sh"],
    "env": ["PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"],
    "cwd": "/"
  },
  "root": {
    "path": "rootfs",
    "readonly": true
  },
  "hostname": "sandbox",
  "mounts": [
    {
      "destination": "/proc",
      "type": "proc",
      "source": "proc"
    },
    {
      "destination": "/dev",
      "type": "tmpfs",
      "source": "tmpfs"
    }
  ],
  "linux": {
    "resources": {
      "memory": {
        "limit": 134217728,
        "reservation": 67108864
      },
      "cpu": {
        "shares": 512,
        "quota": 500000,
        "period": 1000000
      }
    },
    "namespaces": [
      {
        "type": "pid"
      },
      {
        "type": "network"
      },
      {
        "type": "ipc"
      },
      {
        "type": "uts"
      },
      {
        "type": "mount"
      }
    ]
  }
}
```

### Firecracker MicroVM Architecture

Firecracker provides a minimal microVM for strong isolation:

```
┌────────────────────────────────────────────────────────────┐
│ Guest (Agent Container)                                    │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ Container Process                                    │  │
│  │  ┌─────────────────────────────────────────────────┤  │
│  │  │ Application Code                                 │  │
│  │  └─────────────────────────────────────────────────┤  │
│  └─────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
                        ↑ virtio-vsock
┌────────────────────────────────────────────────────────────┐
│ Firecracker VMM                                            │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ Virtio Device Emulation (block, net, vsock)         │  │
│  └─────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ KVM/HVF Hypervisor Interface                        │  │
│  └─────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
                        ↑ /dev/kvm or Hypervisor.framework
┌────────────────────────────────────────────────────────────┐
│ Host OS (Linux / macOS)                                   │
└────────────────────────────────────────────────────────────┘
```

**Key Features**:
- Minimal attack surface (~50k LOC)
- Sub-millisecond boot times
- Low memory overhead (~30MB per microVM)
- Strong isolation via hardware virtualization

### Performance Characteristics

**Startup Time**:
- Pure container: ~50ms (fork + namespaces)
- Firecracker: ~200ms (VM boot + container init)
- Full VM (Vibe VMM): ~300ms (device emulation overhead)

**Memory Overhead**:
- Pure container: ~2MB (cgroup + namespace data)
- Firecracker: ~30MB (guest memory + emulation)
- Full VM: ~128MB (typical guest allocation)

**Throughput**:
- Pure container: Near-native (direct syscalls)
- Firecracker: 95-98% of native (virtio overhead)
- Full VM + VFIO: 99%+ (direct device access)

## Learning Path

### Recommended Reading Order

1. **Start with Vibe KVM** to understand hardware virtualization fundamentals
   - Learn VMX operation modes
   - Study VMCS structure and management
   - Understand VM exit handling

2. **Move to Vibe VMM** to see how hypervisors are built
   - Examine VM lifecycle management
   - Study virtio device emulation
   - Learn cross-platform abstraction

3. **Explore Nano Sandbox** for container runtime implementation
   - Understand OCI runtime spec
   - Study Linux isolation primitives
   - Learn Firecracker integration

### Building Your Own VMM

Using concepts from Vibe KVM, you can build a minimal hypervisor:

1. **Initialize VMX**: Execute `VMXON` to enter VMX root operation
2. **Create VMCS**: Set up guest and host state
3. **Configure EPT**: Map guest physical to host physical memory
4. **Handle VM Exits**: Implement handlers for common exit reasons
5. **Add Devices**: Start with virtio console, then block/net

### Extending Nano Sandbox

Customize Nano Sandbox for specific AI agent workloads:

- **Custom networking**: Add VPN or mesh networking support
- **Resource profiles**: Pre-define CPU/memory for common agent types
- **Monitoring hooks**: Integrate with observability platforms
- **Snapshot/restore**: Save and restore agent state
- **Nested virtualization**: Run VMs inside containers

## Summary

The Vibe virtualization stack provides a complete foundation for running AI agents safely:

- **Vibe KVM**: Educational hardware virtualization (VT-x, EPT, Virtio)
- **Vibe VMM**: Cross-platform hypervisor with clean abstraction
- **Nano Sandbox**: OCI runtime with pure-container and Firecracker modes

Together, these projects enable multiple deployment scenarios from lightweight agent tasks to fully isolated untrusted code execution, with clear tradeoffs between performance and security.
