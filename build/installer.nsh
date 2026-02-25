# Tengra Service Installer NSIS Include Script
# This script handles service registration during installation and cleanup during uninstallation

!macro customInstall
  # Register user-level services (no admin required)
  DetailPrint "Registering Tengra services..."

  # Create a temporary batch file to register services at startup
  FileOpen $0 "$INSTDIR\register-services.bat" w
  FileWrite $0 'powershell -ExecutionPolicy Bypass -File "$INSTDIR\scripts\register-services.ps1" -Silent$\r$\n'
  FileClose $0

  # Run service registration (user-level, no elevation needed)
  # The services are registered to run at user login via registry
  nsExec::ExecToLog 'powershell -ExecutionPolicy Bypass -Command "Start-Process powershell -ArgumentList ''-ExecutionPolicy Bypass -File """"$INSTDIR\scripts\register-services.ps1""""'' -NoNewWindow -Wait"'
  Pop $0

  # Delete temporary batch file
  Delete "$INSTDIR\register-services.bat"

  DetailPrint "Service registration complete."
!macroend

!macro customUnInstall
  # Stop and unregister services
  DetailPrint "Stopping Tengra services..."

  # Stop any running service processes
  nsExec::ExecToLog 'taskkill /f /im tengra-db-service.exe'
  nsExec::ExecToLog 'taskkill /f /im tengra-token-service.exe'
  nsExec::ExecToLog 'taskkill /f /im tengra-model-service.exe'
  nsExec::ExecToLog 'taskkill /f /im tengra-quota-service.exe'
  nsExec::ExecToLog 'taskkill /f /im tengra-memory-service.exe'

  # Remove registry entries for startup services
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "TengraTokenService"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "TengraModelService"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "TengraQuotaService"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "TengraMemoryService"

  # Clean up service port files
  RMDir /r "$LOCALAPPDATA\Tengra\services"

  DetailPrint "Service cleanup complete."
!macroend

