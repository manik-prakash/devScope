package cmd

import (
	"os"
	"path/filepath"
	"testing"
)

func TestStatusCmd_Registration(t *testing.T) {
	if statusCmd.Use != "status" {
		t.Errorf("Unexpected use signature: %s", statusCmd.Use)
	}

	flag := statusCmd.Flags().Lookup("project")
	if flag == nil {
		t.Errorf("Expected project flag")
	}
	if flag.Shorthand != "p" {
		t.Errorf("Expected shorthand project flag p")
	}
}

func TestOfflineQueueCount(t *testing.T) {
	queueDir := t.TempDir()

	if c := offlineQueueCount(queueDir); c != 0 {
		t.Errorf("Expected 0 on empty directory, got %d", c)
	}

	// Create a valid json
	os.WriteFile(filepath.Join(queueDir, "valid-123.json"), []byte("{}"), 0644)
	
	// Create another valid json
	os.WriteFile(filepath.Join(queueDir, "valid-456.json"), []byte("{}"), 0644)

	// Create ignored files
	os.WriteFile(filepath.Join(queueDir, "ignored.txt"), []byte("..."), 0644)
	os.WriteFile(filepath.Join(queueDir, ".json"), []byte("{}"), 0644) // too short

	os.MkdirAll(filepath.Join(queueDir, "nested.json"), 0755) // is a directory, not a file

	if c := offlineQueueCount(queueDir); c != 2 {
		t.Errorf("Expected exactly 2 valid payloads tracked, got %d", c)
	}
}

func TestCheckRelease_SilentlyFails(t *testing.T) {
	// The function expects to reach github.com. Let's make sure it doesn't crash 
	// natively if we just call it (since tests are networked).
	// Strictly validating it doesn't panic.
	_ = checkRelease()
}
