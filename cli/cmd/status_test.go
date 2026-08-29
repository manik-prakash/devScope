package cmd

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/manik-prakash/devscope-cli/internal/config"
)

func TestFormatScore(t *testing.T) {
	if got := formatScore(nil); got != "—" {
		t.Errorf("formatScore(nil) = %q, want %q", got, "—")
	}

	v := 82.0
	if got := formatScore(&v); got != "82.0" {
		t.Errorf("formatScore(&82.0) = %q, want %q", got, "82.0")
	}

	z := 0.0
	if got := formatScore(&z); got != "0.0" {
		t.Errorf("formatScore(&0.0) = %q, want %q — a real zero score is not the same as unscored", got, "0.0")
	}
}

// seedConfigWithProject writes an authenticated config with a resolvable default
// project so statusCmd gets past project resolution to the backend fetch.
func seedConfigWithProject(t *testing.T) {
	t.Helper()
	restore := config.SetDirForTest(t.TempDir())
	t.Cleanup(restore)
	cfg := &config.Config{
		APIKey:         "test-key",
		CacheTTL:       3600,
		DefaultProject: "proj",
		Projects:       []config.Project{{ID: "p1", Slug: "proj", Name: "Proj"}},
	}
	if err := config.Save(cfg); err != nil {
		t.Fatalf("seed config: %v", err)
	}
}

// TestStatusCmd_ExitSemantics pins R-01 Option B for `devscope status`: a
// rejected key is actionable (non-nil error → non-zero exit); an unreachable
// backend is transient (nil → exit 0).
func TestStatusCmd_ExitSemantics(t *testing.T) {
	t.Run("auth rejected returns error", func(t *testing.T) {
		seedConfigWithProject(t)
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusUnauthorized)
		}))
		defer srv.Close()
		t.Setenv("DEVSCOPE_API_BASE_URL", srv.URL)

		if err := statusCmd.RunE(statusCmd, nil); err == nil {
			t.Fatal("expected non-nil error on 401")
		}
	})

	t.Run("backend unreachable returns nil", func(t *testing.T) {
		seedConfigWithProject(t)
		t.Setenv("DEVSCOPE_API_BASE_URL", "http://127.0.0.1:1")

		if err := statusCmd.RunE(statusCmd, nil); err != nil {
			t.Fatalf("expected nil on transient failure, got %v", err)
		}
	})

	t.Run("success returns nil", func(t *testing.T) {
		seedConfigWithProject(t)
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			_, _ = w.Write([]byte(`{"sessions":[]}`))
		}))
		defer srv.Close()
		t.Setenv("DEVSCOPE_API_BASE_URL", srv.URL)

		if err := statusCmd.RunE(statusCmd, nil); err != nil {
			t.Fatalf("expected nil on success, got %v", err)
		}
	})
}
