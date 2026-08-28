package pipeline

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestAppendRedactionLog(t *testing.T) {
	path := filepath.Join(t.TempDir(), "logs", "redaction.log")

	if err := AppendRedactionLog(path, "sess-1", 3); err != nil {
		t.Fatalf("first append failed: %v", err)
	}
	if err := AppendRedactionLog(path, "sess-2", 0); err != nil {
		t.Fatalf("second append failed: %v", err)
	}

	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read log: %v", err)
	}

	lines := strings.Split(strings.TrimRight(string(data), "\n"), "\n")
	if len(lines) != 2 {
		t.Fatalf("expected 2 lines, got %d: %q", len(lines), string(data))
	}

	first := strings.Split(lines[0], "\t")
	if len(first) != 3 || first[1] != "sess-1" || first[2] != "3" {
		t.Fatalf("line 1 malformed: %q", lines[0])
	}
	second := strings.Split(lines[1], "\t")
	if second[1] != "sess-2" || second[2] != "0" {
		t.Fatalf("line 2 malformed: %q", lines[1])
	}
}
