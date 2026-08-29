package cmd

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/manik-prakash/devscope-cli/internal/config"
)

// seedConfig points the config package at a fresh temp dir and writes a minimal
// authenticated config there. Restored on test cleanup.
func seedConfig(t *testing.T) {
	t.Helper()
	restore := config.SetDirForTest(t.TempDir())
	t.Cleanup(restore)
	if err := config.Save(&config.Config{APIKey: "test-key", CacheTTL: 3600}); err != nil {
		t.Fatalf("seed config: %v", err)
	}
}

// TestSyncCmd_ExitSemantics pins R-01 Option B for `devscope sync`: a rejected
// key is an actionable failure (non-nil error → non-zero exit); an unreachable
// backend is transient (nil → exit 0).
func TestSyncCmd_ExitSemantics(t *testing.T) {
	t.Run("auth rejected returns error", func(t *testing.T) {
		seedConfig(t)
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusUnauthorized)
		}))
		defer srv.Close()
		t.Setenv("DEVSCOPE_API_BASE_URL", srv.URL)

		if err := syncCmd.RunE(syncCmd, nil); err == nil {
			t.Fatal("expected non-nil error on 401")
		}
	})

	t.Run("backend unreachable returns nil", func(t *testing.T) {
		seedConfig(t)
		t.Setenv("DEVSCOPE_API_BASE_URL", "http://127.0.0.1:1")

		if err := syncCmd.RunE(syncCmd, nil); err != nil {
			t.Fatalf("expected nil on transient failure, got %v", err)
		}
	})

	t.Run("success returns nil and updates config", func(t *testing.T) {
		seedConfig(t)
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			_ = json.NewEncoder(w).Encode(map[string]any{
				"user_id": "u1", "org_id": "o1", "name": "Jane", "email": "jane@example.io",
			})
		}))
		defer srv.Close()
		t.Setenv("DEVSCOPE_API_BASE_URL", srv.URL)

		if err := syncCmd.RunE(syncCmd, nil); err != nil {
			t.Fatalf("expected nil on success, got %v", err)
		}
		cfg, err := config.Load()
		if err != nil {
			t.Fatalf("reload config: %v", err)
		}
		if cfg.UserID != "u1" {
			t.Errorf("UserID = %q, want u1", cfg.UserID)
		}
	})
}
