package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	coreauth "github.com/router-for-me/CLIProxyAPI/v6/sdk/cliproxy/auth"
)

type httpAuthStore struct {
	mu       sync.RWMutex
	apiURL   string
	apiKey   string
	cache    map[string]*coreauth.Auth
	lastSync time.Time
	client   *http.Client
}

type authAPIResponse struct {
	Accounts []authAPIAccount `json:"accounts"`
}

type authAPIAccount struct {
	ID           string         `json:"id"`
	Provider     string         `json:"provider"`
	Email        string         `json:"email"`
	Label        string         `json:"label"`
	Disabled     bool           `json:"disabled"`
	AccessToken  string         `json:"access_token"`
	RefreshToken string         `json:"refresh_token"`
	SessionToken string         `json:"session_token"`
	ExpiresAt    int64          `json:"expires_at"`
	Scope        string         `json:"scope"`
	Metadata     map[string]any `json:"metadata"`
	CreatedAt    int64          `json:"created_at"`
	UpdatedAt    int64          `json:"updated_at"`
}

func newHTTPAuthStore(apiPort int, apiKey string) (*httpAuthStore, error) {
	if apiPort <= 0 {
		return nil, fmt.Errorf("invalid API port: %d", apiPort)
	}

	store := &httpAuthStore{
		apiURL: fmt.Sprintf("http://127.0.0.1:%d/api/auth/accounts", apiPort),
		apiKey: strings.TrimSpace(apiKey),
		cache:  make(map[string]*coreauth.Auth),
		client: &http.Client{Timeout: 5 * time.Second},
	}

	if err := store.sync(context.Background()); err != nil {
		log.Printf("cliproxy-runtime: initial auth sync failed (will retry): %v", err)
	}

	return store, nil
}

func (s *httpAuthStore) List(ctx context.Context) ([]*coreauth.Auth, error) {
	s.mu.RLock()
	if time.Since(s.lastSync) > 5*time.Second {
		s.mu.RUnlock()
		if err := s.sync(ctx); err != nil {
			s.mu.RLock()
		} else {
			s.mu.RLock()
		}
	}
	defer s.mu.RUnlock()

	out := make([]*coreauth.Auth, 0, len(s.cache))
	for _, auth := range s.cache {
		if auth != nil {
			out = append(out, auth.Clone())
		}
	}
	return out, nil
}

func (s *httpAuthStore) Save(ctx context.Context, auth *coreauth.Auth) (string, error) {
	if auth == nil || auth.ID == "" {
		return "", fmt.Errorf("invalid auth payload")
	}

	body, err := json.Marshal(map[string]any{
		"provider":      auth.Provider,
		"type":          auth.Provider,
		"access_token":  auth.Metadata["access_token"],
		"refresh_token": auth.Metadata["refresh_token"],
		"session_token": auth.Metadata["session_token"],
		"expires_at":    auth.Metadata["expires_at"],
		"metadata":      auth.Metadata,
	})
	if err != nil {
		return "", fmt.Errorf("marshal auth payload: %w", err)
	}

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		fmt.Sprintf("%s/%s", s.apiURL, auth.ID),
		strings.NewReader(string(body)),
	)
	if err != nil {
		return "", fmt.Errorf("create auth save request: %w", err)
	}

	if s.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+s.apiKey)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("send auth save request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		data, _ := io.ReadAll(resp.Body)
		if resp.StatusCode == http.StatusNotFound && strings.Contains(string(data), "Account not found") {
			// New OAuth logins are persisted separately via the direct auth update channel.
			// Treat missing-account saves as a no-op so stale runtime callbacks do not recreate
			// deleted accounts and successful fresh logins do not emit noisy false-negative logs.
			s.mu.Lock()
			s.cache[auth.ID] = auth.Clone()
			s.mu.Unlock()
			return auth.ID, nil
		}
		return "", fmt.Errorf("auth save failed with status %d: %s", resp.StatusCode, string(data))
	}

	s.mu.Lock()
	s.cache[auth.ID] = auth.Clone()
	s.mu.Unlock()

	return auth.ID, nil
}

func (s *httpAuthStore) Delete(context.Context, string) error {
	return fmt.Errorf("HTTP auth store delete not implemented")
}

func (s *httpAuthStore) PersistConfig(context.Context) error {
	return nil
}

func (s *httpAuthStore) PersistAuthFiles(ctx context.Context, _ string, _ ...string) error {
	return s.sync(ctx)
}

func (s *httpAuthStore) sync(ctx context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, s.apiURL, nil)
	if err != nil {
		return fmt.Errorf("create auth sync request: %w", err)
	}

	if s.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+s.apiKey)
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("fetch auth accounts: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("auth sync failed with status %d: %s", resp.StatusCode, string(body))
	}

	var payload authAPIResponse
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return fmt.Errorf("decode auth accounts: %w", err)
	}

	nextCache := make(map[string]*coreauth.Auth, len(payload.Accounts))
	now := time.Now().UTC()

	for _, account := range payload.Accounts {
		metadata := account.Metadata
		if metadata == nil {
			metadata = make(map[string]any)
		}

		metadata["type"] = account.Provider
		if account.Email != "" {
			metadata["email"] = account.Email
		}
		if account.AccessToken != "" {
			metadata["access_token"] = account.AccessToken
		}
		if account.RefreshToken != "" {
			metadata["refresh_token"] = account.RefreshToken
		}
		if account.SessionToken != "" {
			metadata["session_token"] = account.SessionToken
		}
		if account.ExpiresAt > 0 {
			metadata["expires_at"] = account.ExpiresAt
		}
		if account.Scope != "" {
			metadata["scope"] = account.Scope
		}

		attributes := make(map[string]string)
		if apiKey, ok := metadata["api_key"].(string); ok {
			apiKey = strings.TrimSpace(apiKey)
			if apiKey != "" {
				attributes["api_key"] = apiKey
			}
		}
		if authType, ok := metadata["auth_type"].(string); ok {
			switch strings.ToLower(strings.TrimSpace(authType)) {
			case "api_key":
				attributes["auth_kind"] = "apikey"
			case "oauth":
				attributes["auth_kind"] = "oauth"
			}
		}

		label := account.Label
		if label == "" && account.Email != "" {
			label = account.Email
		}
		if label == "" {
			label = account.Provider
		}

		status := coreauth.StatusActive
		if account.Disabled {
			status = coreauth.StatusDisabled
		}

		auth := &coreauth.Auth{
			ID:         account.ID,
			Provider:   account.Provider,
			Label:      label,
			Status:     status,
			Disabled:   account.Disabled,
			Attributes: attributes,
			Metadata:   metadata,
			CreatedAt:  time.UnixMilli(account.CreatedAt).UTC(),
			UpdatedAt:  time.UnixMilli(account.UpdatedAt).UTC(),
		}

		if existing, ok := s.cache[account.ID]; ok && existing != nil && account.UpdatedAt <= existing.UpdatedAt.UnixMilli() {
			auth.LastRefreshedAt = existing.LastRefreshedAt
			auth.NextRefreshAfter = existing.NextRefreshAfter
			auth.NextRetryAfter = existing.NextRetryAfter
			auth.ModelStates = existing.ModelStates
			auth.Quota = existing.Quota
			auth.Disabled = existing.Disabled
			auth.Unavailable = existing.Unavailable
			auth.StatusMessage = existing.StatusMessage
			auth.LastError = existing.LastError
		}

		nextCache[account.ID] = auth
	}

	s.cache = nextCache
	s.lastSync = now
	return nil
}
