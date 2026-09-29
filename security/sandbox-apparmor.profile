#include <tunables/global>

# AppArmor profile for sandbox containers
# This profile restricts container access to host system resources
# while allowing normal development operations

profile sandbox-container flags=(attach_disconnected,mediate_deleted) {
  #include <abstractions/base>
  #include <abstractions/nameservice>
  #include <abstractions/user-tmp>

  # ============= Network Access =============
  # Network access is controlled by Docker networks, not AppArmor
  network,

  # ============= Capabilities =============
  # Allow standard container capabilities
  capability chown,
  capability dac_override,
  capability fowner,
  capability fsetid,
  capability kill,
  capability net_bind_service,
  capability setfcap,
  capability setgid,
  capability setuid,
  capability sys_chroot,
  capability audit_write,

  # ============= File Access =============
  # Allow read access to most system files
  / r,
  /** r,

  # Allow full access to workspace directory
  /workspace/** rwlk,

  # Allow access to home directories
  /home/** rwlk,
  /root/** rwlk,

  # Allow tmp access
  /tmp/** rwlk,
  /var/tmp/** rwlk,

  # Allow access to standard runtime directories
  /usr/** r,
  /lib/** r,
  /lib64/** r,
  /bin/** rix,
  /sbin/** rix,
  /usr/bin/** rix,
  /usr/sbin/** rix,
  /usr/local/** rix,

  # Allow access to /etc for configuration
  /etc/** r,
  /etc/passwd r,
  /etc/group r,
  /etc/shadow r,
  /etc/hosts r,
  /etc/resolv.conf r,

  # Allow writing to standard writable locations
  /var/log/** rw,
  /var/run/** rw,
  /run/** rw,

  # ============= Development Tools =============
  # Node.js
  /usr/bin/node rix,
  /usr/local/bin/node rix,
  /usr/bin/npm rix,
  /usr/local/bin/npm rix,
  /usr/bin/npx rix,
  /usr/local/bin/npx rix,
  owner @{HOME}/.npm/** rwlk,
  owner @{HOME}/.node/** rwlk,

  # Python
  /usr/bin/python* rix,
  /usr/local/bin/python* rix,
  /usr/bin/pip* rix,
  /usr/local/bin/pip* rix,
  owner @{HOME}/.local/** rwlk,
  owner @{HOME}/.cache/pip/** rwlk,

  # Rust
  /usr/bin/rustc rix,
  /usr/bin/cargo rix,
  owner @{HOME}/.cargo/** rwlk,
  owner @{HOME}/.rustup/** rwlk,

  # Go
  /usr/bin/go rix,
  /usr/local/go/** rix,
  owner @{HOME}/go/** rwlk,

  # Java
  /usr/bin/java rix,
  /usr/bin/javac rix,
  /usr/lib/jvm/** rix,

  # Git
  /usr/bin/git rix,
  owner @{HOME}/.gitconfig r,
  owner @{HOME}/.git-credentials r,

  # ============= Package Managers =============
  # APT
  /usr/bin/apt rix,
  /usr/bin/apt-get rix,
  /usr/bin/dpkg rix,
  /usr/lib/apt/** rix,
  /var/lib/apt/** rwlk,
  /var/cache/apt/** rwlk,
  /var/lib/dpkg/** rwlk,

  # ============= Process and Memory =============
  # Allow reading own proc entries
  @{PROC}/@{pid}/** r,
  @{PROC}/sys/kernel/random/uuid r,
  @{PROC}/sys/kernel/random/boot_id r,
  @{PROC}/sys/vm/overcommit_memory r,
  @{PROC}/sys/kernel/osrelease r,
  @{PROC}/meminfo r,
  @{PROC}/cpuinfo r,
  @{PROC}/stat r,
  @{PROC}/uptime r,
  @{PROC}/loadavg r,
  @{PROC}/filesystems r,

  # ============= Denied Access =============
  # Deny access to sensitive kernel interfaces
  deny @{PROC}/sys/kernel/core_pattern rw,
  deny @{PROC}/sys/kernel/modprobe rw,
  deny @{PROC}/sys/kernel/modules_disabled rw,
  deny @{PROC}/sysrq-trigger rw,
  deny @{PROC}/kcore r,
  deny @{PROC}/kallsyms r,

  # Deny access to host PID 1 (init)
  deny @{PROC}/1/** rw,

  # Deny access to kernel configuration
  deny /boot/** rw,
  deny /vmlinuz* r,
  deny /initrd* r,

  # Deny access to Docker socket
  deny /var/run/docker.sock rw,
  deny /run/docker.sock rw,

  # Deny device access except standard ones
  deny /dev/sd* rw,
  deny /dev/hd* rw,
  deny /dev/xvd* rw,
  deny /dev/nvme* rw,
  deny /dev/loop* rw,
  deny /dev/md* rw,
  deny /dev/dm-* rw,

  # Allow standard devices
  /dev/null rw,
  /dev/zero rw,
  /dev/full rw,
  /dev/random r,
  /dev/urandom r,
  /dev/tty rw,
  /dev/console rw,
  /dev/pts/* rw,
  /dev/ptmx rw,
  /dev/shm/** rw,

  # Deny mount operations
  deny mount,
  deny umount,
  deny pivot_root,

  # ============= Signals =============
  signal (send) peer=sandbox-container,
  signal (receive) peer=sandbox-container,
  signal (send) peer=unconfined,
  signal (receive) peer=unconfined,

  # ============= PTY/Terminal =============
  ptrace (read) peer=sandbox-container,
  ptrace (tracedby) peer=sandbox-container,

  # Deny ptrace to other processes
  deny ptrace (trace) peer=unconfined,
  deny ptrace (read) peer=unconfined,
}
