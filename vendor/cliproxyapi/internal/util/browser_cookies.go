package util

import (
	"crypto/aes"
	"crypto/cipher"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"
	"unsafe"

	_ "github.com/mattn/go-sqlite3"
	"github.com/router-for-me/CLIProxyAPI/v6/internal/cdp"
	log "github.com/sirupsen/logrus"
	"golang.org/x/sys/windows"
)

// BrowserCookie represents a cookie extracted from a browser
type BrowserCookie struct {
	Name     string
	Value    string
	Domain   string
	Path     string
	Expires  int64
	Secure   bool
	HttpOnly bool
}

type LocalState struct {
	OsCrypt struct {
		EncryptedKey         string `json:"encrypted_key"`
		AppBoundEncryptedKey string `json:"app_bound_encrypted_key"`
	} `json:"os_crypt"`
}

var (
	masterKeys      = make(map[string][]byte)
	masterKeysMutex sync.Mutex
)

// GetClaudeSessionKeyFromBrowser attempts to extract the sessionKey cookie
// from the user's default browser cookie database
func GetClaudeSessionKeyFromBrowser() (string, error) {
	browsers := []struct {
		name string
		path string
	}{
		{"Chrome", getChromeProfilePath()},
		{"Edge", getEdgeProfilePath()},
		{"Opera", getOperaProfilePath()},
		{"OperaGX", getOperaGXProfilePath()},
		{"Brave", getBraveProfilePath()},
	}

	log.Info("Starting browser cookie extraction...")
	var lastErr error

	for _, browser := range browsers {
		if browser.path == "" {
			log.Debugf("Skipping %s - path not found", browser.name)
			continue
		}

		cookiesPath := filepath.Join(browser.path, "Network", "Cookies")
		if _, err := os.Stat(cookiesPath); os.IsNotExist(err) {
			// Fallback to old path
			cookiesPath = filepath.Join(browser.path, "Cookies")
			if _, err := os.Stat(cookiesPath); os.IsNotExist(err) {
				log.Debugf("Skipping %s - cookies file does not exist at %s or Network/Cookies", browser.name, cookiesPath)
				continue
			}
		}

		log.Infof("Trying to read cookies from %s: %s", browser.name, cookiesPath)

		// Get master key for this browser (cached)
		key, err := getMasterKey(filepath.Dir(browser.path)) // Parent of Default is User Data
		if err != nil {
			log.Warnf("Failed to get master key for %s: %v", browser.name, err)
			continue
		}

		// Check if we already got the key via CDP (Bypass)
		keyStr := string(key)
		if strings.HasPrefix(keyStr, "CDP_BYPASS_KEY:") {
			sessionKey := strings.TrimPrefix(keyStr, "CDP_BYPASS_KEY:")
			log.Infof("Directly returning sessionKey extracted via CDP for %s", browser.name)
			return sessionKey, nil
		}

		sessionKey, err := extractSessionKeyFromCookieDB(cookiesPath, key)
		if err != nil {
			log.Warnf("Failed to extract from %s: %v", browser.name, err)
			lastErr = err
			continue
		}

		if sessionKey != "" {
			log.Infof("Successfully extracted sessionKey from %s", browser.name)
			return sessionKey, nil
		}
	}

	if lastErr != nil {
		return "", fmt.Errorf("sessionKey not found in any browser (last error: %v)", lastErr)
	}
	return "", fmt.Errorf("sessionKey not found in any browser")
}

func extractSessionKeyFromCookieDB(dbPath string, masterKey []byte) (string, error) {
	// Create a temp copy to avoid locking issues
	// usage of 'copyFile' handles shared reading
	tempDB := filepath.Join(os.TempDir(), fmt.Sprintf("orbit_cookies_%d.db", time.Now().UnixNano()))
	defer os.Remove(tempDB)

	if err := copyFile(dbPath, tempDB); err != nil {
		// Attempt to kill browser process if file is locked
		log.Warnf("Failed to copy cookie DB (%v), attempting to close browser to release lock...", err)
		if killed := killBrowserForPath(dbPath); killed {
			time.Sleep(2 * time.Second) // Wait for lock release
			if errRetry := copyFile(dbPath, tempDB); errRetry != nil {
				return "", fmt.Errorf("failed to create shadow copy even after killing browser: %w", errRetry)
			}
		} else {
			return "", fmt.Errorf("failed to create shadow copy: %w", err)
		}
	}

	db, err := sql.Open("sqlite3", fmt.Sprintf("file:%s?mode=ro&immutable=1", filepath.ToSlash(tempDB)))
	if err != nil {
		return "", fmt.Errorf("failed to open cookie database: %w", err)
	}
	defer db.Close()

	// Query for sessionKey cookie from claude.ai
	// Use wide query to ensure we don't miss it due to SQL exact match issues
	query := `SELECT name, value, encrypted_value, host_key FROM cookies 
	          WHERE host_key LIKE '%claude.ai%' OR host_key LIKE '%.anthropic.com%'
	          ORDER BY creation_utc DESC LIMIT 500`

	rows, err := db.Query(query)
	if err != nil {
		return "", fmt.Errorf("database query failed: %w", err)
	}
	defer rows.Close()

	foundAny := false
	rowCount := 0
	for rows.Next() {
		rowCount++
		var name, value, hostKey string
		var encryptedValue []byte
		if err := rows.Scan(&name, &value, &encryptedValue, &hostKey); err != nil {
			continue
		}
		foundAny = true

		if rowCount <= 15 {
			log.Infof("Candidate #%d: name='%s' host='%s' encrypted_len=%d", rowCount, name, hostKey, len(encryptedValue))
		}

		// Filter for sessionKey
		if name != "sessionKey" {
			continue
		}

		if strings.HasPrefix(value, "sk-ant-sid") {
			log.Infof("Found plaintext sessionKey for %s", hostKey)
			return value, nil
		}

		// 2. Try Decryption
		if len(encryptedValue) > 0 {
			if masterKey == nil {
				log.Warnf("Master key is nil for %s, cannot decrypt v10 cookie", hostKey)
			}
			decrypted, err := decryptValue(encryptedValue, masterKey)
			if err != nil {
				log.Warnf("Decryption failed for %s (name=%s): %v", hostKey, name, err)
				continue
			}
			log.Infof("Decryption successful for %s (name=%s). Result prefix: %s...", hostKey, name, safePrefix(decrypted, 15))

			if strings.HasPrefix(decrypted, "sk-ant-sid") {
				return decrypted, nil
			} else {
				log.Warnf("Decrypted value does not start with sk-ant-sid")
			}
		}
	}

	if !foundAny {
		log.Warnf("No cookies found for .claude.ai in %s (scanned %d rows)", dbPath, rowCount)
	}

	return "", nil
}

// copyFile copies a file from src to dst, trying to allow shared read access
func copyFile(src, dst string) error {
	var lastErr error
	// Retry up to 5 times for transient locks (SQLite checkpoints, etc.)
	for i := 0; i < 5; i++ {
		if i > 0 {
			time.Sleep(500 * time.Millisecond)
		}

		// 1. Try native copy with shared read
		if err := copyFileNative(src, dst); err == nil {
			return nil
		} else {
			lastErr = err
		}

		// 2. Fallback to shell copy on Windows (bypasses some locks)
		if runtime.GOOS == "windows" {
			// A. CMD Copy
			cmd := exec.Command("cmd", "/c", "copy", "/y", src, dst)
			if _, err := cmd.CombinedOutput(); err == nil {
				return nil
			}

			// B. Robocopy (Robust File Copy) - often bypasses locks
			// Robocopy requires source dir, dest dir, and filename.
			// It returns exit codes 0-7 for success.
			srcDir := filepath.Dir(src)
			srcFile := filepath.Base(src)

			// Create a temp dir for robocopy destination to avoid name collisions
			tmpDir, err := os.MkdirTemp("", "orbit_robo")
			if err == nil {
				defer os.RemoveAll(tmpDir)

				robo := exec.Command("robocopy", srcDir, tmpDir, srcFile, "/R:1", "/W:1", "/COPY:DT")
				_ = robo.Run() // Ignore error as Robocopy returns non-zero on success

				// Check if file was copied
				tmpParams := filepath.Join(tmpDir, srcFile)
				if _, err := os.Stat(tmpParams); err == nil {
					// Move/Rename to final destination
					// We use a manual copy/move helper here since os.Rename might fail across volumes (though temp usually is same volume)
					// But simpler: just read/write if rename fails?
					// Try rename first
					if err := os.Rename(tmpParams, dst); err == nil {
						return nil
					}
					// If rename failed (e.g. cross-volume), try manual copy from temp
					fSrc, _ := os.Open(tmpParams)
					fDst, _ := os.Create(dst)
					io.Copy(fDst, fSrc)
					fSrc.Close()
					fDst.Close()
					return nil
				}
			}

			// C. Last resort: PowerShell Copy-Item
			psCmdStr := fmt.Sprintf("Copy-Item -LiteralPath '%s' -Destination '%s' -Force", src, dst)
			psCmd := exec.Command("powershell", "-NoProfile", "-Command", psCmdStr)
			if _, err := psCmd.CombinedOutput(); err == nil {
				return nil
			}
		}
	}

	return fmt.Errorf("failed after retries. Last error: %v", lastErr)
}

func copyFileNative(src, dst string) error {
	handle, err := openFileShared(src)
	if err != nil {
		return err
	}
	defer handle.Close()

	destFile, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer destFile.Close()

	_, err = io.Copy(destFile, handle)
	return err
}

func openFileShared(path string) (*os.File, error) {
	if runtime.GOOS != "windows" {
		return os.Open(path)
	}

	pathPtr, err := windows.UTF16PtrFromString(path)
	if err != nil {
		return nil, err
	}

	// GENERIC_READ = 0x80000000
	// FILE_SHARE_READ = 1, FILE_SHARE_WRITE = 2, FILE_SHARE_DELETE = 4
	// OPEN_EXISTING = 3
	handle, err := windows.CreateFile(
		pathPtr,
		windows.GENERIC_READ,
		windows.FILE_SHARE_READ|windows.FILE_SHARE_WRITE|windows.FILE_SHARE_DELETE,
		nil,
		windows.OPEN_EXISTING,
		windows.FILE_ATTRIBUTE_NORMAL,
		0,
	)

	if err != nil {
		return nil, err
	}

	return os.NewFile(uintptr(handle), path), nil
}

func getMasterKey(userDataDir string) ([]byte, error) {
	masterKeysMutex.Lock()
	defer masterKeysMutex.Unlock()

	if k, ok := masterKeys[userDataDir]; ok {
		return k, nil
	}

	localStatePath := filepath.Join(userDataDir, "Local State")
	content, err := os.ReadFile(localStatePath)
	if err != nil {
		return nil, err
	}

	var state LocalState
	if err := json.Unmarshal(content, &state); err != nil {
		return nil, err
	}

	log.Infof("Local State keys found: encrypted_key_len=%d app_bound_encrypted_key_len=%d",
		len(state.OsCrypt.EncryptedKey), len(state.OsCrypt.AppBoundEncryptedKey))

	// Check for App-Bound Encryption
	if len(state.OsCrypt.AppBoundEncryptedKey) > 0 {
		log.Warnf("App-Bound Encryption detected for %s. File-based decryption is impossible.", userDataDir)

		// Attempt CDP Extraction
		binPath := getBrowserBinaryPath(userDataDir)
		if binPath != "" {
			log.Infof("Attempting CDP extraction using binary: %s", binPath)
			// Close browser first to ensure CDP can attach/launch
			killBrowserForPath(userDataDir)
			time.Sleep(1 * time.Second)

			key, err := cdp.ExtractSessionKey(userDataDir, binPath)
			if err == nil && key != "" {
				// Success! Close browser again to be clean
				killBrowserForPath(userDataDir)
				masterKeys[userDataDir] = []byte("CDP_BYPASS") // Cache dummy key
				return []byte("CDP_BYPASS_KEY:" + key), nil    // Return key directly embedded
			}
			log.Errorf("CDP extraction failed: %v", err)
		} else {
			log.Warn("Could not find browser binary for CDP fallback.")
		}

		// Fallthough to try standard method just in case (will likely fail for v20 cookies)
	}

	encryptedKey, err := base64.StdEncoding.DecodeString(state.OsCrypt.EncryptedKey)
	if err != nil {
		return nil, err
	}

	// DPAPI decrypt (first 5 bytes are 'DPAPI')
	if len(encryptedKey) < 5 || string(encryptedKey[:5]) != "DPAPI" {
		return nil, errors.New("invalid encrypted key format (not DPAPI)")
	}

	// Decrypt the key (stripping DPAPI prefix)
	masterKey, err := decryptDPAPI(encryptedKey[5:])
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt master key: %w", err)
	}

	log.Infof("Successfully decrypted master key for %s. Length: %d", userDataDir, len(masterKey))

	masterKeys[userDataDir] = []byte(masterKey)
	return []byte(masterKey), nil
}

func decryptValue(data []byte, masterKey []byte) (string, error) {
	if len(data) == 0 {
		return "", nil
	}

	// v10 prefix = AES-GCM
	if len(data) > 3 && string(data[:3]) == "v10" {
		if masterKey == nil {
			return "", errors.New("master key required for v10 decryption")
		}
		return decryptAESGCM(data[3:], masterKey)
	}

	// Otherwise assume DPAPI (old)
	return decryptDPAPI(data)
}

func decryptAESGCM(data, key []byte) (string, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return "", errors.New("ciphertext too short")
	}

	nonce, ciphertext := data[:nonceSize], data[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}

	return string(plaintext), nil
}

func decryptDPAPI(data []byte) (string, error) {
	if runtime.GOOS != "windows" {
		return "", errors.New("DPAPI only supported on Windows")
	}

	var out windows.DataBlob
	blob := windows.DataBlob{Size: uint32(len(data)), Data: &data[0]}

	// Copy of description:
	// The function decrypts the data in the DataBlob structure.
	// We don't use entropy or description here as per standard Chrome implementation.
	if err := windows.CryptUnprotectData(&blob, nil, nil, 0, nil, 0, &out); err != nil {
		return "", err
	}
	defer windows.LocalFree(windows.Handle(uintptr(unsafe.Pointer(out.Data))))

	// Copy data to Go string before freeing
	return string(unsafe.Slice(out.Data, out.Size)), nil
}

func getChromeProfilePath() string {
	if runtime.GOOS != "windows" {
		return ""
	}
	localAppData := os.Getenv("LOCALAPPDATA")
	if localAppData == "" {
		return ""
	}
	return filepath.Join(localAppData, "Google", "Chrome", "User Data", "Default")
}

func getEdgeProfilePath() string {
	if runtime.GOOS != "windows" {
		return ""
	}
	localAppData := os.Getenv("LOCALAPPDATA")
	if localAppData == "" {
		return ""
	}
	return filepath.Join(localAppData, "Microsoft", "Edge", "User Data", "Default")
}

func getOperaProfilePath() string {
	if runtime.GOOS != "windows" {
		return ""
	}
	appData := os.Getenv("APPDATA")
	if appData == "" {
		return ""
	}
	// Opera 95+ often uses "Default" profile folder, similar to Chrome
	base := filepath.Join(appData, "Opera Software", "Opera Stable")
	defaultPath := filepath.Join(base, "Default")
	if _, err := os.Stat(defaultPath); err == nil {
		return defaultPath
	}
	return base
}

func getOperaGXProfilePath() string {
	if runtime.GOOS != "windows" {
		return ""
	}
	appData := os.Getenv("APPDATA")
	if appData == "" {
		return ""
	}
	// Opera GX
	base := filepath.Join(appData, "Opera Software", "Opera GX Stable")
	defaultPath := filepath.Join(base, "Default")
	if _, err := os.Stat(defaultPath); err == nil {
		return defaultPath
	}
	return base
}

func getBraveProfilePath() string {
	if runtime.GOOS != "windows" {
		return ""
	}
	localAppData := os.Getenv("LOCALAPPDATA")
	if localAppData == "" {
		return ""
	}
	return filepath.Join(localAppData, "BraveSoftware", "Brave-Browser", "User Data", "Default")
}

func killBrowserForPath(path string) bool {
	pathLower := strings.ToLower(path)
	procNames := []string{}

	if strings.Contains(pathLower, "opera") {
		// Opera uses both image names depending on version/installer
		procNames = append(procNames, "opera.exe", "launcher.exe")
	} else if strings.Contains(pathLower, "chrome") {
		procNames = append(procNames, "chrome.exe")
	} else if strings.Contains(pathLower, "edge") {
		procNames = append(procNames, "msedge.exe")
	} else if strings.Contains(pathLower, "brave") {
		procNames = append(procNames, "brave.exe")
	} else {
		return false
	}

	anyKilled := false
	for _, procName := range procNames {
		log.Infof("Attempting to terminate %s to release file lock on %s", procName, path)
		// /F = Forcefully terminate
		// /IM = Image Name
		cmd := exec.Command("taskkill", "/F", "/IM", procName)
		if err := cmd.Run(); err == nil {
			log.Infof("Successfully terminated %s", procName)
			anyKilled = true
		} else {
			log.Warnf("Failed to kill %s (may not be running): %v", procName, err)
		}
	}
	return anyKilled
}

func safePrefix(s string, l int) string {
	if len(s) > l {
		return s[:l]
	}
	return s
}

func safeSlice(b []byte, l int) []byte {
	if len(b) > l {
		return b[:l]
	}
	return b
}

func getBrowserBinaryPath(userDataDir string) string {
	// Try to deduce browser from path or just search known locations
	pathLower := strings.ToLower(userDataDir)

	// Pre-defined potential locations
	checkPaths := []string{}

	if strings.Contains(pathLower, "opera") && strings.Contains(pathLower, "gx") {
		// Opera GX
		userProfile := os.Getenv("USERPROFILE")
		localAppData := os.Getenv("LOCALAPPDATA")
		checkPaths = append(checkPaths,
			filepath.Join(localAppData, "Programs", "Opera GX", "launcher.exe"),
			filepath.Join(userProfile, "AppData", "Local", "Programs", "Opera GX", "launcher.exe"),
		)
	} else if strings.Contains(pathLower, "opera") {
		// Opera Stable
		userProfile := os.Getenv("USERPROFILE")
		localAppData := os.Getenv("LOCALAPPDATA")
		checkPaths = append(checkPaths,
			filepath.Join(localAppData, "Programs", "Opera", "launcher.exe"),
			filepath.Join(localAppData, "Programs", "Opera", "opera.exe"),
			filepath.Join(userProfile, "AppData", "Local", "Programs", "Opera", "launcher.exe"),
			filepath.Join(userProfile, "AppData", "Local", "Programs", "Opera", "opera.exe"),
		)
	} else if strings.Contains(pathLower, "chrome") {
		// Chrome
		checkPaths = append(checkPaths,
			filepath.Join(os.Getenv("ProgramFiles"), "Google", "Chrome", "Application", "chrome.exe"),
			filepath.Join(os.Getenv("ProgramFiles(x86)"), "Google", "Chrome", "Application", "chrome.exe"),
			filepath.Join(os.Getenv("LOCALAPPDATA"), "Google", "Chrome", "Application", "chrome.exe"),
		)
	} else if strings.Contains(pathLower, "edge") {
		// Edge
		checkPaths = append(checkPaths,
			filepath.Join(os.Getenv("ProgramFiles(x86)"), "Microsoft", "Edge", "Application", "msedge.exe"),
			filepath.Join(os.Getenv("ProgramFiles"), "Microsoft", "Edge", "Application", "msedge.exe"),
		)
	} else if strings.Contains(pathLower, "brave") {
		// Brave
		checkPaths = append(checkPaths,
			filepath.Join(os.Getenv("ProgramFiles"), "BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
			filepath.Join(os.Getenv("LOCALAPPDATA"), "BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
		)
	}

	for _, p := range checkPaths {
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}

	return ""
}
