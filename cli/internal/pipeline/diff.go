package pipeline

import (
	"path/filepath"
	"strings"
)

// -----------------------------------------------------------------------
// Diff data types
// -----------------------------------------------------------------------

// ChangeType describes how a file changed between two snapshots.
type ChangeType string

const (
	// ChangeAdded means the file exists in the "after" snapshot but not "before".
	ChangeAdded ChangeType = "added"
	// ChangeModified means the file exists in both snapshots but its
	// modification time or size differs.
	ChangeModified ChangeType = "modified"
	// ChangeDeleted means the file exists in the "before" snapshot but not "after".
	ChangeDeleted ChangeType = "deleted"
)

// FileChange represents a single file that changed between two snapshots.
type FileChange struct {
	// Path is the relative path of the changed file.
	Path string `json:"path"`

	// Extension is the file extension without the leading dot, lowercased.
	// Empty for files with no extension.
	Extension string `json:"extension,omitempty"`

	// Change describes the type of change.
	Change ChangeType `json:"change"`
}

// DiffResult contains the full set of changes between two snapshots,
// categorized by change type.
type DiffResult struct {
	Added    []FileChange `json:"added,omitempty"`
	Modified []FileChange `json:"modified,omitempty"`
	Deleted  []FileChange `json:"deleted,omitempty"`
}

// TotalChanged returns the total number of files that differ between
// the two snapshots.
func (d *DiffResult) TotalChanged() int {
	return len(d.Added) + len(d.Modified) + len(d.Deleted)
}

// Extensions returns a deduplicated, sorted slice of all file extensions
// across all change types. Extensions are lowercase, without the leading dot.
func (d *DiffResult) Extensions() []string {
	extSet := make(map[string]bool)

	for _, changes := range [][]FileChange{d.Added, d.Modified, d.Deleted} {
		for _, fc := range changes {
			if fc.Extension != "" {
				extSet[fc.Extension] = true
			}
		}
	}

	result := make([]string, 0, len(extSet))
	for ext := range extSet {
		result = append(result, ext)
	}
	sortStringSlice(result)
	return result
}

// -----------------------------------------------------------------------
// ComputeDiff
// -----------------------------------------------------------------------

// ComputeDiff compares two snapshots and returns the set of files that
// were added, modified, or deleted between them.
//
// A file is considered modified if its modification time OR size changed.
// Path comparison uses the normalized relative paths stored in each snapshot.
func ComputeDiff(before, after *Snapshot) *DiffResult {
	result := &DiffResult{}

	// A diff is only meaningful with both endpoints. If either snapshot is
	// missing (a failed pre- or post-run walk), report nothing changed rather
	// than treating every file as added/deleted.
	if before == nil || after == nil {
		return result
	}

	beforeFiles := before.Files
	afterFiles := after.Files

	// Find added and modified files.
	for path, afterEntry := range afterFiles {
		beforeEntry, existed := beforeFiles[path]
		if !existed {
			result.Added = append(result.Added, newFileChange(path, ChangeAdded))
			continue
		}

		// Compare modification time and size.
		if !afterEntry.ModTime.Equal(beforeEntry.ModTime) || afterEntry.Size != beforeEntry.Size {
			result.Modified = append(result.Modified, newFileChange(path, ChangeModified))
		}
	}

	// Find deleted files.
	for path := range beforeFiles {
		if _, exists := afterFiles[path]; !exists {
			result.Deleted = append(result.Deleted, newFileChange(path, ChangeDeleted))
		}
	}

	// Sort each slice for deterministic output.
	sortFileChanges(result.Added)
	sortFileChanges(result.Modified)
	sortFileChanges(result.Deleted)

	return result
}

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

// newFileChange creates a FileChange with the extension extracted from the path.
func newFileChange(path string, change ChangeType) FileChange {
	return FileChange{
		Path:      path,
		Extension: fileExtension(path),
		Change:    change,
	}
}

// fileExtension returns the lowercase extension without the leading dot.
// Returns empty string if the file has no extension.
func fileExtension(path string) string {
	ext := filepath.Ext(path)
	if ext == "" {
		return ""
	}
	return strings.ToLower(ext[1:])
}

// sortFileChanges sorts a slice of FileChange by Path using insertion sort.
func sortFileChanges(changes []FileChange) {
	for i := 1; i < len(changes); i++ {
		for j := i; j > 0 && changes[j].Path < changes[j-1].Path; j-- {
			changes[j], changes[j-1] = changes[j-1], changes[j]
		}
	}
}

// sortStringSlice sorts strings in place using insertion sort.
func sortStringSlice(s []string) {
	for i := 1; i < len(s); i++ {
		for j := i; j > 0 && s[j] < s[j-1]; j-- {
			s[j], s[j-1] = s[j-1], s[j]
		}
	}
}
