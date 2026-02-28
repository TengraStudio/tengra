package main

import (
	"context"
	"crypto/subtle"
	"net/http"
	"strings"

	sdkaccess "github.com/router-for-me/CLIProxyAPI/v6/sdk/access"
)

type runtimeAccessProvider struct {
	apiKey string
}

func newRuntimeAccessProvider(apiKey string) *runtimeAccessProvider {
	return &runtimeAccessProvider{apiKey: strings.TrimSpace(apiKey)}
}

func (p *runtimeAccessProvider) Identifier() string {
	return "tengra-runtime"
}

func (p *runtimeAccessProvider) Authenticate(_ context.Context, r *http.Request) (*sdkaccess.Result, error) {
	if p == nil || p.apiKey == "" {
		return nil, sdkaccess.ErrNotHandled
	}

	provided := strings.TrimSpace(extractBearerToken(r.Header.Get("Authorization")))
	if provided == "" {
		return nil, sdkaccess.ErrNoCredentials
	}

	if subtle.ConstantTimeCompare([]byte(provided), []byte(p.apiKey)) != 1 {
		return nil, sdkaccess.ErrInvalidCredential
	}

	return &sdkaccess.Result{
		Provider:  p.Identifier(),
		Principal: provided,
		Metadata: map[string]string{
			"source": "authorization",
		},
	}, nil
}

func extractBearerToken(header string) string {
	if header == "" {
		return ""
	}

	parts := strings.SplitN(header, " ", 2)
	if len(parts) != 2 {
		return header
	}

	if !strings.EqualFold(parts[0], "bearer") {
		return header
	}

	return strings.TrimSpace(parts[1])
}
