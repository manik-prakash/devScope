package agent

import (
	"bytes"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

// ResolveAgent normalizes the agent binary name to our preferred platform slugs.
func ResolveAgent(agentCmd string) string {
	slug := strings.ToLower(strings.TrimSpace(agentCmd))
	// Example alias mappings
	if slug == "claude" {
		return "claude-code"
	}
	return slug
}

// ProbeVersion aggressively executes the specified agent with a --version flag
// to harvest its internal build number silently. Defaults gracefully to "unknown"
// to prevent environmental misconfigurations from ruining pipeline tracking.
func ProbeVersion(agentCmd string) string {
	cmd := exec.Command(agentCmd, "--version")
	
	// Create buffers directly to prevent user disruption
	var out bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &out 

	if err := cmd.Run(); err != nil {
		return "unknown"
	}

	result := strings.TrimSpace(out.String())
	if result == "" {
		return "unknown"
	}

	// Sometimes agents output verbose strings: "Claude Code v1.2.3 (darwin x64)"
	// A more robust implementation might regex this, but for now we take the first line
	lines := strings.Split(result, "\n")
	return strings.TrimSpace(lines[0])
}

// FindLatestLogFile navigates conventional operating system structures looking for
// specifically dropped json logs. BaseDir can be injected or resolved via os.UserHomeDir().
func FindLatestLogFile(agentSlug string, baseDir string) string {
	if baseDir == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			return ""
		}
		baseDir = home
	}

	var searchPath string
	
	// Predictable locations for standard tools
	switch agentSlug {
	case "claude-code", "claude":
		searchPath = filepath.Join(baseDir, ".claude")
	case "codex":
		searchPath = filepath.Join(baseDir, ".codex")
	default:
		// Attempting generically
		searchPath = filepath.Join(baseDir, "."+agentSlug)
	}

	var latestFile string
	var latestTime time.Time

	// Walk cautiously
	err := filepath.WalkDir(searchPath, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil // Skip entirely rather than block parsing
		}
		
		if d.IsDir() {
			return nil
		}

		if filepath.Ext(d.Name()) == ".jsonl" || filepath.Ext(d.Name()) == ".json" {
			info, iErr := d.Info()
			if iErr != nil {
				return nil
			}
			
			if info.ModTime().After(latestTime) {
				latestTime = info.ModTime()
				latestFile = path
			}
		}

		return nil
	})

	if err != nil {
		return ""
	}

	return latestFile
}
