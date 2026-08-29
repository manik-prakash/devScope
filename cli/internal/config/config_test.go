package config

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"
)

// TestRoundTrip verifies that Save → Load produces the same config.
func TestRoundTrip(t *testing.T) {
	// Use a temp dir as the devscope home.
	tmp := t.TempDir()
	devScopeDir = tmp

	original := &Config{
		APIKey:         "test-key-abc123",
		UserID:         "user-001",
		OrgID:          "org-001",
		Name:           "Jane Developer",
		Email:          "jane@example.com",
		DefaultProject: "backend-api",
		Agent:          "claude-code",
		CacheTTL:       3600,
		CachedAt:       time.Now().UTC().Format(time.RFC3339),
		Projects: []Project{
			{ID: "proj-1", Slug: "backend-api", Name: "Backend API"},
			{ID: "proj-2", Slug: "frontend", Name: "Frontend App"},
		},
	}

	// Save.
	if err := Save(original); err != nil {
		t.Fatalf("Save failed: %v", err)
	}

	// Verify file exists.
	if !Exists() {
		t.Fatal("Exists() returned false after Save")
	}

	// Load.
	loaded, err := Load()
	if err != nil {
		t.Fatalf("Load failed: %v", err)
	}

	// Compare fields.
	if loaded.APIKey != original.APIKey {
		t.Errorf("APIKey: got %q, want %q", loaded.APIKey, original.APIKey)
	}
	if loaded.UserID != original.UserID {
		t.Errorf("UserID: got %q, want %q", loaded.UserID, original.UserID)
	}
	if loaded.OrgID != original.OrgID {
		t.Errorf("OrgID: got %q, want %q", loaded.OrgID, original.OrgID)
	}
	if loaded.Name != original.Name {
		t.Errorf("Name: got %q, want %q", loaded.Name, original.Name)
	}
	if loaded.Email != original.Email {
		t.Errorf("Email: got %q, want %q", loaded.Email, original.Email)
	}
	if loaded.DefaultProject != original.DefaultProject {
		t.Errorf("DefaultProject: got %q, want %q", loaded.DefaultProject, original.DefaultProject)
	}
	if loaded.Agent != original.Agent {
		t.Errorf("Agent: got %q, want %q", loaded.Agent, original.Agent)
	}
	if loaded.CacheTTL != original.CacheTTL {
		t.Errorf("CacheTTL: got %d, want %d", loaded.CacheTTL, original.CacheTTL)
	}
	if len(loaded.Projects) != len(original.Projects) {
		t.Fatalf("Projects count: got %d, want %d", len(loaded.Projects), len(original.Projects))
	}
	for i, p := range loaded.Projects {
		if p.Slug != original.Projects[i].Slug {
			t.Errorf("Projects[%d].Slug: got %q, want %q", i, p.Slug, original.Projects[i].Slug)
		}
	}
}

// TestLoadMissingConfig ensures Load returns an actionable error.
func TestLoadMissingConfig(t *testing.T) {
	tmp := t.TempDir()
	devScopeDir = tmp

	_, err := Load()
	if err == nil {
		t.Fatal("Load should fail when config does not exist")
	}

	// Should contain the guidance message.
	if got := err.Error(); got == "" {
		t.Error("error message should not be empty")
	}
}

// TestSetAndGet verifies single-key Set and Get.
func TestSetAndGet(t *testing.T) {
	tmp := t.TempDir()
	devScopeDir = tmp

	// Create a minimal config first.
	if err := Save(&Config{APIKey: "initial"}); err != nil {
		t.Fatalf("Save failed: %v", err)
	}

	// Set a single key.
	if err := Set("default_project", "my-project"); err != nil {
		t.Fatalf("Set failed: %v", err)
	}

	val, err := Get("default_project")
	if err != nil {
		t.Fatalf("Get failed: %v", err)
	}
	if val != "my-project" {
		t.Errorf("Get: got %q, want %q", val, "my-project")
	}

	// Original key should still be there.
	apiKey, err := Get("api_key")
	if err != nil {
		t.Fatalf("Get api_key failed: %v", err)
	}
	if apiKey != "initial" {
		t.Errorf("api_key after Set: got %q, want %q", apiKey, "initial")
	}
}

// TestDeleteConfig verifies Delete removes the config file.
func TestDeleteConfig(t *testing.T) {
	tmp := t.TempDir()
	devScopeDir = tmp

	if err := Save(&Config{APIKey: "delete-me"}); err != nil {
		t.Fatalf("Save failed: %v", err)
	}

	if err := Delete(); err != nil {
		t.Fatalf("Delete failed: %v", err)
	}

	if Exists() {
		t.Error("Exists() returned true after Delete")
	}
}

// TestIsCacheStale checks fresh and stale cache detection.
func TestIsCacheStale(t *testing.T) {
	// No cached_at → stale.
	if !IsCacheStale(&Config{}) {
		t.Error("empty CachedAt should be stale")
	}

	// Just cached → fresh.
	fresh := &Config{
		CacheTTL: 3600,
		CachedAt: time.Now().UTC().Format(time.RFC3339),
	}
	if IsCacheStale(fresh) {
		t.Error("just-cached config should not be stale")
	}

	// Cached 2 hours ago with 1-hour TTL → stale.
	stale := &Config{
		CacheTTL: 3600,
		CachedAt: time.Now().Add(-2 * time.Hour).UTC().Format(time.RFC3339),
	}
	if !IsCacheStale(stale) {
		t.Error("config cached 2h ago with 1h TTL should be stale")
	}
}

// TestResolveProject validates the precedence chain.
func TestResolveProject(t *testing.T) {
	cfg := &Config{
		DefaultProject: "default-proj",
		Projects: []Project{
			{ID: "1", Slug: "flag-proj", Name: "Flag Project"},
			{ID: "2", Slug: "repo-proj", Name: "Repo Project"},
			{ID: "3", Slug: "default-proj", Name: "Default Project"},
		},
	}

	// 1. Flag takes priority.
	p, err := ResolveProject(cfg, "flag-proj", "repo-proj")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if p.Slug != "flag-proj" {
		t.Errorf("expected flag-proj, got %s", p.Slug)
	}

	// 2. Repo config is next.
	p, err = ResolveProject(cfg, "", "repo-proj")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if p.Slug != "repo-proj" {
		t.Errorf("expected repo-proj, got %s", p.Slug)
	}

	// 3. Default project is last.
	p, err = ResolveProject(cfg, "", "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if p.Slug != "default-proj" {
		t.Errorf("expected default-proj, got %s", p.Slug)
	}

	// 4. Nothing configured → actionable error.
	_, err = ResolveProject(&Config{}, "", "")
	if err == nil {
		t.Error("expected error when no project can be resolved")
	}
}

// TestResolveProjectForDir verifies the repo-local .devscope.yaml `project:`
// field is actually threaded into resolution (it was previously ignored — run
// and status passed an empty repo slug).
func TestResolveProjectForDir(t *testing.T) {
	cfg := &Config{
		DefaultProject: "default-proj",
		Projects: []Project{
			{ID: "1", Slug: "repo-proj", Name: "Repo Project"},
			{ID: "2", Slug: "default-proj", Name: "Default Project"},
		},
	}

	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, ".devscope.yaml"), []byte("project: repo-proj\n"), 0o644); err != nil {
		t.Fatal(err)
	}

	// No flag → the repo file wins over the global default.
	p, err := ResolveProjectForDir(cfg, "", dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if p.Slug != "repo-proj" {
		t.Errorf("expected repo-proj from .devscope.yaml, got %s", p.Slug)
	}

	// A dir with no .devscope.yaml falls back to the global default.
	p, err = ResolveProjectForDir(cfg, "", t.TempDir())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if p.Slug != "default-proj" {
		t.Errorf("expected default-proj fallback, got %s", p.Slug)
	}
}

// TestLoadRepoConfig tests .devscope.yaml parsing.
func TestSave_TightensExistingFileMode(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("unix file modes not meaningful on Windows")
	}
	tmp := t.TempDir()
	devScopeDir = tmp

	// Pre-create the config file with loose permissions.
	if err := os.WriteFile(ConfigPath(), []byte("api_key: old\n"), 0o644); err != nil {
		t.Fatal(err)
	}

	if err := Save(&Config{APIKey: "new-secret"}); err != nil {
		t.Fatalf("Save: %v", err)
	}

	info, err := os.Stat(ConfigPath())
	if err != nil {
		t.Fatal(err)
	}
	if perm := info.Mode().Perm(); perm != 0o600 {
		t.Errorf("config mode = %o, want 600", perm)
	}
}

func TestLoadRepoConfig(t *testing.T) {
	tmp := t.TempDir()

	// No file → nil, nil.
	rc, err := LoadRepoConfig(tmp)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if rc != nil {
		t.Error("expected nil RepoConfig when file does not exist")
	}

	// Write a .devscope.yaml.
	content := `project: my-api
custom_strip_patterns:
  - "INTERNAL_TOKEN_[A-Z0-9]+"
  - "corp-secret-\\w+"
`
	if err := os.WriteFile(filepath.Join(tmp, ".devscope.yaml"), []byte(content), 0o644); err != nil {
		t.Fatalf("failed to write test file: %v", err)
	}

	rc, err = LoadRepoConfig(tmp)
	if err != nil {
		t.Fatalf("LoadRepoConfig failed: %v", err)
	}
	if rc.Project != "my-api" {
		t.Errorf("Project: got %q, want %q", rc.Project, "my-api")
	}
	if len(rc.CustomStripPatterns) != 2 {
		t.Fatalf("CustomStripPatterns count: got %d, want 2", len(rc.CustomStripPatterns))
	}
}

// TestEnsureDirs verifies directory creation.
func TestEnsureDirs(t *testing.T) {
	tmp := t.TempDir()
	devScopeDir = filepath.Join(tmp, "new-devscope")

	if err := EnsureDirs(); err != nil {
		t.Fatalf("EnsureDirs failed: %v", err)
	}

	for _, dir := range []string{Dir(), QueueDir(), LogsDir()} {
		info, err := os.Stat(dir)
		if err != nil {
			t.Errorf("directory %s does not exist: %v", dir, err)
			continue
		}
		if !info.IsDir() {
			t.Errorf("%s is not a directory", dir)
		}
	}
}

// TestAPIBaseURL verifies env var reading and missing-var error.
func TestAPIBaseURL(t *testing.T) {
	// Clear it first.
	os.Unsetenv("DEVSCOPE_API_BASE_URL")

	_, err := APIBaseURL()
	if err == nil {
		t.Fatal("expected error when DEVSCOPE_API_BASE_URL is not set")
	}

	os.Setenv("DEVSCOPE_API_BASE_URL", "https://api.devscope.io")
	defer os.Unsetenv("DEVSCOPE_API_BASE_URL")

	url, err := APIBaseURL()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if url != "https://api.devscope.io" {
		t.Errorf("got %q, want %q", url, "https://api.devscope.io")
	}
}

// TestAPIBaseURL_Normalizes checks that a trailing slash or an accidentally
// included "/api/v1" is stripped, since the API client appends "/api/v1/..."
// to whatever this returns.
func TestAPIBaseURL_Normalizes(t *testing.T) {
	defer os.Unsetenv("DEVSCOPE_API_BASE_URL")
	cases := map[string]string{
		"https://api.devscope.io/":        "https://api.devscope.io",
		"https://api.devscope.io/api/v1":  "https://api.devscope.io",
		"https://api.devscope.io/api/v1/": "https://api.devscope.io",
		"http://localhost:3001/api/v1":    "http://localhost:3001",
		"http://localhost:3001":           "http://localhost:3001",
	}
	for in, want := range cases {
		os.Setenv("DEVSCOPE_API_BASE_URL", in)
		got, err := APIBaseURL()
		if err != nil {
			t.Fatalf("%q: unexpected error: %v", in, err)
		}
		if got != want {
			t.Errorf("APIBaseURL(%q) = %q, want %q", in, got, want)
		}
	}
}
