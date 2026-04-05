// Package config manages all DevScope CLI configuration:
//   - Global config at ~/.devscope/config.yaml (credentials, user context, projects)
//   - Repo-local config at .devscope.yaml (project slug, custom strip patterns)
//   - Filesystem path conventions for queue/, logs/
//   - DEVSCOPE_API_BASE_URL environment variable resolution
package config

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/spf13/viper"
	"gopkg.in/yaml.v3"
)

// -----------------------------------------------------------------------
// Directory and path helpers
// -----------------------------------------------------------------------

// devScopeDir is the resolved path to ~/.devscope. Computed once on init.
var devScopeDir string

func init() {
	home, err := os.UserHomeDir()
	if err != nil {
		// Fallback: let callers handle the missing-directory error later.
		devScopeDir = filepath.Join(".", ".devscope")
		return
	}
	devScopeDir = filepath.Join(home, ".devscope")
}

// Dir returns the absolute path to ~/.devscope.
func Dir() string {
	return devScopeDir
}

// ConfigPath returns the path to ~/.devscope/config.yaml.
func ConfigPath() string {
	return filepath.Join(devScopeDir, "config.yaml")
}

// QueueDir returns the path to ~/.devscope/queue/.
func QueueDir() string {
	return filepath.Join(devScopeDir, "queue")
}

// LogsDir returns the path to ~/.devscope/logs/.
func LogsDir() string {
	return filepath.Join(devScopeDir, "logs")
}

// RedactionLogPath returns the path to ~/.devscope/logs/redaction.log.
func RedactionLogPath() string {
	return filepath.Join(LogsDir(), "redaction.log")
}

// ShipLogPath returns the path to ~/.devscope/logs/ship.log.
func ShipLogPath() string {
	return filepath.Join(LogsDir(), "ship.log")
}

// EnsureDirs creates ~/.devscope/, queue/, and logs/ directories if they
// do not already exist.
func EnsureDirs() error {
	for _, dir := range []string{Dir(), QueueDir(), LogsDir()} {
		if err := os.MkdirAll(dir, 0o700); err != nil {
			return fmt.Errorf("failed to create directory %s: %w", dir, err)
		}
	}
	return nil
}

// -----------------------------------------------------------------------
// API base URL
// -----------------------------------------------------------------------

// APIBaseURL returns the DevScope backend URL from the environment.
// Returns an error with actionable guidance if not set.
func APIBaseURL() (string, error) {
	url := os.Getenv("DEVSCOPE_API_BASE_URL")
	if url == "" {
		return "", fmt.Errorf(
			"DEVSCOPE_API_BASE_URL is not set.\n" +
				"Set it to the DevScope backend URL before running any command.\n" +
				"Example: export DEVSCOPE_API_BASE_URL=https://api.devscope.io",
		)
	}
	return url, nil
}

// -----------------------------------------------------------------------
// Global config struct
// -----------------------------------------------------------------------

// Project represents a single DevScope project the user is assigned to.
type Project struct {
	ID   string `yaml:"id"   mapstructure:"id"`
	Slug string `yaml:"slug" mapstructure:"slug"`
	Name string `yaml:"name" mapstructure:"name"`
}

// Config is the full global config persisted at ~/.devscope/config.yaml.
type Config struct {
	APIKey         string    `yaml:"api_key"         mapstructure:"api_key"`
	UserID         string    `yaml:"user_id"         mapstructure:"user_id"`
	OrgID          string    `yaml:"org_id"          mapstructure:"org_id"`
	Name           string    `yaml:"name"            mapstructure:"name"`
	Email          string    `yaml:"email"           mapstructure:"email"`
	DefaultProject string    `yaml:"default_project" mapstructure:"default_project"`
	Agent          string    `yaml:"agent"           mapstructure:"agent"`
	CustomCommand  string    `yaml:"custom_command"  mapstructure:"custom_command"`
	Projects       []Project `yaml:"projects"        mapstructure:"projects"`
	CacheTTL       int       `yaml:"cache_ttl"       mapstructure:"cache_ttl"`
	CachedAt       string    `yaml:"cached_at"       mapstructure:"cached_at"`
}

// -----------------------------------------------------------------------
// Load / Save
// -----------------------------------------------------------------------

// Load reads ~/.devscope/config.yaml into a Config struct.
// Returns a human-readable error if the config file does not exist.
func Load() (*Config, error) {
	v := viper.New()
	v.SetConfigFile(ConfigPath())
	v.SetConfigType("yaml")

	// Sensible defaults.
	v.SetDefault("cache_ttl", 3600)

	if err := v.ReadInConfig(); err != nil {
		if os.IsNotExist(err) {
			return nil, fmt.Errorf(
				"No DevScope configuration found.\n" +
					"Run \"devscope auth\" to get started.",
			)
		}
		return nil, fmt.Errorf("failed to read config: %w", err)
	}

	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("failed to parse config: %w", err)
	}
	return &cfg, nil
}

// Save writes the Config struct to ~/.devscope/config.yaml.
// It creates the parent directories if needed.
func Save(cfg *Config) error {
	if err := EnsureDirs(); err != nil {
		return err
	}

	data, err := yaml.Marshal(cfg)
	if err != nil {
		return fmt.Errorf("failed to serialize config: %w", err)
	}

	if err := os.WriteFile(ConfigPath(), data, 0o600); err != nil {
		return fmt.Errorf("failed to write config: %w", err)
	}
	return nil
}

// Exists returns true if ~/.devscope/config.yaml exists on disk.
func Exists() bool {
	_, err := os.Stat(ConfigPath())
	return err == nil
}

// Delete removes ~/.devscope/config.yaml.
func Delete() error {
	if err := os.Remove(ConfigPath()); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to remove config: %w", err)
	}
	return nil
}

// -----------------------------------------------------------------------
// Single-key update
// -----------------------------------------------------------------------

// Set updates a single top-level key in the config file.
// It loads the existing config, sets the value via Viper, and rewrites the file.
func Set(key, value string) error {
	v := viper.New()
	v.SetConfigFile(ConfigPath())
	v.SetConfigType("yaml")

	// Read existing config, if any.
	if err := v.ReadInConfig(); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to read config: %w", err)
	}

	v.Set(key, value)

	if err := EnsureDirs(); err != nil {
		return err
	}

	if err := v.WriteConfigAs(ConfigPath()); err != nil {
		return fmt.Errorf("failed to write config: %w", err)
	}
	return nil
}

// Get returns the string value of a top-level config key.
func Get(key string) (string, error) {
	v := viper.New()
	v.SetConfigFile(ConfigPath())
	v.SetConfigType("yaml")

	if err := v.ReadInConfig(); err != nil {
		return "", fmt.Errorf("failed to read config: %w", err)
	}

	return v.GetString(key), nil
}

// -----------------------------------------------------------------------
// Cache freshness
// -----------------------------------------------------------------------

// IsCacheStale returns true if the cached user context is older than
// the configured cache_ttl (default 3600s).
func IsCacheStale(cfg *Config) bool {
	if cfg.CachedAt == "" {
		return true
	}

	cachedAt, err := time.Parse(time.RFC3339, cfg.CachedAt)
	if err != nil {
		return true
	}

	ttl := cfg.CacheTTL
	if ttl <= 0 {
		ttl = 3600
	}

	return time.Since(cachedAt) > time.Duration(ttl)*time.Second
}

// TouchCache updates the cached_at timestamp to now.
func TouchCache(cfg *Config) {
	cfg.CachedAt = time.Now().UTC().Format(time.RFC3339)
}

// -----------------------------------------------------------------------
// Repo-local config (.devscope.yaml)
// -----------------------------------------------------------------------

// RepoConfig represents the per-repo .devscope.yaml file that developers
// commit alongside their code.
type RepoConfig struct {
	Project            string   `yaml:"project"`
	CustomStripPatterns []string `yaml:"custom_strip_patterns"`
}

// LoadRepoConfig reads .devscope.yaml from the given directory.
// Returns nil (no error) if the file does not exist — it is optional.
func LoadRepoConfig(dir string) (*RepoConfig, error) {
	path := filepath.Join(dir, ".devscope.yaml")

	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to read .devscope.yaml: %w", err)
	}

	var rc RepoConfig
	if err := yaml.Unmarshal(data, &rc); err != nil {
		return nil, fmt.Errorf("failed to parse .devscope.yaml: %w", err)
	}
	return &rc, nil
}

// -----------------------------------------------------------------------
// Project resolution
// -----------------------------------------------------------------------

// ResolveProject finds the project to use, following precedence:
//  1. flagSlug (--project flag)
//  2. repoSlug (from .devscope.yaml)
//  3. cfg.DefaultProject
//
// Returns the matching Project and nil error, or an actionable error
// listing available projects if nothing matched.
func ResolveProject(cfg *Config, flagSlug, repoSlug string) (*Project, error) {
	slug := flagSlug
	if slug == "" {
		slug = repoSlug
	}
	if slug == "" {
		slug = cfg.DefaultProject
	}

	if slug == "" {
		return nil, projectNotFoundError(cfg)
	}

	for i := range cfg.Projects {
		if cfg.Projects[i].Slug == slug {
			return &cfg.Projects[i], nil
		}
	}

	return nil, projectNotFoundError(cfg)
}

// projectNotFoundError builds a human-readable error listing available projects.
func projectNotFoundError(cfg *Config) error {
	if len(cfg.Projects) == 0 {
		return fmt.Errorf(
			"No projects configured.\n" +
				"Ask your team lead to assign you to a project, then run \"devscope sync\".",
		)
	}

	msg := "No project configured. Your projects:\n"
	for _, p := range cfg.Projects {
		msg += fmt.Sprintf("  • %s (%s)\n", p.Slug, p.Name)
	}
	msg += "\nRun: devscope run --project=<slug>"
	return errors.New(msg)
}
