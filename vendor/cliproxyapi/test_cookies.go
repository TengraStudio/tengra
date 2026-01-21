package main

import (
	"fmt"
	"github.com/router-for-me/CLIProxyAPI/v6/internal/util"
	log "github.com/sirupsen/logrus"
)

func main() {
	log.SetLevel(log.DebugLevel)
	fmt.Println("Testing cookie extraction from browser...")
	fmt.Println("==========================================")
	
	sessionKey, err := util.GetClaudeSessionKeyFromBrowser()
	if err != nil {
		fmt.Printf("❌ Error: %v\n", err)
		return
	}
	
	if sessionKey == "" {
		fmt.Println("⚠️  No sessionKey found")
		return
	}
	
	fmt.Printf("✅ Success! SessionKey: %s...\n", sessionKey[:20])
	fmt.Printf("Full key length: %d characters\n", len(sessionKey))
}
