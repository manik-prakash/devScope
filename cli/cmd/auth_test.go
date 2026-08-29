package cmd

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/manik-prakash/devscope-cli/internal/api"
	"github.com/manik-prakash/devscope-cli/internal/config"
)

// TestAuthFlow_EndToEnd simulates the complete auth flow:
//  1. Start a mock backend that responds to GET /api/v1/cli/me
//  2. Pipe a fake API key into stdin
//  3. Run the auth command
//  4. Verify config was written correctly
func TestAuthFlow_EndToEnd(t *testing.T) {
	// --- Setup temp devscope dir ---
	tmp := t.TempDir()
	// Override the config package's internal dir for this test.
	overrideConfigDir(t, tmp)

	// --- Mock backend ---
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/cli/me" {
			w.WriteHeader(http.StatusNotFound)
			return
		}

		// Verify the auth header.
		auth := r.Header.Get("Authorization")
		if auth != "Bearer test-api-key-123" {
			w.WriteHeader(http.StatusUnauthorized)
			w.Write([]byte(`{"error":"invalid"}`))
			return
		}

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(api.MeResponse{
			UserID:             "user-42",
			OrgID:              "org-7",
			Name:               "Test Dev",
			Email:              "test@devscope.io",
			DefaultProjectSlug: "my-api",
			SigningSecret:      "signing-secret-abc",
			Projects: []api.MeProject{
				{ID: "p1", Slug: "my-api", Name: "My API"},
				{ID: "p2", Slug: "my-frontend", Name: "My Frontend"},
			},
		})
	}))
	defer server.Close()

	// Set the required env var.
	t.Setenv("DEVSCOPE_API_BASE_URL", server.URL)

	// --- Pipe API key to stdin ---
	oldStdin := os.Stdin
	defer func() { os.Stdin = oldStdin }()

	r, w, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	os.Stdin = r

	go func() {
		defer w.Close()
		w.Write([]byte("test-api-key-123\n"))
	}()

	// --- Run auth ---
	if err := runAuth(authCmd, nil); err != nil {
		t.Fatalf("runAuth failed: %v", err)
	}

	// --- Verify config was saved ---
	cfg, err := config.Load()
	if err != nil {
		t.Fatalf("config.Load failed: %v", err)
	}

	if cfg.APIKey != "test-api-key-123" {
		t.Errorf("APIKey: got %q", cfg.APIKey)
	}
	if cfg.SigningSecret != "signing-secret-abc" {
		t.Errorf("SigningSecret: got %q", cfg.SigningSecret)
	}
	if cfg.UserID != "user-42" {
		t.Errorf("UserID: got %q", cfg.UserID)
	}
	if cfg.OrgID != "org-7" {
		t.Errorf("OrgID: got %q", cfg.OrgID)
	}
	if cfg.Name != "Test Dev" {
		t.Errorf("Name: got %q", cfg.Name)
	}
	if cfg.Email != "test@devscope.io" {
		t.Errorf("Email: got %q", cfg.Email)
	}
	if cfg.DefaultProject != "my-api" {
		t.Errorf("DefaultProject: got %q", cfg.DefaultProject)
	}
	if len(cfg.Projects) != 2 {
		t.Fatalf("Projects count: got %d", len(cfg.Projects))
	}
	if cfg.Projects[0].Slug != "my-api" {
		t.Errorf("Projects[0].Slug: got %q", cfg.Projects[0].Slug)
	}
	if cfg.CachedAt == "" {
		t.Error("CachedAt should be set")
	}
}

// TestAuthFlow_InvalidKey tests that a 401 from the backend produces
// an actionable error.
func TestAuthFlow_InvalidKey(t *testing.T) {
	tmp := t.TempDir()
	overrideConfigDir(t, tmp)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		w.Write([]byte(`{"error":"invalid key"}`))
	}))
	defer server.Close()

	t.Setenv("DEVSCOPE_API_BASE_URL", server.URL)

	// Pipe a key.
	oldStdin := os.Stdin
	defer func() { os.Stdin = oldStdin }()

	r, w, _ := os.Pipe()
	os.Stdin = r
	go func() {
		defer w.Close()
		w.Write([]byte("bad-key\n"))
	}()

	err := runAuth(authCmd, nil)
	if err == nil {
		t.Fatal("expected error for invalid key")
	}

	// Config should NOT have been created.
	if config.Exists() {
		t.Error("config should not exist after failed auth")
	}
}

// TestAuthTestsAreIsolated guards that overrideConfigDir actually redirects the
// config package at the caller's temp dir — otherwise the auth tests read and
// (on cleanup) delete the developer's real ~/.devscope/config.yaml.
func TestAuthTestsAreIsolated(t *testing.T) {
	tmp := t.TempDir()
	overrideConfigDir(t, tmp)

	if !strings.HasPrefix(config.Dir(), tmp) {
		t.Fatalf("config.Dir() = %q, want it under the test temp dir %q — auth tests are not isolated from the real ~/.devscope", config.Dir(), tmp)
	}
}

// TestAuthFlow_NoBaseURL tests that missing DEVSCOPE_API_BASE_URL
// gives an actionable error.
func TestAuthFlow_NoBaseURL(t *testing.T) {
	t.Setenv("DEVSCOPE_API_BASE_URL", "")

	err := runAuth(authCmd, nil)
	if err == nil {
		t.Fatal("expected error when DEVSCOPE_API_BASE_URL is not set")
	}
}

// overrideConfigDir points the config package at dir for the duration of the
// test (restored on cleanup) and creates the dir structure there, so the auth
// tests never read or write the developer's real ~/.devscope.
func overrideConfigDir(t *testing.T, dir string) {
	t.Helper()
	t.Cleanup(config.SetDirForTest(dir))
	if err := config.EnsureDirs(); err != nil {
		t.Fatalf("EnsureDirs failed: %v", err)
	}
}
