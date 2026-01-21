package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/router-for-me/CLIProxyAPI/v6/sdk/api"
	"github.com/router-for-me/CLIProxyAPI/v6/sdk/api/handlers"
	sdkAuth "github.com/router-for-me/CLIProxyAPI/v6/sdk/auth"
	"github.com/router-for-me/CLIProxyAPI/v6/sdk/cliproxy"
	"github.com/router-for-me/CLIProxyAPI/v6/sdk/config"
	_ "github.com/router-for-me/CLIProxyAPI/v6/sdk/translator/builtin"
)

// Minimal embedded runner for CLIProxyAPI.
// Load config, start proxy, and keep it alive until the process is cancelled.
func main() {
	var configPath string
	var listenPort int
	var healthRoute bool
	var authStorePath string
	var authDir string
	var authAPIPort int
	var authAPIKey string

	flag.StringVar(&configPath, "config", "config.yaml", "Path to CLIProxyAPI config file")
	flag.IntVar(&listenPort, "port", 0, "Override listen port (optional)")
	flag.BoolVar(&healthRoute, "health", true, "Expose /healthz route")
	flag.StringVar(&authStorePath, "auth-store", "", "Path to encrypted auth store file")
	flag.StringVar(&authDir, "auth-dir", "", "Path to auth working directory (optional)")
	flag.IntVar(&authAPIPort, "auth-api-port", 0, "Port of Auth API HTTP server (for database auth)")
	flag.StringVar(&authAPIKey, "auth-api-key", "", "API key for Auth API HTTP server")
	flag.Parse()

	// Try to load .env from project root (4 levels up) or current dir
	_ = godotenv.Load("../../../../.env")
	_ = godotenv.Load()

	cfg, err := config.LoadConfig(configPath)
	if err != nil {
		log.Fatalf("load config: %v", err)
	}

	registerConfigAccessProvider()

	// Force-disable control panel downloads (no GitHub fetches in embed mode).
	cfg.RemoteManagement.DisableControlPanel = true
	cfg.RemoteManagement.PanelGitHubRepository = ""

	if authDir != "" {
		cfg.AuthDir = authDir
	}

	if listenPort > 0 {
		cfg.Port = listenPort
	}

	// Use HTTP auth store if auth API port is provided
	if authAPIPort > 0 {
		store, errStore := NewHTTPAuthStore(authAPIPort, authAPIKey)
		if errStore != nil {
			log.Fatalf("failed to initialize HTTP auth store: %v", errStore)
		}
		sdkAuth.RegisterTokenStore(store)
		log.Printf("Using HTTP auth store on port %d", authAPIPort)
	} else if authStorePath != "" {
		rawKey := strings.TrimSpace(os.Getenv("CLIPROXY_AUTH_KEY"))
		if rawKey == "" {
			log.Printf("auth store configured but CLIPROXY_AUTH_KEY is empty; falling back to default token store")
		} else {
			store, errStore := NewEncryptedAuthStore(authStorePath, rawKey)
			if errStore != nil {
				log.Printf("failed to initialize encrypted auth store: %v", errStore)
			} else {
				if cfg.AuthDir != "" {
					store.SetBaseDir(cfg.AuthDir)
				}
				sdkAuth.RegisterTokenStore(store)
			}
		}
	}

	builder := cliproxy.NewBuilder().
		WithConfig(cfg).
		WithConfigPath(configPath)

	if healthRoute {
		builder = builder.WithServerOptions(api.WithRouterConfigurator(func(engine *gin.Engine, _ *handlers.BaseAPIHandler, _ *config.Config) {
			engine.GET("/healthz", func(c *gin.Context) { c.String(200, "ok") })
		}))
	}

	svc, err := builder.Build()
	if err != nil {
		log.Fatalf("build proxy: %v", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go func() {
		ch := make(chan os.Signal, 1)
		signal.Notify(ch, syscall.SIGINT, syscall.SIGTERM)
		<-ch
		cancel()
	}()

	fmt.Printf("Starting CLIProxyAPI (embed) on port %d using %s\n", cfg.Port, absPath(configPath))
	if err := svc.Run(ctx); err != nil && err != context.Canceled {
		log.Fatalf("proxy stopped with error: %v", err)
	}
	fmt.Println("Proxy stopped")
}

func absPath(p string) string {
	if p == "" {
		return ""
	}
	abs, err := filepath.Abs(p)
	if err != nil {
		return p
	}
	return abs
}
