package pipeline

import (
	"testing"
	"time"
)

// -----------------------------------------------------------------------
// ComputeDiff tests
// -----------------------------------------------------------------------

func TestComputeDiff_AllAdded(t *testing.T) {
	before := &Snapshot{Files: map[string]FileEntry{}}
	after := &Snapshot{Files: map[string]FileEntry{
		"main.go":     {Path: "main.go", Size: 100, ModTime: time.Now()},
		"README.md":   {Path: "README.md", Size: 50, ModTime: time.Now()},
		"pkg/util.go": {Path: "pkg/util.go", Size: 200, ModTime: time.Now()},
	}}

	diff := ComputeDiff(before, after)

	if len(diff.Added) != 3 {
		t.Errorf("Added count = %d, want 3", len(diff.Added))
	}
	if len(diff.Modified) != 0 {
		t.Errorf("Modified count = %d, want 0", len(diff.Modified))
	}
	if len(diff.Deleted) != 0 {
		t.Errorf("Deleted count = %d, want 0", len(diff.Deleted))
	}
	if diff.TotalChanged() != 3 {
		t.Errorf("TotalChanged = %d, want 3", diff.TotalChanged())
	}
}

func TestComputeDiff_AllDeleted(t *testing.T) {
	now := time.Now()
	before := &Snapshot{Files: map[string]FileEntry{
		"main.go":   {Path: "main.go", Size: 100, ModTime: now},
		"README.md": {Path: "README.md", Size: 50, ModTime: now},
	}}
	after := &Snapshot{Files: map[string]FileEntry{}}

	diff := ComputeDiff(before, after)

	if len(diff.Deleted) != 2 {
		t.Errorf("Deleted count = %d, want 2", len(diff.Deleted))
	}
	if len(diff.Added) != 0 {
		t.Errorf("Added count = %d, want 0", len(diff.Added))
	}
	if len(diff.Modified) != 0 {
		t.Errorf("Modified count = %d, want 0", len(diff.Modified))
	}
}

func TestComputeDiff_Modified_SizeChange(t *testing.T) {
	now := time.Now()
	before := &Snapshot{Files: map[string]FileEntry{
		"main.go": {Path: "main.go", Size: 100, ModTime: now},
	}}
	after := &Snapshot{Files: map[string]FileEntry{
		"main.go": {Path: "main.go", Size: 200, ModTime: now}, // same time, different size
	}}

	diff := ComputeDiff(before, after)

	if len(diff.Modified) != 1 {
		t.Errorf("Modified count = %d, want 1", len(diff.Modified))
	}
	if diff.Modified[0].Path != "main.go" {
		t.Errorf("Modified path = %q, want %q", diff.Modified[0].Path, "main.go")
	}
}

func TestComputeDiff_Modified_TimeChange(t *testing.T) {
	t1 := time.Date(2026, 1, 1, 10, 0, 0, 0, time.UTC)
	t2 := time.Date(2026, 1, 1, 11, 0, 0, 0, time.UTC)

	before := &Snapshot{Files: map[string]FileEntry{
		"main.go": {Path: "main.go", Size: 100, ModTime: t1},
	}}
	after := &Snapshot{Files: map[string]FileEntry{
		"main.go": {Path: "main.go", Size: 100, ModTime: t2}, // same size, different time
	}}

	diff := ComputeDiff(before, after)

	if len(diff.Modified) != 1 {
		t.Errorf("Modified count = %d, want 1", len(diff.Modified))
	}
}

func TestComputeDiff_Mixed(t *testing.T) {
	t1 := time.Date(2026, 1, 1, 10, 0, 0, 0, time.UTC)
	t2 := time.Date(2026, 1, 1, 11, 0, 0, 0, time.UTC)

	before := &Snapshot{Files: map[string]FileEntry{
		"existing.go":  {Path: "existing.go", Size: 100, ModTime: t1},
		"modified.tsx": {Path: "modified.tsx", Size: 200, ModTime: t1},
		"deleted.sql":  {Path: "deleted.sql", Size: 50, ModTime: t1},
	}}
	after := &Snapshot{Files: map[string]FileEntry{
		"existing.go":  {Path: "existing.go", Size: 100, ModTime: t1},  // unchanged
		"modified.tsx": {Path: "modified.tsx", Size: 300, ModTime: t2}, // changed
		"new_file.py":  {Path: "new_file.py", Size: 150, ModTime: t2}, // added
	}}

	diff := ComputeDiff(before, after)

	if len(diff.Added) != 1 {
		t.Errorf("Added count = %d, want 1", len(diff.Added))
	} else if diff.Added[0].Path != "new_file.py" {
		t.Errorf("Added[0].Path = %q, want %q", diff.Added[0].Path, "new_file.py")
	}

	if len(diff.Modified) != 1 {
		t.Errorf("Modified count = %d, want 1", len(diff.Modified))
	} else if diff.Modified[0].Path != "modified.tsx" {
		t.Errorf("Modified[0].Path = %q, want %q", diff.Modified[0].Path, "modified.tsx")
	}

	if len(diff.Deleted) != 1 {
		t.Errorf("Deleted count = %d, want 1", len(diff.Deleted))
	} else if diff.Deleted[0].Path != "deleted.sql" {
		t.Errorf("Deleted[0].Path = %q, want %q", diff.Deleted[0].Path, "deleted.sql")
	}

	if diff.TotalChanged() != 3 {
		t.Errorf("TotalChanged = %d, want 3", diff.TotalChanged())
	}
}

func TestComputeDiff_NoChanges(t *testing.T) {
	now := time.Date(2026, 3, 1, 12, 0, 0, 0, time.UTC)
	files := map[string]FileEntry{
		"main.go":   {Path: "main.go", Size: 100, ModTime: now},
		"README.md": {Path: "README.md", Size: 50, ModTime: now},
	}

	before := &Snapshot{Files: files}
	after := &Snapshot{Files: files}

	diff := ComputeDiff(before, after)

	if diff.TotalChanged() != 0 {
		t.Errorf("TotalChanged = %d, want 0 for identical snapshots", diff.TotalChanged())
	}
}

func TestComputeDiff_NilSnapshots(t *testing.T) {
	// Both nil.
	diff := ComputeDiff(nil, nil)
	if diff.TotalChanged() != 0 {
		t.Errorf("TotalChanged = %d, want 0 for nil snapshots", diff.TotalChanged())
	}

	// Before nil, after has files.
	now := time.Now()
	after := &Snapshot{Files: map[string]FileEntry{
		"main.go": {Path: "main.go", Size: 100, ModTime: now},
	}}
	diff = ComputeDiff(nil, after)
	if len(diff.Added) != 1 {
		t.Errorf("Added count = %d, want 1 when before is nil", len(diff.Added))
	}

	// Before has files, after nil.
	before := &Snapshot{Files: map[string]FileEntry{
		"old.go": {Path: "old.go", Size: 100, ModTime: now},
	}}
	diff = ComputeDiff(before, nil)
	if len(diff.Deleted) != 1 {
		t.Errorf("Deleted count = %d, want 1 when after is nil", len(diff.Deleted))
	}
}

func TestComputeDiff_Extensions(t *testing.T) {
	t1 := time.Date(2026, 1, 1, 10, 0, 0, 0, time.UTC)
	t2 := time.Date(2026, 1, 1, 11, 0, 0, 0, time.UTC)

	before := &Snapshot{Files: map[string]FileEntry{
		"deleted.sql": {Path: "deleted.sql", Size: 50, ModTime: t1},
	}}
	after := &Snapshot{Files: map[string]FileEntry{
		"new.go":       {Path: "new.go", Size: 100, ModTime: t2},
		"styles.css":   {Path: "styles.css", Size: 200, ModTime: t2},
		"component.GO": {Path: "component.GO", Size: 150, ModTime: t2}, // uppercase ext
	}}

	diff := ComputeDiff(before, after)
	exts := diff.Extensions()

	// Should have: css, go, sql (deduplicated, sorted).
	expectedExts := []string{"css", "go", "sql"}
	if len(exts) != len(expectedExts) {
		t.Fatalf("Extensions count = %d, want %d; got %v", len(exts), len(expectedExts), exts)
	}
	for i, ext := range expectedExts {
		if exts[i] != ext {
			t.Errorf("Extensions[%d] = %q, want %q", i, exts[i], ext)
		}
	}
}

func TestComputeDiff_ExtensionsDeduplicated(t *testing.T) {
	t1 := time.Date(2026, 1, 1, 10, 0, 0, 0, time.UTC)
	t2 := time.Date(2026, 1, 1, 11, 0, 0, 0, time.UTC)

	before := &Snapshot{Files: map[string]FileEntry{}}
	after := &Snapshot{Files: map[string]FileEntry{
		"main.go":     {Path: "main.go", Size: 100, ModTime: t1},
		"util.go":     {Path: "util.go", Size: 200, ModTime: t2},
		"handler.go":  {Path: "handler.go", Size: 150, ModTime: t2},
		"config.yaml": {Path: "config.yaml", Size: 50, ModTime: t2},
	}}

	diff := ComputeDiff(before, after)
	exts := diff.Extensions()

	// Should have: go, yaml (deduplicated).
	if len(exts) != 2 {
		t.Fatalf("Extensions count = %d, want 2; got %v", len(exts), exts)
	}
	if exts[0] != "go" || exts[1] != "yaml" {
		t.Errorf("Extensions = %v, want [go yaml]", exts)
	}
}

func TestComputeDiff_NoExtensionFiles(t *testing.T) {
	t1 := time.Date(2026, 1, 1, 10, 0, 0, 0, time.UTC)

	before := &Snapshot{Files: map[string]FileEntry{}}
	after := &Snapshot{Files: map[string]FileEntry{
		"Makefile":   {Path: "Makefile", Size: 100, ModTime: t1},
		"Dockerfile": {Path: "Dockerfile", Size: 200, ModTime: t1},
		"main.go":    {Path: "main.go", Size: 50, ModTime: t1},
	}}

	diff := ComputeDiff(before, after)
	exts := diff.Extensions()

	// Only "go" — Makefile and Dockerfile have no extension.
	if len(exts) != 1 || exts[0] != "go" {
		t.Errorf("Extensions = %v, want [go]", exts)
	}
}

func TestComputeDiff_SortedResults(t *testing.T) {
	t1 := time.Date(2026, 1, 1, 10, 0, 0, 0, time.UTC)

	before := &Snapshot{Files: map[string]FileEntry{}}
	after := &Snapshot{Files: map[string]FileEntry{
		"z_last.go":   {Path: "z_last.go", Size: 100, ModTime: t1},
		"a_first.go":  {Path: "a_first.go", Size: 200, ModTime: t1},
		"m_middle.go": {Path: "m_middle.go", Size: 150, ModTime: t1},
	}}

	diff := ComputeDiff(before, after)

	// Added should be sorted by path.
	if len(diff.Added) != 3 {
		t.Fatalf("Added count = %d, want 3", len(diff.Added))
	}
	if diff.Added[0].Path != "a_first.go" {
		t.Errorf("Added[0].Path = %q, want %q", diff.Added[0].Path, "a_first.go")
	}
	if diff.Added[1].Path != "m_middle.go" {
		t.Errorf("Added[1].Path = %q, want %q", diff.Added[1].Path, "m_middle.go")
	}
	if diff.Added[2].Path != "z_last.go" {
		t.Errorf("Added[2].Path = %q, want %q", diff.Added[2].Path, "z_last.go")
	}
}

func TestFileExtension(t *testing.T) {
	tests := []struct {
		path string
		want string
	}{
		{"main.go", "go"},
		{"styles.CSS", "css"},
		{"config.yaml", "yaml"},
		{"Makefile", ""},
		{"archive.tar.gz", "gz"},
		{".gitignore", "gitignore"},
		{"path/to/file.tsx", "tsx"},
		{"no_ext", ""},
	}

	for _, tt := range tests {
		got := fileExtension(tt.path)
		if got != tt.want {
			t.Errorf("fileExtension(%q) = %q, want %q", tt.path, got, tt.want)
		}
	}
}
