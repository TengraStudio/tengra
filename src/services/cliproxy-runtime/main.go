package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	internalapi "github.com/router-for-me/CLIProxyAPI/v6/internal/api"
	"github.com/router-for-me/CLIProxyAPI/v6/internal/config"
	sdkaccess "github.com/router-for-me/CLIProxyAPI/v6/sdk/access"
	apihandlers "github.com/router-for-me/CLIProxyAPI/v6/sdk/api/handlers"
	sdkauth "github.com/router-for-me/CLIProxyAPI/v6/sdk/auth"
	coreauth "github.com/router-for-me/CLIProxyAPI/v6/sdk/cliproxy/auth"
)

func main() {
	runtimeConfig, err := parseRuntimeConfig()
	if err != nil {
		log.Fatalf("invalid runtime config: %v", err)
	}

	store, err := newHTTPAuthStore(runtimeConfig.authAPIPort, runtimeConfig.authAPIKey)
	if err != nil {
		log.Fatalf("failed to initialize auth store: %v", err)
	}
	sdkauth.RegisterTokenStore(store)

	cfg := &config.Config{
		CommercialMode: true,
		Debug:          false,
		Host:           "127.0.0.1",
		AuthDir:        runtimeConfig.authDir,
		LoggingToFile:  false,
		Port:           runtimeConfig.port,
	}
	cfg.RemoteManagement.DisableControlPanel = true
	cfg.RemoteManagement.PanelGitHubRepository = ""

	accessManager := sdkaccess.NewManager()
	accessManager.SetProviders([]sdkaccess.Provider{
		newRuntimeAccessProvider(runtimeConfig.proxyAPIKey),
	})

	authManager := coreauth.NewManager(sdkauth.GetTokenStore(), &coreauth.RoundRobinSelector{}, nil)
	authManager.SetRetryConfig(cfg.RequestRetry, time.Duration(cfg.MaxRetryInterval)*time.Second)
	if err := authManager.Load(context.Background()); err != nil {
		log.Printf("cliproxy-runtime: initial auth load failed: %v", err)
	}

	server := internalapi.NewServer(
		cfg,
		authManager,
		accessManager,
		"",
		internalapi.WithLocalManagementPassword(runtimeConfig.managementPassword),
		internalapi.WithRouterConfigurator(func(engine *gin.Engine, _ *apihandlers.BaseAPIHandler, _ *config.Config) {
			engine.GET("/healthz", func(c *gin.Context) { c.String(http.StatusOK, "ok") })
		}),
	)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go watchSignals(cancel)
	go startPeriodicAuthReload(ctx, authManager)

	stopDone := make(chan struct{})
	go func() {
		<-ctx.Done()
		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer shutdownCancel()
		if err := server.Stop(shutdownCtx); err != nil {
			log.Printf("cliproxy-runtime: graceful shutdown failed: %v", err)
		}
		close(stopDone)
	}()

	log.Printf("Starting Tengra CLIProxy runtime on port %d", cfg.Port)
	if err := server.Start(); err != nil {
		log.Fatalf("failed to start runtime server: %v", err)
	}

	<-stopDone
	log.Println("Tengra CLIProxy runtime stopped")
}

type runtimeConfig struct {
	authAPIKey         string
	authAPIPort        int
	authDir            string
	managementPassword string
	port               int
	proxyAPIKey        string
}

func parseRuntimeConfig() (runtimeConfig, error) {
	var cfg runtimeConfig

	flag.IntVar(&cfg.port, "port", 8317, "listen port")
	flag.StringVar(&cfg.authDir, "auth-dir", "", "auth working directory")
	flag.IntVar(&cfg.authAPIPort, "auth-api-port", 0, "auth API port")
	flag.StringVar(&cfg.authAPIKey, "auth-api-key", "", "auth API key")
	flag.StringVar(&cfg.proxyAPIKey, "proxy-api-key", "", "runtime proxy API key")
	flag.StringVar(&cfg.managementPassword, "management-password", "", "runtime localhost management password")
	flag.Parse()

	cfg.authDir = strings.TrimSpace(cfg.authDir)
	cfg.authAPIKey = strings.TrimSpace(cfg.authAPIKey)
	cfg.proxyAPIKey = strings.TrimSpace(cfg.proxyAPIKey)
	cfg.managementPassword = strings.TrimSpace(cfg.managementPassword)

	if cfg.port <= 0 {
		return runtimeConfig{}, fmt.Errorf("port must be greater than zero")
	}
	if cfg.authAPIPort <= 0 {
		return runtimeConfig{}, fmt.Errorf("auth-api-port must be greater than zero")
	}
	if cfg.proxyAPIKey == "" {
		return runtimeConfig{}, fmt.Errorf("proxy-api-key is required")
	}
	if cfg.managementPassword == "" {
		return runtimeConfig{}, fmt.Errorf("management-password is required")
	}

	return cfg, nil
}

func watchSignals(cancel context.CancelFunc) {
	signals := make(chan os.Signal, 1)
	signal.Notify(signals, syscall.SIGINT, syscall.SIGTERM)
	defer signal.Stop(signals)
	<-signals
	cancel()
}

func startPeriodicAuthReload(ctx context.Context, authManager *coreauth.Manager) {
	authManager.StartAutoRefresh(ctx, 15*time.Minute)

	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := authManager.Load(ctx); err != nil {
				log.Printf("cliproxy-runtime: periodic auth reload failed: %v", err)
			}
		}
	}
}
