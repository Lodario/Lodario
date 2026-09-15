$ErrorActionPreference = 'Stop'
$taskWorkspace = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')).Path
$taskNode = (Get-Command node.exe).Source
$taskScript = Join-Path $taskWorkspace 'scripts/database/maintenance.mjs'
$taskName = 'Lodario daily backup and health check'
$taskAction = New-ScheduledTaskAction -Execute $taskNode -Argument ('"' + $taskScript + '"') -WorkingDirectory $taskWorkspace
$taskTriggers = @(New-ScheduledTaskTrigger -Daily -At '12:00'; New-ScheduledTaskTrigger -AtLogOn -User ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name))
$taskSettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 15) -MultipleInstances IgnoreNew
$taskPrincipal = New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
$task = New-ScheduledTask -Action $taskAction -Trigger $taskTriggers -Settings $taskSettings -Principal $taskPrincipal -Description 'Back up Lodario public/Auth/Storage metadata daily, remove expired backup files, and record public health status. Requires this PC, signed-in Windows user, network and Supabase CLI login. Stores no credentials in the task.'
$null = Register-ScheduledTask -TaskName $taskName -InputObject $task -Force
Get-ScheduledTask -TaskName $taskName | Select-Object TaskName,State
