package main

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/router-for-me/CLIProxyAPI/v6/internal/cdp"
	log "github.com/sirupsen/logrus"
)

func main() {
	log.SetLevel(log.DebugLevel)

	// Hardcoded for Opera based on user info
	userDataDir := filepath.Join(os.Getenv("APPDATA"), "Opera Software", "Opera Stable")
	binPath := filepath.Join(os.Getenv("LOCALAPPDATA"), "Programs", "Opera", "opera.exe")

	log.Infof("Testing CDP Extraction...")
	log.Infof("User Data: %s", userDataDir)
	log.Infof("Binary: %s", binPath)

	if _, err := os.Stat(binPath); err != nil {
		log.Errorf("Binary not found: %v", err)
	}

	key, err := cdp.ExtractSessionKey(userDataDir, binPath)
	if err != nil {
		log.Fatalf("Extraction failed: %v", err)
	}

	fmt.Printf("\nSUCCESS: Found Key: %s...\n", key[:10])
}
