package pipeline

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

// -----------------------------------------------------------------------
// TakeSnapshot tests
// -----------------------------------------------------------------------

func TestTakeSnapshot_BasicFiles(t *testing.T) {
	// Create a temp directory with known files.
	root := t.TempDir()
	createFile(t, root, "main.go", "package main")
	createFile(t, root, "README.md", "# Hello")
	createFile(t, root, filepath.Join("pkg", "util.go"), "package pkg")

	snap, err := TakeSnapshot(root, SnapshotOptions{})
	if err != nil {
		t.Fatalf("TakeSnapshot failed: %v", err)
	}

	// Verify snapshot metadata.
	if snap.Root != root {
		t.Errorf("Root = %q, want %q", snap.Root, root)
	}
	if snap.TakenAt.IsZero() {
		t.Error("TakenAt is zero")
	}

	// Verify all files are captured.
	expectedFiles := []string{"main.go", "README.md", "pkg/util.go"}
	if len(snap.Files) != len(expectedFiles) {
		t.Fatalf("got %d files, want %d", len(snap.Files), len(expectedFiles))
	}

	for _, path := range expectedFiles {
		entry, ok := snap.Files[path]
		if !ok {
			t.Errorf("missing file %q in snapshot", path)
			continue
		}
		if entry.Path != path {
			t.Errorf("entry.Path = %q, want %q", entry.Path, path)
		}
		if entry.Size == 0 {
			t.Errorf("entry.Size for %q is 0", path)
		}
		if entry.ModTime.IsZero() {
			t.Errorf("entry.ModTime for %q is zero", path)
		}
	}
}

func TestTakeSnapshot_SkipsExcludedDirs(t *testing.T) {
	root := t.TempDir()

	// Regular file that should be captured.
	createFile(t, root, "app.go", "package main")

	// Files inside excluded directories — should be skipped.
	createFile(t, root, filepath.Join(".git", "HEAD"), "ref: refs/heads/main")
	createFile(t, root, filepath.Join("node_modules", "lodash", "index.js"), "module.exports = {}")
	createFile(t, root, filepath.Join("vendor", "mod.go"), "package vendor")
	createFile(t, root, filepath.Join("__pycache__", "app.cpython-311.pyc"), "binary")
	createFile(t, root, filepath.Join("coverage", "lcov.info"), "TN:")
	createFile(t, root, filepath.Join("htmlcov", "index.html"), "<html>")

	snap, err := TakeSnapshot(root, SnapshotOptions{})
	if err != nil {
		t.Fatalf("TakeSnapshot failed: %v", err)
	}

	if len(snap.Files) != 1 {
		t.Errorf("got %d files, want 1 (only app.go)", len(snap.Files))
		for path := range snap.Files {
			t.Logf("  unexpected file: %s", path)
		}
	}

	if _, ok := snap.Files["app.go"]; !ok {
		t.Error("missing app.go in snapshot")
	}
}

func TestTakeSnapshot_SkipsHiddenDirs(t *testing.T) {
	root := t.TempDir()

	createFile(t, root, "main.go", "package main")
	createFile(t, root, filepath.Join(".hidden_dir", "secret.go"), "package secret")

	// Without IncludeHiddenDirs.
	snap, err := TakeSnapshot(root, SnapshotOptions{})
	if err != nil {
		t.Fatalf("TakeSnapshot failed: %v", err)
	}

	if _, ok := snap.Files[".hidden_dir/secret.go"]; ok {
		t.Error("hidden directory file should be excluded by default")
	}

	// With IncludeHiddenDirs.
	snap2, err := TakeSnapshot(root, SnapshotOptions{IncludeHiddenDirs: true})
	if err != nil {
		t.Fatalf("TakeSnapshot with IncludeHiddenDirs failed: %v", err)
	}

	if _, ok := snap2.Files[".hidden_dir/secret.go"]; !ok {
		t.Error("hidden directory file should be included when IncludeHiddenDirs is true")
	}
}

func TestTakeSnapshot_IncludesDotFiles(t *testing.T) {
	root := t.TempDir()

	// Dot-prefixed files (not directories) should always be included.
	createFile(t, root, ".gitignore", "node_modules/")
	createFile(t, root, ".env", "SECRET=abc")
	createFile(t, root, ".eslintrc.json", "{}")

	snap, err := TakeSnapshot(root, SnapshotOptions{})
	if err != nil {
		t.Fatalf("TakeSnapshot failed: %v", err)
	}

	for _, name := range []string{".gitignore", ".env", ".eslintrc.json"} {
		if _, ok := snap.Files[name]; !ok {
			t.Errorf("dot-file %q should be included in snapshot", name)
		}
	}
}

func TestTakeSnapshot_CustomExcludeDirs(t *testing.T) {
	root := t.TempDir()

	createFile(t, root, "main.go", "package main")
	createFile(t, root, filepath.Join("custom_skip", "data.go"), "package data")

	snap, err := TakeSnapshot(root, SnapshotOptions{
		ExcludeDirs: []string{"custom_skip"},
	})
	if err != nil {
		t.Fatalf("TakeSnapshot failed: %v", err)
	}

	if _, ok := snap.Files["custom_skip/data.go"]; ok {
		t.Error("custom excluded directory should be skipped")
	}
	if _, ok := snap.Files["main.go"]; !ok {
		t.Error("main.go should still be included")
	}
}

func TestTakeSnapshot_SkipsLargeFiles(t *testing.T) {
	root := t.TempDir()

	createFile(t, root, "small.txt", "hello")

	// Create a file exceeding the max size threshold.
	largePath := filepath.Join(root, "large.bin")
	f, err := os.Create(largePath)
	if err != nil {
		t.Fatalf("failed to create large file: %v", err)
	}
	// Write 1 KB + 1 byte to exceed a 1 KB limit.
	if _, err := f.Write(make([]byte, 1025)); err != nil {
		f.Close()
		t.Fatalf("failed to write large file: %v", err)
	}
	f.Close()

	snap, err := TakeSnapshot(root, SnapshotOptions{
		MaxFileSize: 1024, // 1 KB limit
	})
	if err != nil {
		t.Fatalf("TakeSnapshot failed: %v", err)
	}

	if _, ok := snap.Files["small.txt"]; !ok {
		t.Error("small.txt should be included")
	}
	if _, ok := snap.Files["large.bin"]; ok {
		t.Error("large.bin should be excluded (exceeds MaxFileSize)")
	}
}

func TestTakeSnapshot_EmptyDirectory(t *testing.T) {
	root := t.TempDir()

	snap, err := TakeSnapshot(root, SnapshotOptions{})
	if err != nil {
		t.Fatalf("TakeSnapshot failed: %v", err)
	}

	if len(snap.Files) != 0 {
		t.Errorf("expected 0 files for empty dir, got %d", len(snap.Files))
	}
}

func TestTakeSnapshot_NonexistentDir(t *testing.T) {
	_, err := TakeSnapshot(filepath.Join(t.TempDir(), "does_not_exist"), SnapshotOptions{})
	if err == nil {
		t.Error("expected error for nonexistent directory")
	}
}

func TestTakeSnapshot_PathNormalization(t *testing.T) {
	root := t.TempDir()

	// Create nested files.
	createFile(t, root, filepath.Join("src", "components", "Button.tsx"), "export default Button")

	snap, err := TakeSnapshot(root, SnapshotOptions{})
	if err != nil {
		t.Fatalf("TakeSnapshot failed: %v", err)
	}

	// Paths should use forward slashes regardless of OS.
	expected := "src/components/Button.tsx"
	if _, ok := snap.Files[expected]; !ok {
		t.Errorf("expected path %q with forward slashes", expected)
		for path := range snap.Files {
			t.Logf("  got: %s", path)
		}
	}
}

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

// createFile creates a file with the given contents, creating parent
// directories as needed. The modification time is set explicitly so
// tests are reproducible.
func createFile(t *testing.T, root, relPath, content string) {
	t.Helper()
	absPath := filepath.Join(root, relPath)
	if err := os.MkdirAll(filepath.Dir(absPath), 0o755); err != nil {
		t.Fatalf("failed to create dir for %s: %v", relPath, err)
	}
	if err := os.WriteFile(absPath, []byte(content), 0o644); err != nil {
		t.Fatalf("failed to write %s: %v", relPath, err)
	}
}

// createFileWithTime creates a file and sets its modification time.
func createFileWithTime(t *testing.T, root, relPath, content string, modTime time.Time) {
	t.Helper()
	createFile(t, root, relPath, content)
	absPath := filepath.Join(root, relPath)
	if err := os.Chtimes(absPath, modTime, modTime); err != nil {
		t.Fatalf("failed to set modtime for %s: %v", relPath, err)
	}
}
