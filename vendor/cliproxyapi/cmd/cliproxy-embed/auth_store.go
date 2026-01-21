package main

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	coreauth "github.com/router-for-me/CLIProxyAPI/v6/sdk/cliproxy/auth"
)

const authStoreVersion = 1

type encryptedAuthEnvelope struct {
	Version    int    `json:"v"`
	Nonce      string `json:"nonce"`
	Ciphertext string `json:"ciphertext"`
}

type encryptedAuthPayload struct {
	Version int                          `json:"v"`
	Auths   map[string]*coreauth.Auth    `json:"auths"`
	Updated time.Time                    `json:"updated_at"`
}

type EncryptedAuthStore struct {
	mu      sync.Mutex
	path    string
	baseDir string
	key     []byte
	loaded  bool
	cache   map[string]*coreauth.Auth
}

func NewEncryptedAuthStore(path string, rawKey string) (*EncryptedAuthStore, error) {
	key, err := decodeAuthKey(rawKey)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(path) == "" {
		return nil, errors.New("auth store path is empty")
	}
	return &EncryptedAuthStore{
		path:  path,
		key:   key,
		cache: make(map[string]*coreauth.Auth),
	}, nil
}

func decodeAuthKey(raw string) ([]byte, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, errors.New("auth key is empty")
	}
	key, err := base64.StdEncoding.DecodeString(raw)
	if err != nil {
		return nil, fmt.Errorf("decode auth key: %w", err)
	}
	if len(key) != 32 {
		return nil, fmt.Errorf("auth key must be 32 bytes, got %d", len(key))
	}
	return key, nil
}

func (s *EncryptedAuthStore) SetBaseDir(dir string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.baseDir = strings.TrimSpace(dir)
	if s.baseDir == "" {
		return
	}
	_ = os.MkdirAll(s.baseDir, 0o700)
	_ = s.ensureLoadedLocked()
	_ = s.syncMirrorLocked()
}

func (s *EncryptedAuthStore) AuthDir() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.baseDir
}

func (s *EncryptedAuthStore) List(ctx context.Context) ([]*coreauth.Auth, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.ensureLoadedLocked(); err != nil {
		return nil, err
	}
	s.refreshAuthPathsLocked()
	out := make([]*coreauth.Auth, 0, len(s.cache))
	for _, auth := range s.cache {
		if auth == nil {
			continue
		}
		out = append(out, auth.Clone())
	}
	return out, nil
}

func (s *EncryptedAuthStore) Save(ctx context.Context, auth *coreauth.Auth) (string, error) {
	if auth == nil {
		return "", fmt.Errorf("auth store: auth is nil")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.ensureLoadedLocked(); err != nil {
		return "", err
	}

	clone := auth.Clone()
	if strings.TrimSpace(clone.ID) == "" {
		clone.ID = fallbackAuthID(clone)
	}

	var rawJSON []byte
	if len(clone.Metadata) == 0 {
		if clone.Storage == nil {
			return "", fmt.Errorf("auth store: missing metadata for %s", clone.ID)
		}
		meta, raw, err := storageToMetadata(clone.Storage)
		if err != nil {
			return "", err
		}
		clone.Metadata = meta
		rawJSON = raw
	} else {
		raw, err := json.Marshal(clone.Metadata)
		if err != nil {
			return "", fmt.Errorf("auth store: marshal metadata: %w", err)
		}
		rawJSON = raw
	}

	ensureMetadataDefaults(clone)
	clone.Storage = nil

	fileName := authFileName(clone)
	clone.FileName = fileName
	if clone.Attributes == nil {
		clone.Attributes = make(map[string]string)
	}
	if s.baseDir != "" {
		clone.Attributes["path"] = filepath.Join(s.baseDir, fileName)
	} else {
		delete(clone.Attributes, "path")
	}

	s.cache[clone.ID] = stripAuthPath(clone)
	if err := s.persistLocked(); err != nil {
		return "", err
	}
	if s.baseDir != "" {
		if err := writeMirrorFile(clone.Attributes["path"], rawJSON); err != nil {
			return "", err
		}
	}
	return clone.Attributes["path"], nil
}

func (s *EncryptedAuthStore) Delete(ctx context.Context, id string) error {
	id = strings.TrimSpace(id)
	if id == "" {
		return fmt.Errorf("auth store: id is empty")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.ensureLoadedLocked(); err != nil {
		return err
	}
	key := s.normalizeID(id)
	delete(s.cache, key)
	if err := s.persistLocked(); err != nil {
		return err
	}
	if s.baseDir != "" {
		path := s.resolvePathForID(id)
		if path != "" {
			_ = os.Remove(path)
		}
	}
	return nil
}

func (s *EncryptedAuthStore) PersistConfig(ctx context.Context) error {
	return nil
}

func (s *EncryptedAuthStore) PersistAuthFiles(ctx context.Context, message string, paths ...string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.ensureLoadedLocked(); err != nil {
		return err
	}
	for _, p := range paths {
		path := strings.TrimSpace(p)
		if path == "" {
			continue
		}
		info, err := os.Stat(path)
		if err != nil {
			if os.IsNotExist(err) {
				id := s.idForPath(path)
				delete(s.cache, id)
				continue
			}
			return fmt.Errorf("auth store: stat %s: %w", path, err)
		}
		if info.IsDir() {
			continue
		}
		data, err := os.ReadFile(path)
		if err != nil {
			return fmt.Errorf("auth store: read %s: %w", path, err)
		}
		if len(data) == 0 {
			continue
		}
		meta := make(map[string]any)
		if err := json.Unmarshal(data, &meta); err != nil {
			return fmt.Errorf("auth store: parse %s: %w", path, err)
		}
		auth := s.authFromMetadata(path, meta)
		s.cache[auth.ID] = stripAuthPath(auth)
	}
	return s.persistLocked()
}

func (s *EncryptedAuthStore) ensureLoadedLocked() error {
	if s.loaded {
		return nil
	}
	s.cache = make(map[string]*coreauth.Auth)
	data, err := os.ReadFile(s.path)
	if err != nil {
		if os.IsNotExist(err) {
			s.loaded = true
			return nil
		}
		return fmt.Errorf("auth store: read %s: %w", s.path, err)
	}
	if len(data) == 0 {
		s.loaded = true
		return nil
	}
	var envelope encryptedAuthEnvelope
	if err := json.Unmarshal(data, &envelope); err != nil {
		return fmt.Errorf("auth store: parse envelope: %w", err)
	}
	if envelope.Version == 0 {
		envelope.Version = authStoreVersion
	}
	if envelope.Version != authStoreVersion {
		return fmt.Errorf("auth store: unsupported version %d", envelope.Version)
	}
	nonce, err := base64.StdEncoding.DecodeString(envelope.Nonce)
	if err != nil {
		return fmt.Errorf("auth store: decode nonce: %w", err)
	}
	ciphertext, err := base64.StdEncoding.DecodeString(envelope.Ciphertext)
	if err != nil {
		return fmt.Errorf("auth store: decode ciphertext: %w", err)
	}
	plain, err := decryptPayload(s.key, nonce, ciphertext)
	if err != nil {
		return fmt.Errorf("auth store: decrypt payload: %w", err)
	}
	var payload encryptedAuthPayload
	if err := json.Unmarshal(plain, &payload); err != nil {
		return fmt.Errorf("auth store: parse payload: %w", err)
	}
	for id, auth := range payload.Auths {
		if auth == nil {
			continue
		}
		if strings.TrimSpace(auth.ID) == "" {
			auth.ID = id
		}
		ensureMetadataDefaults(auth)
		s.cache[auth.ID] = auth
	}
	s.loaded = true
	s.refreshAuthPathsLocked()
	return nil
}

func (s *EncryptedAuthStore) persistLocked() error {
	payload := encryptedAuthPayload{
		Version: authStoreVersion,
		Auths:   make(map[string]*coreauth.Auth),
		Updated: time.Now().UTC(),
	}
	for id, auth := range s.cache {
		if auth == nil {
			continue
		}
		clone := stripAuthPath(auth)
		if strings.TrimSpace(clone.ID) == "" {
			clone.ID = id
		}
		payload.Auths[id] = clone
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("auth store: marshal payload: %w", err)
	}
	nonce, ciphertext, err := encryptPayload(s.key, raw)
	if err != nil {
		return err
	}
	envelope := encryptedAuthEnvelope{
		Version:    authStoreVersion,
		Nonce:      base64.StdEncoding.EncodeToString(nonce),
		Ciphertext: base64.StdEncoding.EncodeToString(ciphertext),
	}
	out, err := json.MarshalIndent(envelope, "", "  ")
	if err != nil {
		return fmt.Errorf("auth store: marshal envelope: %w", err)
	}
	if err := os.MkdirAll(filepath.Dir(s.path), 0o700); err != nil {
		return fmt.Errorf("auth store: create dir: %w", err)
	}
	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, out, 0o600); err != nil {
		return fmt.Errorf("auth store: write temp: %w", err)
	}
	if err := os.Rename(tmp, s.path); err != nil {
		return fmt.Errorf("auth store: rename: %w", err)
	}
	return nil
}

func (s *EncryptedAuthStore) refreshAuthPathsLocked() {
	if s.baseDir == "" {
		return
	}
	for _, auth := range s.cache {
		if auth == nil {
			continue
		}
		fileName := authFileName(auth)
		auth.FileName = fileName
		if auth.Attributes == nil {
			auth.Attributes = make(map[string]string)
		}
		auth.Attributes["path"] = filepath.Join(s.baseDir, fileName)
	}
}

func (s *EncryptedAuthStore) syncMirrorLocked() error {
	if s.baseDir == "" {
		return nil
	}
	for _, auth := range s.cache {
		if auth == nil || auth.Metadata == nil {
			continue
		}
		fileName := authFileName(auth)
		path := filepath.Join(s.baseDir, fileName)
		raw, err := json.Marshal(auth.Metadata)
		if err != nil {
			return fmt.Errorf("auth store: marshal metadata: %w", err)
		}
		if err := writeMirrorFile(path, raw); err != nil {
			return err
		}
	}
	return nil
}

func (s *EncryptedAuthStore) idForPath(path string) string {
	if s.baseDir == "" {
		return filepath.Base(path)
	}
	rel, err := filepath.Rel(s.baseDir, path)
	if err != nil {
		return filepath.Base(path)
	}
	return rel
}

func (s *EncryptedAuthStore) normalizeID(id string) string {
	if s.baseDir == "" {
		return id
	}
	if filepath.IsAbs(id) {
		rel, err := filepath.Rel(s.baseDir, id)
		if err == nil && rel != "" && !strings.HasPrefix(rel, "..") {
			return rel
		}
	}
	return id
}

func (s *EncryptedAuthStore) resolvePathForID(id string) string {
	if s.baseDir == "" {
		return ""
	}
	clean := s.normalizeID(id)
	if clean == "" {
		return ""
	}
	return filepath.Join(s.baseDir, filepath.Base(clean))
}

func (s *EncryptedAuthStore) authFromMetadata(path string, meta map[string]any) *coreauth.Auth {
	now := time.Now().UTC()
	id := s.idForPath(path)
	provider := strings.TrimSpace(asString(meta["type"]))
	if provider == "" {
		provider = "unknown"
	}
	label := labelFromMetadata(meta)
	auth := &coreauth.Auth{
		ID:        id,
		Provider:  provider,
		FileName:  filepath.Base(path),
		Label:     label,
		Status:    coreauth.StatusActive,
		Metadata:  meta,
		UpdatedAt: now,
	}
	if auth.Attributes == nil {
		auth.Attributes = make(map[string]string)
	}
	auth.Attributes["path"] = path
	if existing, ok := s.cache[id]; ok && existing != nil {
		auth.CreatedAt = existing.CreatedAt
		auth.LastRefreshedAt = existing.LastRefreshedAt
		auth.NextRefreshAfter = existing.NextRefreshAfter
		auth.NextRetryAfter = existing.NextRetryAfter
		auth.ModelStates = existing.ModelStates
		auth.Quota = existing.Quota
		auth.Disabled = existing.Disabled
		auth.Unavailable = existing.Unavailable
		auth.Status = existing.Status
		auth.StatusMessage = existing.StatusMessage
		auth.LastError = existing.LastError
	} else {
		auth.CreatedAt = now
	}
	ensureMetadataDefaults(auth)
	return auth
}

func storageToMetadata(storage interface{ SaveTokenToFile(string) error }) (map[string]any, []byte, error) {
	tmp, err := os.CreateTemp("", "cliproxy-auth-*.json")
	if err != nil {
		return nil, nil, fmt.Errorf("auth store: create temp: %w", err)
	}
	tmpPath := tmp.Name()
	_ = tmp.Close()
	defer os.Remove(tmpPath)
	if err := storage.SaveTokenToFile(tmpPath); err != nil {
		return nil, nil, fmt.Errorf("auth store: save token: %w", err)
	}
	raw, err := os.ReadFile(tmpPath)
	if err != nil {
		return nil, nil, fmt.Errorf("auth store: read temp: %w", err)
	}
	if len(raw) == 0 {
		return nil, nil, errors.New("auth store: empty token payload")
	}
	meta := make(map[string]any)
	if err := json.Unmarshal(raw, &meta); err != nil {
		return nil, nil, fmt.Errorf("auth store: parse token: %w", err)
	}
	return meta, raw, nil
}

func ensureMetadataDefaults(auth *coreauth.Auth) {
	if auth == nil {
		return
	}
	if auth.Metadata != nil {
		if auth.Provider == "" {
			if t := strings.TrimSpace(asString(auth.Metadata["type"])); t != "" {
				auth.Provider = t
			}
		}
		if auth.Label == "" {
			if label := labelFromMetadata(auth.Metadata); label != "" {
				auth.Label = label
			}
		}
		if auth.Provider != "" {
			if _, ok := auth.Metadata["type"]; !ok {
				auth.Metadata["type"] = auth.Provider
			}
		}
	}
	// Ensure prefix is set for providers that need it
	if strings.TrimSpace(auth.Prefix) == "" {
		switch strings.ToLower(strings.TrimSpace(auth.Provider)) {
		case "antigravity":
			auth.Prefix = "antigravity"
		case "anthropic":
			auth.Prefix = "anthropic"
		}
	}
}

func authFileName(auth *coreauth.Auth) string {
	if auth == nil {
		return ""
	}
	if strings.TrimSpace(auth.FileName) != "" {
		return auth.FileName
	}
	if strings.TrimSpace(auth.ID) != "" {
		return filepath.Base(auth.ID)
	}
	return fmt.Sprintf("auth-%d.json", time.Now().UnixNano())
}

func fallbackAuthID(auth *coreauth.Auth) string {
	if auth == nil {
		return fmt.Sprintf("auth-%d.json", time.Now().UnixNano())
	}
	if auth.FileName != "" {
		return auth.FileName
	}
	return fmt.Sprintf("auth-%d.json", time.Now().UnixNano())
}

func labelFromMetadata(meta map[string]any) string {
	if meta == nil {
		return ""
	}
	if v := strings.TrimSpace(asString(meta["label"])); v != "" {
		return v
	}
	if v := strings.TrimSpace(asString(meta["email"])); v != "" {
		return v
	}
	if v := strings.TrimSpace(asString(meta["project_id"])); v != "" {
		return v
	}
	return ""
}

func asString(value any) string {
	if value == nil {
		return ""
	}
	if s, ok := value.(string); ok {
		return s
	}
	return fmt.Sprintf("%v", value)
}

func stripAuthPath(auth *coreauth.Auth) *coreauth.Auth {
	if auth == nil {
		return nil
	}
	clone := auth.Clone()
	if clone.Attributes != nil {
		delete(clone.Attributes, "path")
		delete(clone.Attributes, "source")
	}
	return clone
}

func writeMirrorFile(path string, data []byte) error {
	if strings.TrimSpace(path) == "" {
		return nil
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return fmt.Errorf("auth store: create dir: %w", err)
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		return fmt.Errorf("auth store: write temp file: %w", err)
	}
	if err := os.Rename(tmp, path); err != nil {
		return fmt.Errorf("auth store: rename temp: %w", err)
	}
	return nil
}

func encryptPayload(key, data []byte) ([]byte, []byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, nil, fmt.Errorf("auth store: new cipher: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, nil, fmt.Errorf("auth store: new gcm: %w", err)
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, nil, fmt.Errorf("auth store: nonce: %w", err)
	}
	ciphertext := gcm.Seal(nil, nonce, data, nil)
	return nonce, ciphertext, nil
}

func decryptPayload(key, nonce, ciphertext []byte) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("auth store: new cipher: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("auth store: new gcm: %w", err)
	}
	plain, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, fmt.Errorf("auth store: decrypt: %w", err)
	}
	return plain, nil
}
