package cdp

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/chromedp/cdproto/network"
	"github.com/chromedp/chromedp"
	"github.com/sirupsen/logrus"
)

var log = logrus.StandardLogger()

// ExtractSessionKey launches a headless browser to extract the sessionKey cookie.
// userDataDir: check chrome://version/ for "Profile Path" and use parent directory (User Data).
// binPath: path to the browser executable (chrome.exe, opera.exe, etc.).
func ExtractSessionKey(userDataDir string, binPath string) (string, error) {
	// 1. Configure Allocator
	opts := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.ExecPath(binPath),
		chromedp.UserDataDir(userDataDir),
		// Critical flags for headless cookie extraction
		chromedp.Flag("headless", true), // Invisible
		chromedp.Flag("disable-gpu", true),
		chromedp.Flag("no-sandbox", true),
		chromedp.Flag("disable-software-rasterizer", true),
		// Prevent "Restore pages?" popup
		chromedp.Flag("hide-crash-restore-bubble", true),
		chromedp.Flag("disable-session-crashed-bubble", true),
	)

	allocCtx, cancelAlloc := chromedp.NewExecAllocator(context.Background(), opts...)
	defer cancelAlloc()

	// 2. Create Context
	ctx, cancelCtx := chromedp.NewContext(allocCtx)
	defer cancelCtx()

	// 3. Run tasks
	// We need to navigate to the domain to ensure cookies are accessible if they are SameSite/HttpOnly
	var cookies []*network.Cookie
	log.Infof("Launching headless browser (%s) for CDP extraction...", binPath)

	err := chromedp.Run(ctx,
		chromedp.ActionFunc(func(ctx context.Context) error {
			// Set timeout for the navigation/extraction
			timeoutCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
			defer cancel()

			// Navigate to a safe page on the domain to load cookies
			// We use a light page to be fast
			if err := chromedp.Navigate("https://claude.ai/login").Do(timeoutCtx); err != nil {
				return fmt.Errorf("navigation failed: %w", err)
			}
			return nil
		}),
		chromedp.ActionFunc(func(ctx context.Context) error {
			// Get all cookies for the current URL
			var err error
			cookies, err = network.GetCookies().Do(ctx)
			return err
		}),
	)

	if err != nil {
		return "", fmt.Errorf("CDP run failed: %w", err)
	}

	// 4. Find the key
	for _, c := range cookies {
		if c.Name == "sessionKey" && (strings.Contains(c.Domain, "claude.ai") || strings.Contains(c.Domain, "anthropic.com")) {
			log.Infof("Successfully extracted sessionKey via CDP (len=%d)", len(c.Value))
			return c.Value, nil
		}
	}

	return "", fmt.Errorf("sessionKey not found in %d cookies retrieved via CDP", len(cookies))
}
