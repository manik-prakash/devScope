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

	found := FindLatestLogFile("claude", baseDir, time.Time{})

	if found != newFile {
		t.Errorf("FindLatestLogFile: got %v, want %v", found, newFile)
	}
}

func TestFindLatestLogFile_MissingDir(t *testing.T) {
	baseDir := t.TempDir()

	// Dir doesn't exist
	found := FindLatestLogFile("claude", baseDir, time.Time{})
	if found != "" {
		t.Errorf("Expected empty string on missing directory, got %s", found)
	}
}

func TestFindLatestLogFile_SkipsNonTranscriptFiles(t *testing.T) {
	baseDir := t.TempDir()
	claudeDir := filepath.Join(baseDir, ".claude")
	os.MkdirAll(filepath.Join(claudeDir, "projects", "repo"), 0o755)
	os.MkdirAll(filepath.Join(claudeDir, "todos"), 0o755)

	transcript := filepath.Join(claudeDir, "projects", "repo", "abc.jsonl")
	os.WriteFile(transcript, []byte("{}"), 0o644)

	// All newer than the transcript, all must be ignored.
	time.Sleep(10 * time.Millisecond)
	os.WriteFile(filepath.Join(claudeDir, "settings.json"), []byte("{}"), 0o644)
	os.WriteFile(filepath.Join(claudeDir, ".credentials.json"), []byte("{}"), 0o644)
	os.WriteFile(filepath.Join(claudeDir, "history.jsonl"), []byte("{}"), 0o644)
	os.WriteFile(filepath.Join(claudeDir, "todos", "x.json"), []byte("{}"), 0o644)

	found := FindLatestLogFile("claude", baseDir, time.Time{})
	if found != transcript {
		t.Errorf("FindLatestLogFile: got %v, want the real transcript %v", found, transcript)
	}
}

func TestFindLatestLogFile_SkipsFilesOlderThanNotBefore(t *testing.T) {
	baseDir := t.TempDir()
	claudeDir := filepath.Join(baseDir, ".claude")
	os.MkdirAll(claudeDir, 0o755)

	stale := filepath.Join(claudeDir, "stale.jsonl")
	os.WriteFile(stale, []byte("{}"), 0o644)
	old := time.Now().Add(-2 * time.Hour)
	os.Chtimes(stale, old, old)

	found := FindLatestLogFile("claude", baseDir, time.Now().Add(-1*time.Hour))
	if found != "" {
		t.Errorf("expected stale file to be ignored, got %q", found)
	}
}
