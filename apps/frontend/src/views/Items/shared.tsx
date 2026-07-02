"use client";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import { Box, Divider, Stack, Typography } from "@mui/material";

export const valueTypes = [
  { value: 0, label: "Float" },
  { value: 1, label: "String" },
  { value: 2, label: "Log" },
  { value: 3, label: "Integer" },
  { value: 4, label: "Text" },
];

export const httpMethods = [
  { value: 0, label: "GET" },
  { value: 1, label: "POST" },
  { value: 2, label: "PUT" },
  { value: 3, label: "HEAD" },
];

export const serviceTypes = [
  { value: "icmp_ping", label: "ICMP Ping", port: null, description: "Returns 0/1 — up or down" },
  {
    value: "icmp_loss",
    label: "ICMP Packet Loss",
    port: null,
    description: "Returns % packet loss",
  },
  {
    value: "icmp_time",
    label: "ICMP Response Time",
    port: null,
    description: "Returns round-trip time (s)",
  },
  { value: "http", label: "HTTP", port: 80, description: "TCP check on port 80" },
  { value: "https", label: "HTTPS", port: 443, description: "TCP check on port 443" },
  { value: "ssh", label: "SSH", port: 22, description: "TCP check on port 22" },
  { value: "smtp", label: "SMTP", port: 25, description: "TCP check on port 25" },
  { value: "ftp", label: "FTP", port: 21, description: "TCP check on port 21" },
  { value: "tcp_port", label: "TCP Port", port: null, description: "Custom TCP port check" },
  {
    value: "linux_process",
    label: "Linux Process",
    port: null,
    description: "Agent: proc.num[] — checks if a process is running",
  },
  {
    value: "windows_service",
    label: "Windows Service",
    port: null,
    description: "Agent: service.info[] — checks if a Windows service is running",
  },
];

export const icmpTypes = new Set(["icmp_ping", "icmp_loss", "icmp_time"]);
export const agentServiceTypes = new Set(["linux_process", "windows_service"]);

export const severities = [
  { value: 0, label: "None" },
  { value: 1, label: "Info" },
  { value: 2, label: "Low" },
  { value: 3, label: "Medium" },
  { value: 4, label: "High" },
  { value: 5, label: "Critical" },
];

export type ParamDef =
  | {
      type: "text";
      label: string;
      default?: string;
      placeholder?: string;
      helperText?: string;
      required?: boolean;
    }
  | {
      type: "select";
      label: string;
      default?: string;
      helperText?: string;
      required?: boolean;
      options: { value: string; label: string }[];
    };

export const KEY_PARAM_DEFS: Record<string, ParamDef[]> = {
  "system.cpu.util": [
    {
      type: "text",
      label: "CPU index",
      default: "",
      placeholder: "empty = all CPUs",
      helperText: "Leave empty for all CPUs, or specify index: 0, 1, 2…",
    },
    {
      type: "select",
      label: "Metric type",
      default: "",
      options: [
        { value: "", label: "Total (all types)" },
        { value: "user", label: "User" },
        { value: "system", label: "System" },
        { value: "idle", label: "Idle" },
        { value: "iowait", label: "I/O wait" },
        { value: "softirq", label: "Soft IRQ" },
        { value: "interrupt", label: "Interrupt" },
        { value: "nice", label: "Nice" },
      ],
    },
    {
      type: "select",
      label: "Averaging interval",
      default: "avg1",
      options: [
        { value: "avg1", label: "1-minute average" },
        { value: "avg5", label: "5-minute average" },
        { value: "avg15", label: "15-minute average" },
      ],
    },
  ],
  "system.cpu.load": [
    {
      type: "select",
      label: "CPU scope",
      default: "",
      options: [
        { value: "", label: "All CPUs (total load)" },
        { value: "percpu", label: "Per-CPU average" },
      ],
    },
    {
      type: "select",
      label: "Averaging interval",
      default: "avg1",
      options: [
        { value: "avg1", label: "1-minute average" },
        { value: "avg5", label: "5-minute average" },
        { value: "avg15", label: "15-minute average" },
      ],
    },
  ],
  "vfs.fs.size": [
    {
      type: "text",
      label: "Filesystem / mount point",
      default: "/",
      placeholder: "/",
      required: true,
      helperText: "e.g. / or /var or C: (Windows)",
    },
    {
      type: "select",
      label: "Metric",
      default: "pfree",
      options: [
        { value: "total", label: "Total (bytes)" },
        { value: "free", label: "Free (bytes)" },
        { value: "used", label: "Used (bytes)" },
        { value: "pfree", label: "Free (%)" },
        { value: "pused", label: "Used (%)" },
      ],
    },
  ],
  "vfs.fs.inode": [
    {
      type: "text",
      label: "Filesystem / mount point",
      default: "/",
      placeholder: "/",
      required: true,
    },
    {
      type: "select",
      label: "Metric",
      default: "pfree",
      options: [
        { value: "total", label: "Total inodes" },
        { value: "free", label: "Free inodes" },
        { value: "used", label: "Used inodes" },
        { value: "pfree", label: "Free (%)" },
        { value: "pused", label: "Used (%)" },
      ],
    },
  ],
  "vfs.dev.read": [
    {
      type: "text",
      label: "Device",
      default: "",
      placeholder: "empty = all devices",
      helperText: "e.g. sda, nvme0n1 — leave empty for all",
    },
    {
      type: "select",
      label: "Metric",
      default: "ops",
      options: [
        { value: "ops", label: "Operations / s" },
        { value: "bytes", label: "Bytes / s" },
        { value: "sps", label: "Sectors / s" },
        { value: "await", label: "Wait time (ms)" },
      ],
    },
  ],
  "vfs.dev.write": [
    {
      type: "text",
      label: "Device",
      default: "",
      placeholder: "empty = all devices",
      helperText: "e.g. sda, nvme0n1 — leave empty for all",
    },
    {
      type: "select",
      label: "Metric",
      default: "ops",
      options: [
        { value: "ops", label: "Operations / s" },
        { value: "bytes", label: "Bytes / s" },
        { value: "sps", label: "Sectors / s" },
        { value: "await", label: "Wait time (ms)" },
      ],
    },
  ],
  "net.if.in": [
    {
      type: "text",
      label: "Interface name",
      default: "eth0",
      placeholder: "eth0",
      required: true,
      helperText: "e.g. eth0, ens3, ens160",
    },
    {
      type: "select",
      label: "Metric",
      default: "bytes",
      options: [
        { value: "bytes", label: "Bytes / s" },
        { value: "packets", label: "Packets / s" },
        { value: "errors", label: "Errors / s" },
        { value: "dropped", label: "Dropped / s" },
      ],
    },
  ],
  "net.if.out": [
    {
      type: "text",
      label: "Interface name",
      default: "eth0",
      placeholder: "eth0",
      required: true,
      helperText: "e.g. eth0, ens3, ens160",
    },
    {
      type: "select",
      label: "Metric",
      default: "bytes",
      options: [
        { value: "bytes", label: "Bytes / s" },
        { value: "packets", label: "Packets / s" },
        { value: "errors", label: "Errors / s" },
        { value: "dropped", label: "Dropped / s" },
      ],
    },
  ],
  "net.if.total": [
    { type: "text", label: "Interface name", default: "eth0", placeholder: "eth0", required: true },
    {
      type: "select",
      label: "Metric",
      default: "bytes",
      options: [
        { value: "bytes", label: "Bytes / s" },
        { value: "packets", label: "Packets / s" },
        { value: "errors", label: "Errors / s" },
        { value: "dropped", label: "Dropped / s" },
      ],
    },
  ],
  "net.tcp.listen": [
    {
      type: "text",
      label: "Port",
      default: "80",
      placeholder: "80",
      required: true,
      helperText: "Returns 1 if listening, 0 if not",
    },
  ],
  "net.tcp.port": [
    {
      type: "text",
      label: "IP address",
      default: "",
      placeholder: "empty = host IP",
      helperText: "Leave empty to use the monitored host's address",
    },
    { type: "text", label: "Port", default: "80", placeholder: "80", required: true },
  ],
  "proc.num": [
    {
      type: "text",
      label: "Process name",
      default: "",
      placeholder: "e.g. nginx",
      helperText: "Leave empty to count all processes",
    },
    {
      type: "text",
      label: "Run-as user",
      default: "",
      placeholder: "e.g. www-data",
      helperText: "Optional: filter by owner username",
    },
    {
      type: "select",
      label: "Process state",
      default: "",
      options: [
        { value: "", label: "Any state" },
        { value: "run", label: "Running" },
        { value: "sleep", label: "Sleeping" },
        { value: "zomb", label: "Zombie" },
        { value: "disk", label: "Uninterruptible sleep (D)" },
      ],
    },
    {
      type: "text",
      label: "Command line regex",
      default: "",
      placeholder: "optional regex",
      helperText: "Optional: filter by matching command line",
    },
  ],
  "proc.mem": [
    { type: "text", label: "Process name", default: "", placeholder: "e.g. nginx", required: true },
    { type: "text", label: "Run-as user", default: "", placeholder: "optional" },
    {
      type: "select",
      label: "Memory metric",
      default: "rss",
      options: [
        { value: "rss", label: "RSS — resident set size" },
        { value: "vsize", label: "VSZ — virtual size" },
        { value: "pmem", label: "% of total memory" },
      ],
    },
  ],
  "proc.cpu.util": [
    { type: "text", label: "Process name", default: "", placeholder: "e.g. nginx", required: true },
    { type: "text", label: "Run-as user", default: "", placeholder: "optional" },
    {
      type: "select",
      label: "CPU metric",
      default: "",
      options: [
        { value: "", label: "Total (user + system)" },
        { value: "user", label: "User CPU only" },
        { value: "system", label: "System CPU only" },
      ],
    },
  ],
  "vm.memory.size": [
    {
      type: "select",
      label: "Metric",
      default: "available",
      options: [
        { value: "total", label: "Total (bytes)" },
        { value: "available", label: "Available (bytes)" },
        { value: "used", label: "Used (bytes)" },
        { value: "free", label: "Free (bytes)" },
        { value: "shared", label: "Shared (bytes)" },
        { value: "pavailable", label: "Available (%)" },
        { value: "pused", label: "Used (%)" },
      ],
    },
  ],
  "system.swap.size": [
    { type: "text", label: "Swap device", default: "", placeholder: "empty = all swap devices" },
    {
      type: "select",
      label: "Metric",
      default: "pfree",
      options: [
        { value: "total", label: "Total (bytes)" },
        { value: "free", label: "Free (bytes)" },
        { value: "used", label: "Used (bytes)" },
        { value: "pfree", label: "Free (%)" },
        { value: "pused", label: "Used (%)" },
      ],
    },
  ],
  "vfs.file.exists": [
    {
      type: "text",
      label: "File path",
      default: "",
      placeholder: "/var/run/app.pid",
      required: true,
      helperText: "Full absolute path to the file",
    },
  ],
  "vfs.file.size": [
    {
      type: "text",
      label: "File path",
      default: "",
      placeholder: "/var/log/app.log",
      required: true,
    },
  ],
  "vfs.file.contents": [
    { type: "text", label: "File path", default: "", placeholder: "/etc/hostname", required: true },
  ],
  "vfs.file.md5sum": [
    { type: "text", label: "File path", default: "", placeholder: "/etc/passwd", required: true },
  ],
  "vfs.file.cksum": [
    { type: "text", label: "File path", default: "", placeholder: "/etc/passwd", required: true },
  ],
  "vfs.file.time": [
    {
      type: "text",
      label: "File path",
      default: "",
      placeholder: "/var/log/app.log",
      required: true,
    },
    {
      type: "select",
      label: "Time type",
      default: "modify",
      options: [
        { value: "modify", label: "Last modified" },
        { value: "access", label: "Last accessed" },
        { value: "change", label: "Last changed (inode)" },
      ],
    },
  ],
  "vfs.file.regexp": [
    {
      type: "text",
      label: "File path",
      default: "",
      placeholder: "/var/log/app.log",
      required: true,
    },
    {
      type: "text",
      label: "Pattern (regex)",
      default: "",
      placeholder: "error|ERROR",
      required: true,
      helperText: "Regular expression to search for in file",
    },
    { type: "text", label: "Encoding", default: "", placeholder: "optional, e.g. UTF-8" },
    { type: "text", label: "Start line", default: "", placeholder: "optional" },
    { type: "text", label: "End line", default: "", placeholder: "optional" },
    {
      type: "text",
      label: "Output format",
      default: "",
      placeholder: "optional, e.g. \\1 for first group",
    },
  ],
  "service.info": [
    {
      type: "text",
      label: "Service name",
      default: "",
      placeholder: "e.g. MSSQLSERVER",
      required: true,
      helperText: "Windows service name (not the display name)",
    },
    {
      type: "select",
      label: "Parameter",
      default: "state",
      options: [
        { value: "state", label: "State (0 = running)" },
        { value: "displayname", label: "Display name" },
        { value: "path", label: "Executable path" },
        { value: "user", label: "Run-as user" },
        { value: "startup", label: "Startup type" },
        { value: "description", label: "Description" },
      ],
    },
  ],
  perf_counter: [
    {
      type: "text",
      label: "Counter path",
      default: "",
      placeholder: "\\\\Processor(_Total)\\\\% Processor Time",
      required: true,
      helperText: "Full Windows performance counter path",
    },
  ],
  eventlog: [
    {
      type: "text",
      label: "Log name",
      default: "System",
      placeholder: "System",
      required: true,
      helperText: "Windows event log: System, Application, Security…",
    },
    { type: "text", label: "Event source", default: "", placeholder: "optional" },
    {
      type: "select",
      label: "Severity",
      default: "Error",
      options: [
        { value: "", label: "Any" },
        { value: "Information", label: "Information" },
        { value: "Warning", label: "Warning" },
        { value: "Error", label: "Error" },
        { value: "FailureAudit", label: "Failure Audit" },
        { value: "SuccessAudit", label: "Success Audit" },
      ],
    },
  ],
};

export const assembleAgentKey = (base: string, params: string[]): string => {
  const trimmed = [...params];
  while (trimmed.length > 0 && trimmed[trimmed.length - 1] === "") trimmed.pop();
  return trimmed.length > 0 ? `${base}[${trimmed.join(",")}]` : base;
};

// Sorted by group so MUI Autocomplete groupBy works correctly.
export const COMMON_ITEM_KEYS = [
  // Agent
  { group: "Agent", key: "agent.ping", name: "Agent ping (1 = alive)", valueType: 3 },
  { group: "Agent", key: "agent.version", name: "Agent version", valueType: 1 },
  { group: "Agent", key: "agent.hostname", name: "Agent hostname", valueType: 1 },
  // CPU
  { group: "CPU", key: "system.cpu.util", name: "CPU utilization (%)", valueType: 0 },
  { group: "CPU", key: "system.cpu.util[,user]", name: "CPU user utilization (%)", valueType: 0 },
  {
    group: "CPU",
    key: "system.cpu.util[,system]",
    name: "CPU system utilization (%)",
    valueType: 0,
  },
  { group: "CPU", key: "system.cpu.util[,idle]", name: "CPU idle time (%)", valueType: 0 },
  { group: "CPU", key: "system.cpu.util[,iowait]", name: "CPU I/O wait (%)", valueType: 0 },
  { group: "CPU", key: "system.cpu.util[,softirq]", name: "CPU softirq (%)", valueType: 0 },
  {
    group: "CPU",
    key: "system.cpu.load[percpu,avg1]",
    name: "CPU load per core (1 min avg)",
    valueType: 0,
  },
  {
    group: "CPU",
    key: "system.cpu.load[percpu,avg5]",
    name: "CPU load per core (5 min avg)",
    valueType: 0,
  },
  {
    group: "CPU",
    key: "system.cpu.load[percpu,avg15]",
    name: "CPU load per core (15 min avg)",
    valueType: 0,
  },
  { group: "CPU", key: "system.cpu.num", name: "Number of CPUs", valueType: 3 },
  // Disk
  { group: "Disk", key: "vfs.fs.size[/,pfree]", name: "Free disk space on / (%)", valueType: 0 },
  { group: "Disk", key: "vfs.fs.size[/,pused]", name: "Used disk space on / (%)", valueType: 0 },
  { group: "Disk", key: "vfs.fs.size[/,free]", name: "Free disk space on / (bytes)", valueType: 3 },
  { group: "Disk", key: "vfs.fs.size[/,used]", name: "Used disk space on / (bytes)", valueType: 3 },
  {
    group: "Disk",
    key: "vfs.fs.size[/,total]",
    name: "Total disk space on / (bytes)",
    valueType: 3,
  },
  { group: "Disk", key: "vfs.fs.inode[/,pfree]", name: "Free inodes on / (%)", valueType: 0 },
  { group: "Disk", key: "vfs.dev.read[,ops]", name: "Disk read operations/s", valueType: 0 },
  { group: "Disk", key: "vfs.dev.write[,ops]", name: "Disk write operations/s", valueType: 0 },
  {
    group: "Disk",
    key: "vfs.dev.read[,bytes]",
    name: "Disk read throughput (bytes/s)",
    valueType: 0,
  },
  {
    group: "Disk",
    key: "vfs.dev.write[,bytes]",
    name: "Disk write throughput (bytes/s)",
    valueType: 0,
  },
  // File
  {
    group: "File",
    key: "vfs.file.exists[/path/to/file]",
    name: "File exists (1=yes, 0=no)",
    valueType: 3,
  },
  { group: "File", key: "vfs.file.size[/path/to/file]", name: "File size (bytes)", valueType: 3 },
  {
    group: "File",
    key: "vfs.file.time[/path/to/file,modify]",
    name: "File last modified (Unix timestamp)",
    valueType: 3,
  },
  {
    group: "File",
    key: "vfs.file.regexp[/path/to/file,pattern]",
    name: "Pattern found in file (1=yes)",
    valueType: 3,
  },
  {
    group: "File",
    key: "vfs.file.contents[/path/to/file]",
    name: "File contents (≤ 64 KB)",
    valueType: 1,
  },
  { group: "File", key: "vfs.file.md5sum[/path/to/file]", name: "File MD5 checksum", valueType: 1 },
  {
    group: "File",
    key: "vfs.file.cksum[/path/to/file]",
    name: "File CRC32 checksum",
    valueType: 3,
  },
  // Memory
  {
    group: "Memory",
    key: "vm.memory.size[available]",
    name: "Available memory (bytes)",
    valueType: 3,
  },
  {
    group: "Memory",
    key: "vm.memory.size[pavailable]",
    name: "Available memory (%)",
    valueType: 0,
  },
  { group: "Memory", key: "vm.memory.size[used]", name: "Used memory (bytes)", valueType: 3 },
  { group: "Memory", key: "vm.memory.size[pused]", name: "Used memory (%)", valueType: 0 },
  { group: "Memory", key: "vm.memory.size[total]", name: "Total memory (bytes)", valueType: 3 },
  { group: "Memory", key: "vm.memory.size[free]", name: "Free memory (bytes)", valueType: 3 },
  { group: "Memory", key: "system.swap.size[,pfree]", name: "Free swap (%)", valueType: 0 },
  { group: "Memory", key: "system.swap.size[,pused]", name: "Used swap (%)", valueType: 0 },
  { group: "Memory", key: "system.swap.size[,free]", name: "Free swap (bytes)", valueType: 3 },
  { group: "Memory", key: "system.swap.size[,used]", name: "Used swap (bytes)", valueType: 3 },
  { group: "Memory", key: "system.swap.size[,total]", name: "Total swap (bytes)", valueType: 3 },
  // Network
  {
    group: "Network",
    key: "net.if.in[eth0,bytes]",
    name: "Network in — eth0 (bytes/s)",
    valueType: 3,
  },
  {
    group: "Network",
    key: "net.if.out[eth0,bytes]",
    name: "Network out — eth0 (bytes/s)",
    valueType: 3,
  },
  {
    group: "Network",
    key: "net.if.total[eth0,bytes]",
    name: "Network total — eth0 (bytes/s)",
    valueType: 3,
  },
  {
    group: "Network",
    key: "net.if.in[eth0,packets]",
    name: "Network in — eth0 (packets/s)",
    valueType: 3,
  },
  {
    group: "Network",
    key: "net.if.out[eth0,packets]",
    name: "Network out — eth0 (packets/s)",
    valueType: 3,
  },
  {
    group: "Network",
    key: "net.if.in[eth0,errors]",
    name: "Network in errors — eth0",
    valueType: 3,
  },
  {
    group: "Network",
    key: "net.if.out[eth0,errors]",
    name: "Network out errors — eth0",
    valueType: 3,
  },
  {
    group: "Network",
    key: "net.if.in[eth0,dropped]",
    name: "Network in dropped — eth0",
    valueType: 3,
  },
  {
    group: "Network",
    key: "net.tcp.listen[80]",
    name: "TCP port 80 listening (0/1)",
    valueType: 3,
  },
  {
    group: "Network",
    key: "net.tcp.listen[443]",
    name: "TCP port 443 listening (0/1)",
    valueType: 3,
  },
  {
    group: "Network",
    key: "net.tcp.listen[22]",
    name: "TCP port 22 listening (0/1)",
    valueType: 3,
  },
  {
    group: "Network",
    key: "net.tcp.port[,80]",
    name: "TCP port 80 open check (0/1)",
    valueType: 3,
  },
  // Process
  { group: "Process", key: "proc.num[]", name: "Total processes", valueType: 3 },
  { group: "Process", key: "proc.num[,,,run]", name: "Processes in running state", valueType: 3 },
  { group: "Process", key: "proc.num[,,,sleep]", name: "Processes in sleep state", valueType: 3 },
  { group: "Process", key: "proc.num[,,,zomb]", name: "Zombie processes", valueType: 3 },
  {
    group: "Process",
    key: "proc.mem[nginx,,,,rss]",
    name: "Memory used by nginx (bytes)",
    valueType: 3,
  },
  { group: "Process", key: "proc.cpu.util[nginx]", name: "CPU used by nginx (%)", valueType: 0 },
  { group: "Process", key: "proc.num[sshd]", name: "sshd process count", valueType: 3 },
  // System
  { group: "System", key: "system.uptime", name: "System uptime (seconds)", valueType: 3 },
  { group: "System", key: "system.hostname", name: "System hostname", valueType: 1 },
  { group: "System", key: "system.uname", name: "OS name (uname)", valueType: 1 },
  { group: "System", key: "system.localtime", name: "Local time (Unix timestamp)", valueType: 3 },
  { group: "System", key: "system.users.num", name: "Logged-in user count", valueType: 3 },
  { group: "System", key: "system.boottime", name: "Boot time (Unix timestamp)", valueType: 3 },
  // Windows
  { group: "Windows", key: "vfs.fs.size[C:,pfree]", name: "C: free space (%)", valueType: 0 },
  { group: "Windows", key: "vfs.fs.size[C:,pused]", name: "C: used space (%)", valueType: 0 },
  { group: "Windows", key: "vfs.fs.size[C:,free]", name: "C: free space (bytes)", valueType: 3 },
  { group: "Windows", key: "vfs.fs.size[D:,pfree]", name: "D: free space (%)", valueType: 0 },
  {
    group: "Windows",
    key: "service.info[service_name,state]",
    name: "Windows service state",
    valueType: 3,
  },
  {
    group: "Windows",
    key: "perf_counter[\\Processor(_Total)\\% Processor Time]",
    name: "Windows CPU usage (%)",
    valueType: 0,
  },
  {
    group: "Windows",
    key: "perf_counter[\\Memory\\Available MBytes]",
    name: "Windows available memory (MB)",
    valueType: 0,
  },
  {
    group: "Windows",
    key: "perf_counter[\\LogicalDisk(C:)\\% Free Space]",
    name: "Windows C: free space (%)",
    valueType: 0,
  },
  {
    group: "Windows",
    key: "eventlog[System,,Error]",
    name: "Windows System event log (errors)",
    valueType: 2,
  },
  {
    group: "Windows",
    key: "eventlog[Application,,Error]",
    name: "Windows Application event log (errors)",
    valueType: 2,
  },
  {
    group: "Windows",
    key: "vfs.file.exists[C:\\path\\to\\file.txt]",
    name: "File exists on Windows path (1/0)",
    valueType: 3,
  },
];

export type DbMetric = {
  value: string;
  label: string;
  vtype: number;
  hasExtra: boolean;
  extraLabel?: string;
};
export const DB_AGENT2_METRICS: Record<string, DbMetric[]> = {
  postgresql: [
    { value: "ping", label: "Ping (1=up, 0=down)", vtype: 3, hasExtra: false },
    { value: "version", label: "Server version", vtype: 4, hasExtra: false },
    { value: "connections", label: "Connection stats (JSON)", vtype: 4, hasExtra: false },
    {
      value: "db_size",
      label: "Database size (bytes)",
      vtype: 3,
      hasExtra: true,
      extraLabel: "Database name",
    },
  ],
  mysql: [
    { value: "ping", label: "Ping (1=up, 0=down)", vtype: 3, hasExtra: false },
    { value: "version", label: "Server version", vtype: 4, hasExtra: false },
    { value: "connections", label: "Active connections", vtype: 3, hasExtra: false },
    {
      value: "db_size",
      label: "Database size (bytes)",
      vtype: 3,
      hasExtra: true,
      extraLabel: "Database name",
    },
  ],
  mongodb: [
    { value: "ping", label: "Ping (1=up, 0=down)", vtype: 3, hasExtra: false },
    { value: "version", label: "Server version", vtype: 4, hasExtra: false },
    { value: "connections", label: "Current connections", vtype: 3, hasExtra: false },
  ],
  mssql: [
    { value: "ping", label: "Ping (1=up, 0=down)", vtype: 3, hasExtra: false },
    { value: "version", label: "Server version", vtype: 4, hasExtra: false },
    { value: "connections", label: "Active connections", vtype: 3, hasExtra: false },
  ],
};

export type BulkResult = { hostname: string; item_id: string | null; error: string | null };
export type Item = {
  itemid: string;
  name: string;
  key_: string;
  value_type: string;
  delay: string;
};
export type AllItem = {
  itemid: string;
  name: string;
  key_: string;
  value_type: string;
  delay: string;
  status: string;
  state: string;
  hostname: string;
  tags: Array<{ tag: string; value: string }>;
  lastvalue: string;
  lastclock: number | null;
  templateid: string;
};

export const timeAgo = (ts: number | null): string => {
  if (!ts) return "";
  const secs = Math.floor(Date.now() / 1000) - ts;
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
};

// Parse a Zabbix delay string (e.g. "30s", "1m", "5m", "0") to seconds.
// Returns 0 for unparseable / passive items so we skip staleness checks.
export const parseDelaySecs = (delay: string): number => {
  if (!delay || delay === "0") return 0;
  const m = delay.match(/^(\d+)([smhd]?)$/i);
  if (!m) return 0;
  const n = Number.parseInt(m[1], 10);
  const unit = (m[2] || "s").toLowerCase();
  if (unit === "m") return n * 60;
  if (unit === "h") return n * 3600;
  if (unit === "d") return n * 86400;
  return n;
};

// An item is stale when Zabbix hasn't collected a value in >3× the polling interval.
// We use 3× as a buffer to allow for slight delays and missed polls.
export const isItemStale = (item: AllItem): boolean => {
  if (item.state === "1") return false; // "Not Supported" has its own chip
  const delaySecs = parseDelaySecs(item.delay);
  if (delaySecs === 0) return false; // passive / dependent / no-interval item
  if (!item.lastclock) return true; // never collected any data
  return Math.floor(Date.now() / 1000) - item.lastclock > delaySecs * 3;
};

// ── Bulk results list ─────────────────────────────────────────────────

export const BulkResults = ({ results, label }: { results: BulkResult[]; label: string }) => {
  const ok = results.filter((r) => !r.error).length;
  return (
    <Box
      sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1.5, overflow: "hidden" }}
    >
      <Box
        sx={{
          px: 1.5,
          py: 1,
          bgcolor: "action.hover",
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Typography variant="caption" sx={{ fontWeight: 700 }}>
          {label}: {ok}/{results.length} succeeded
        </Typography>
      </Box>
      <Stack divider={<Divider />}>
        {results.map((r) => (
          <Box
            key={r.hostname}
            sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 0.75 }}
          >
            {r.error ? (
              <ErrorOutlineIcon sx={{ fontSize: 16, color: "error.main", flexShrink: 0 }} />
            ) : (
              <CheckCircleOutlineIcon sx={{ fontSize: 16, color: "success.main", flexShrink: 0 }} />
            )}
            <Typography variant="body2" sx={{ flex: 1, fontWeight: 500 }} noWrap>
              {r.hostname}
            </Typography>
            {r.error && (
              <Typography variant="caption" color="error.main" noWrap sx={{ maxWidth: 260 }}>
                {r.error}
              </Typography>
            )}
          </Box>
        ))}
      </Stack>
    </Box>
  );
};

export type ServerItemKey = {
  key: string;
  name: string;
  valueType: number;
  group: string;
  delay?: string;
  units?: string;
  history?: string;
  trends?: string;
  description?: string;
};
