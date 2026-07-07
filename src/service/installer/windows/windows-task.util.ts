import type { GeneratedFile, InstallerContext } from '../installer.types.js';

const TASK_NAME = 'PrintAgentService';

/**
 * Step 9 — Windows support via a hidden Scheduled Task rather than a true SCM service.
 *
 * A real Windows Service must implement the Service Control Handler protocol (respond to
 * SCM start/stop/pause control codes); a plain `node.exe` process doesn't, and wrapping it
 * properly needs a native shim (e.g. the `node-windows` package, which downloads/builds a
 * helper binary at install time). That's real OS integration this Linux-developed agent can't
 * build *or verify* here. A Scheduled Task triggered `ONSTART`, running the process hidden via
 * a small VBScript launcher, satisfies the actual requirement — starts at boot, no visible
 * console window, no manual launch — without an unverifiable native dependency. `node-windows`
 * is the documented upgrade path (see docs/SERVICE_MANAGEMENT.md) for full SCM compliance
 * (pause/continue, SCM-driven stop) if that's needed later.
 */
export function generateVbsLauncher(context: InstallerContext): string {
  return `Set shell = CreateObject("WScript.Shell")
shell.Run """${context.nodePath}"" ""${context.entryPoint}""", 0, False
`;
}

function installScript(): string {
  return `# Run in an elevated PowerShell prompt.
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$vbsPath = Join-Path $here "run-hidden.vbs"

$action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "\`"$vbsPath\`""
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName "${TASK_NAME}" -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force

Write-Host "Installed. It will start automatically at next boot, or run: Start-ScheduledTask -TaskName '${TASK_NAME}'"
`;
}

function uninstallScript(): string {
  return `# Run in an elevated PowerShell prompt.
Unregister-ScheduledTask -TaskName "${TASK_NAME}" -Confirm:$false
Write-Host "Uninstalled ${TASK_NAME}"
`;
}

function startScript(): string {
  return `Start-ScheduledTask -TaskName "${TASK_NAME}"
`;
}

function stopScript(context: InstallerContext): string {
  return `# Scheduled Tasks have no SCM "stop" signal, so this looks up the process by its
# command line (the entry point path is unique enough to identify it) and stops it.
$proc = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
  Where-Object { $_.CommandLine -like "*${context.entryPoint.replace(/\\/g, '\\\\')}*" }
if ($proc) {
  Stop-Process -Id $proc.ProcessId -Force
  Write-Host "Stopped print-agent (PID $($proc.ProcessId))"
} else {
  Write-Host "print-agent does not appear to be running"
}
`;
}

function restartScript(): string {
  return `& "$PSScriptRoot\\stop-service.ps1"
Start-Sleep -Seconds 2
& "$PSScriptRoot\\start-service.ps1"
`;
}

export function generateWindowsTaskFiles(context: InstallerContext): GeneratedFile[] {
  return [
    { relativePath: 'run-hidden.vbs', content: generateVbsLauncher(context) },
    { relativePath: 'install-service.ps1', content: installScript() },
    { relativePath: 'uninstall-service.ps1', content: uninstallScript() },
    { relativePath: 'start-service.ps1', content: startScript() },
    { relativePath: 'stop-service.ps1', content: stopScript(context) },
    { relativePath: 'restart-service.ps1', content: restartScript() },
  ];
}
