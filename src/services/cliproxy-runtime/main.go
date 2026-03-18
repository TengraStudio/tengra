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
	"github.com/router-for-me/CLIProxyAPI/v6/internal/registry"
	"github.com/router-for-me/CLIProxyAPI/v6/internal/runtime/executor"
	_ "github.com/router-for-me/CLIProxyAPI/v6/internal/translator"
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
		LoggingToFile:  false,
		Port:           runtimeConfig.port,
	}
	cfg.RemoteManagement.SecretKey = runtimeConfig.managementPassword
	cfg.RemoteManagement.DisableControlPanel = true
	cfg.RemoteManagement.PanelGitHubRepository = ""

	accessManager := sdkaccess.NewManager()
	accessManager.SetProviders([]sdkaccess.Provider{
		newRuntimeAccessProvider(runtimeConfig.proxyAPIKey),
	})

	authManager := coreauth.NewManager(sdkauth.GetTokenStore(), &coreauth.RoundRobinSelector{}, nil)
	authManager.SetRetryConfig(cfg.RequestRetry, time.Duration(cfg.MaxRetryInterval)*time.Second)
	registerRuntimeExecutors(authManager, cfg)
	if err := authManager.Load(context.Background()); err != nil {
		log.Printf("cliproxy-runtime: initial auth load failed: %v", err)
	}
	waitForRuntimeAuthWarmup(context.Background(), authManager, cfg)
	syncRuntimeModelRegistry(context.Background(), authManager, cfg)

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
	go startPeriodicAuthReload(ctx, authManager, cfg)

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
	managementPassword string
	port               int
	proxyAPIKey        string
}

func parseRuntimeConfig() (runtimeConfig, error) {
	var cfg runtimeConfig

	flag.IntVar(&cfg.port, "port", 8317, "listen port")
	flag.IntVar(&cfg.authAPIPort, "auth-api-port", 0, "auth API port")
	flag.StringVar(&cfg.authAPIKey, "auth-api-key", "", "auth API key")
	flag.StringVar(&cfg.proxyAPIKey, "proxy-api-key", "", "runtime proxy API key")
	flag.StringVar(&cfg.managementPassword, "management-password", "", "runtime localhost management password")
	flag.Parse()

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

func startPeriodicAuthReload(ctx context.Context, authManager *coreauth.Manager, cfg *config.Config) {
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
				continue
			}
			syncRuntimeModelRegistry(ctx, authManager, cfg)
		}
	}
}

func registerRuntimeExecutors(authManager *coreauth.Manager, cfg *config.Config) {
	if authManager == nil || cfg == nil {
		return
	}

	authManager.RegisterExecutor(executor.NewAntigravityExecutor(cfg))
	authManager.RegisterExecutor(executor.NewClaudeExecutor(cfg))
	authManager.RegisterExecutor(executor.NewCodexExecutor(cfg))
	authManager.RegisterExecutor(executor.NewGeminiExecutor(cfg))
}

func waitForRuntimeAuthWarmup(ctx context.Context, authManager *coreauth.Manager, cfg *config.Config) {
	if authManager == nil || cfg == nil {
		return
	}

	const maxAttempts = 10
	for attempt := 0; attempt < maxAttempts; attempt++ {
		if hasRuntimeProviderAuth(authManager, "antigravity") || hasRuntimeProviderAuth(authManager, "claude") || hasRuntimeProviderAuth(authManager, "codex") || hasRuntimeProviderAuth(authManager, "gemini") {
			return
		}

		if attempt > 0 {
			time.Sleep(500 * time.Millisecond)
		}

		if err := authManager.Load(ctx); err != nil {
			log.Printf("cliproxy-runtime: auth warmup load attempt %d failed: %v", attempt+1, err)
		}
	}
}

func hasRuntimeProviderAuth(authManager *coreauth.Manager, provider string) bool {
	if authManager == nil {
		return false
	}

	target := strings.ToLower(strings.TrimSpace(provider))
	for _, auth := range authManager.List() {
		if auth == nil || auth.Disabled {
			continue
		}
		if strings.ToLower(strings.TrimSpace(auth.Provider)) == target {
			return true
		}
	}
	return false
}

func syncRuntimeModelRegistry(ctx context.Context, authManager *coreauth.Manager, cfg *config.Config) {
	if authManager == nil || cfg == nil {
		return
	}

	modelRegistry := registry.GetGlobalRegistry()
	for _, auth := range authManager.List() {
		if auth == nil || auth.ID == "" {
			continue
		}

		modelRegistry.UnregisterClient(auth.ID)
		if auth.Disabled {
			continue
		}

		models := resolveModelsForAuth(ctx, auth, cfg)
		if len(models) == 0 {
			continue
		}

		modelRegistry.RegisterClient(auth.ID, strings.ToLower(strings.TrimSpace(auth.Provider)), models)
	}
}

func resolveModelsForAuth(ctx context.Context, auth *coreauth.Auth, cfg *config.Config) []*registry.ModelInfo {
	if auth == nil || cfg == nil {
		return nil
	}

	switch strings.ToLower(strings.TrimSpace(auth.Provider)) {
	case "antigravity":
		models := fetchAntigravityModels(ctx, auth, cfg)
		return models
	case "claude", "anthropic":
		return registry.GetClaudeModels()
	case "codex":
		return registry.GetOpenAIModels()
	case "gemini", "google":
		return registry.GetGeminiModels()
	default:
		return nil
	}
}

func fetchAntigravityModels(ctx context.Context, auth *coreauth.Auth, cfg *config.Config) []*registry.ModelInfo {
	if auth == nil || cfg == nil {
		return nil
	}

	requestCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	return executor.FetchAntigravityModels(requestCtx, auth, cfg)
}
 
