; Custom uninstallation logic to clean up background services
!macro customUnInstall
  DetailPrint "Removing Tengra background services..."
  nsExec::Exec 'schtasks /delete /tn "Tengra_tengra-proxy" /f'
  nsExec::Exec 'schtasks /delete /tn "Tengra_tengra-db-service" /f'
!macroend
