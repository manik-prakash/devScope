package agent

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestResolveAgent(t *testing.T) {
	if got := ResolveAgent(" claude "); got != "claude-code" {
		t.Errorf("expected claude-code, got %s", got)
	}
	if got := ResolveAgent("CoDex"); got != "codex" {
		t.Errorf("expected codex, got %s", got)
	}
}

func TestProbeVersion_UnknownFallback(t *testing.T) {
	// Running a completely invalid command returns unknown gracefully
	if got := ProbeVersion("this-command-does-not-exist-1234"); got != "unknown" {
		t.Errorf("expected unknown, got %s", got)
	}
}

// NOTE: TestProbeVersion_Success is hard to write strictly without mocking exec.Command.
// For brevity and CLI robust nature, we accept testing the fallback logic primarily.

func TestFindLatestLogFile(t *testing.T) {
	baseDir := t.TempDir()

	// Simulate ~/.claude directory
	claudeDir := filepath.Join(baseDir, ".claude")
	os.MkdirAll(claudeDir, 0755)

	// Older file
	oldFile := filepath.Join(claudeDir, "old.jsonl")
	os.WriteFile(oldFile, []byte("old text"), 0644)
	
	// Create slight delay so mod times differ significantly
	time.Sleep(10 * time.Millisecond)

	// Newer file
	newFile := filepath.Join(claudeDir, "new.jsonl")
	os.WriteFile(newFile, []byte("new text"), 0644)

	// Distraction non-log file (even if newer, should skip)
	time.Sleep(10 * time.Millisecond)
	errFile := filepath.Join(claudeDir, "ignore.txt")
	os.WriteFile(errFile, []byte("text"), 0644)

	found := FindLatestLogFile("claude", baseDir)
	
	if found != newFile {
		t.Errorf("FindLatestLogFile: got %v, want %v", found, newFile)
	}
}

func TestFindLatestLogFile_MissingDir(t *testing.T) {
	baseDir := t.TempDir()
	
	// Dir doesn't exist
	found := FindLatestLogFile("claude", baseDir)
	if found != "" {
		t.Errorf("Expected empty string on missing directory, got %s", found)
	}
}
