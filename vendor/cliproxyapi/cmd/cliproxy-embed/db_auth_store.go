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

// HTTPAuthStore reads auth tokens from the Electron app via HTTP API
type HTTPAuthStore struct {
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
	Type         string         `json:"type"`
	Email        string         `json:"email"`
	Label        string         `json:"label"`
	AccessToken  string         `json:"access_token"`
	RefreshToken string         `json:"refresh_token"`
	SessionToken string         `json:"session_token"`
	ExpiresAt    int64          `json:"expires_at"`
	Scope        string         `json:"scope"`
	Metadata     map[string]any `json:"metadata"`
	CreatedAt    int64          `json:"created_at"`
	UpdatedAt    int64          `json:"updated_at"`
}

// NewHTTPAuthStore creates a new HTTP-based auth store
func NewHTTPAuthStore(apiPort int, apiKey string) (*HTTPAuthStore, error) {
	if apiPort <= 0 {
		return nil, fmt.Errorf("invalid API port: %d", apiPort)
	}

	store := &HTTPAuthStore{
		apiURL: fmt.Sprintf("http://127.0.0.1:%d/api/auth/accounts", apiPort),
		apiKey: apiKey,
		cache:  make(map[string]*coreauth.Auth),
		client: &http.Client{
			Timeout: 5 * time.Second,
		},
	}

	// Initial load
	if err := store.sync(context.Background()); err != nil {
		return nil, fmt.Errorf("failed to sync auth: %w", err)
	}

	return store, nil
}

// List returns all active auth entries
func (s *HTTPAuthStore) List(ctx context.Context) ([]*coreauth.Auth, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	// Sync if cache is stale (older than 5 seconds)
	if time.Since(s.lastSync) > 5*time.Second {
		s.mu.RUnlock()
		if err := s.sync(ctx); err != nil {
			s.mu.RLock()
			// Continue with cached data on sync error
		} else {
			s.mu.RLock()
		}
	}

	out := make([]*coreauth.Auth, 0, len(s.cache))
	for _, auth := range s.cache {
		if auth != nil {
			out = append(out, auth.Clone())
		}
	}
	return out, nil
}

// Save pushes an auth update back to the Electron app
func (s *HTTPAuthStore) Save(ctx context.Context, auth *coreauth.Auth) (string, error) {
	log.Printf("[DEBUG] HTTPAuthStore.Save called for ID=%s, Provider=%s", auth.ID, auth.Provider)
	if auth == nil || auth.ID == "" {
		log.Printf("[DEBUG] HTTPAuthStore.Save: invalid auth - nil or missing ID")
		return "", fmt.Errorf("invalid auth: nil or missing ID")
	}

	url := fmt.Sprintf("%s/%s", s.apiURL, auth.ID)
	log.Printf("[DEBUG] HTTPAuthStore.Save: POSTing to URL=%s", url)

	// Map coreauth.Auth back to the format expected by the API
	// Note: We use auth.Metadata and top-level fields
	tokenData := map[string]any{
		"access_token":  auth.Metadata["access_token"],
		"refresh_token": auth.Metadata["refresh_token"],
		"session_token": auth.Metadata["session_token"],
		"expires_at":    auth.Metadata["expires_at"],
		"metadata":      auth.Metadata,
	}

	body, err := json.Marshal(tokenData)
	if err != nil {
		return "", fmt.Errorf("failed to marshal auth data: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, strings.NewReader(string(body)))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	if s.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+s.apiKey)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		log.Printf("[DEBUG] HTTPAuthStore.Save: HTTP error: %v", err)
		return "", fmt.Errorf("failed to send sync update: %w", err)
	}
	defer resp.Body.Close()

	log.Printf("[DEBUG] HTTPAuthStore.Save: Response status=%d", resp.StatusCode)
	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		log.Printf("[DEBUG] HTTPAuthStore.Save: Error response: %s", string(respBody))
		return "", fmt.Errorf("sync update failed with status %d: %s", resp.StatusCode, string(respBody))
	}
	log.Printf("[DEBUG] HTTPAuthStore.Save: Success! Token saved to database")

	// Update local cache
	s.mu.Lock()
	s.cache[auth.ID] = auth.Clone()
	s.mu.Unlock()

	return auth.ID, nil
}

// Delete is not supported for HTTP auth store (use the app's auth service)
func (s *HTTPAuthStore) Delete(ctx context.Context, id string) error {
	return fmt.Errorf("HTTP auth store delete not implemented")
}

// PersistConfig is not needed for HTTP auth store
func (s *HTTPAuthStore) PersistConfig(ctx context.Context) error {
	return nil
}

// IsHTTPBacked returns true to indicate this store communicates via HTTP API
// This is used as a marker interface to detect database-backed stores
func (s *HTTPAuthStore) IsHTTPBacked() bool {
	return true
}

// PersistAuthFiles triggers a sync when auth files would have been persisted
func (s *HTTPAuthStore) PersistAuthFiles(ctx context.Context, message string, paths ...string) error {
	return s.sync(ctx)
}

// sync fetches all active accounts from the HTTP API and updates the cache
func (s *HTTPAuthStore) sync(ctx context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	log.Printf("HTTPAuthStore: Syncing auth data from %s", s.apiURL)

	req, err := http.NewRequestWithContext(ctx, "GET", s.apiURL, nil)
	if err != nil {
		log.Printf("HTTPAuthStore: Failed to create request: %v", err)
		return fmt.Errorf("failed to create request: %w", err)
	}

	if s.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+s.apiKey)
	}

	resp, err := s.client.Do(req)
	if err != nil {
		log.Printf("HTTPAuthStore: Failed to fetch auth data: %v", err)
		return fmt.Errorf("failed to fetch auth data: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		log.Printf("HTTPAuthStore: HTTP error %d: %s", resp.StatusCode, string(body))
		return fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(body))
	}

	var apiResp authAPIResponse
	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
		log.Printf("HTTPAuthStore: Failed to decode response: %v", err)
		return fmt.Errorf("failed to decode response: %w", err)
	}

	log.Printf("HTTPAuthStore: Received %d accounts from API", len(apiResp.Accounts))

	newCache := make(map[string]*coreauth.Auth)
	now := time.Now().UTC()

	for _, acc := range apiResp.Accounts {
		// Build metadata
		metadata := acc.Metadata
		if metadata == nil {
			metadata = make(map[string]any)
		}

		// Ensure required fields in metadata
		metadata["type"] = acc.Provider
		if acc.Email != "" {
			metadata["email"] = acc.Email
		}
		if acc.AccessToken != "" {
			metadata["access_token"] = acc.AccessToken
		}
		if acc.RefreshToken != "" {
			metadata["refresh_token"] = acc.RefreshToken
		}
		if acc.SessionToken != "" {
			metadata["session_token"] = acc.SessionToken
		}
		if acc.ExpiresAt > 0 {
			metadata["expires_at"] = acc.ExpiresAt
		}
		if acc.Scope != "" {
			metadata["scope"] = acc.Scope
		}

		label := acc.Label
		if label == "" && acc.Email != "" {
			label = acc.Email
		}
		if label == "" {
			label = acc.Provider
		}

		// Determine prefix based on provider
		prefix := ""
		providerLower := strings.ToLower(strings.TrimSpace(acc.Provider))
		switch providerLower {
		case "antigravity":
			prefix = "antigravity"
		case "anthropic", "claude":
			prefix = "anthropic"
		case "codex", "openai":
			prefix = "codex"
		}

		auth := &coreauth.Auth{
			ID:        acc.ID,
			Provider:  acc.Provider,
			Label:     label,
			Prefix:    prefix,
			Status:    coreauth.StatusActive,
			Metadata:  metadata,
			CreatedAt: time.Unix(acc.CreatedAt/1000, 0).UTC(),
			UpdatedAt: time.Unix(acc.UpdatedAt/1000, 0).UTC(),
		}

		// Preserve state from existing cache entry
		if existing, ok := s.cache[acc.ID]; ok && existing != nil {
			// If the incoming timestamp is newer, clear previous error/unavailability states
			// to allow immediate recovery after re-authentication.
			if acc.UpdatedAt > existing.UpdatedAt.Unix()*1000 {
				log.Printf("HTTPAuthStore: Data for %s is newer, resetting failure states", acc.ID)
				auth.LastRefreshedAt = time.Time{}
				auth.NextRefreshAfter = time.Time{}
				auth.NextRetryAfter = time.Time{}
				auth.ModelStates = nil
				auth.Quota = coreauth.QuotaState{}
				auth.Disabled = false
				auth.Unavailable = false
				auth.StatusMessage = ""
				auth.LastError = nil
			} else {
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
		}

		newCache[acc.ID] = auth
		log.Printf("HTTPAuthStore: Cached auth for provider=%s, id=%s, prefix=%s", acc.Provider, acc.ID, prefix)
	}

	s.cache = newCache
	s.lastSync = now
	log.Printf("HTTPAuthStore: Sync complete, total cached: %d", len(s.cache))
	return nil
}
