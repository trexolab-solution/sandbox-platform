# Security Profiles for Sandbox Containers

This directory contains security profiles that restrict container capabilities and access to host system resources.

## Seccomp Profile

The `seccomp-profile.json` file defines which system calls are allowed for sandbox containers.

### Key Restrictions:
- **Blocked syscalls**: `ptrace`, `mount`, `umount`, `pivot_root`, `reboot`, `kexec_load`, module loading syscalls
- **Blocked namespaces**: `CLONE_NEWUSER` (prevents user namespace creation for potential privilege escalation)
- **Default action**: DENY - only explicitly allowed syscalls are permitted

### Usage:

1. Copy the seccomp profile to the Docker daemon's accessible location:
   ```bash
   sudo cp seccomp-profile.json /etc/docker/seccomp/sandbox-seccomp.json
   ```

2. The container service will automatically use this profile when creating containers by specifying:
   ```
   SecurityOpt: ["seccomp=/etc/docker/seccomp/sandbox-seccomp.json"]
   ```

## AppArmor Profile

The `sandbox-apparmor.profile` file defines filesystem, network, and capability restrictions.

### Key Restrictions:
- **Denied**: Access to Docker socket, host device nodes, kernel memory, init process
- **Denied**: Mount operations, ptrace to unconfined processes
- **Allowed**: Standard development tools, package managers, workspace directories

### Deployment:

1. Copy the profile to AppArmor profiles directory:
   ```bash
   sudo cp sandbox-apparmor.profile /etc/apparmor.d/sandbox-container
   ```

2. Load the profile:
   ```bash
   sudo apparmor_parser -r /etc/apparmor.d/sandbox-container
   ```

3. Verify it's loaded:
   ```bash
   sudo aa-status | grep sandbox-container
   ```

4. The container service will use this profile by specifying:
   ```
   SecurityOpt: ["apparmor=sandbox-container"]
   ```

### Reloading After Changes:

```bash
sudo apparmor_parser -r /etc/apparmor.d/sandbox-container
```

### Disabling (for debugging only):

```bash
sudo apparmor_parser -R /etc/apparmor.d/sandbox-container
```

## Verification

To verify profiles are working:

1. Create a sandbox container
2. Try running blocked operations:
   ```bash
   # Should fail with "Operation not permitted"
   mount -t tmpfs none /mnt

   # Should fail
   cat /proc/1/cmdline

   # Should fail if Docker socket exists
   ls -la /var/run/docker.sock
   ```

## Troubleshooting

### AppArmor Issues

Check AppArmor logs:
```bash
sudo dmesg | grep -i apparmor
journalctl -xe | grep -i apparmor
```

### Seccomp Issues

Check audit logs for blocked syscalls:
```bash
sudo ausearch -m SECCOMP
```

### Container Won't Start

If containers fail to start after enabling profiles:
1. Check Docker logs: `docker logs <container_id>`
2. Try running without the profile to isolate the issue
3. Add missing syscalls to the seccomp allow list if needed for specific applications

## Production Recommendations

1. **Test thoroughly** before deploying to production
2. **Monitor** AppArmor and seccomp denials initially
3. **Update profiles** as needed based on legitimate use cases
4. **Backup** existing configurations before changes
5. **Document** any custom additions for your environment
