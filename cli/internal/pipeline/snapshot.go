// Package pipeline implements the DevScope session processing pipeline.
//
// This file provides filesystem snapshot functionality: capturing file
// metadata (paths, modification times, sizes) for a directory tree so
// that two snapshots can be compared to determine what changed during
// a coding session.
package pipeline

import (
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// -----------------------------------------------------------------------
// Default exclusions
// -----------------------------------------------------------------------

// defaultExcludeDirs are directory names skipped during snapshot walks.
// These are dependency, build, IDE, and VCS directories that would add
// noise without providing useful signal about developer activity.
var defaultExcludeDirs = map[string]bool{
	".git":          true,
	".hg":           true,
	".svn":          true,
	".devscope":     true,
	"node_modules":  true,
	"vendor":        true,
	"__pycache__":   true,
	".venv":         true,
	"venv":          true,
	".idea":         true,
	".vscode":       true,
	"dist":          true,
	"build":         true,
	"target":        true,
	".next":         true,
	".nuxt":         true,
	".output":       true,
	".cache":        true,
	".parcel-cache": true,
	".turbo":        true,
}

// defaultMaxFileSize is the maximum file size (in bytes) to include in
// a snapshot. Files larger than this are skipped. Default: 50 MB.
const defaultMaxFileSize int64 = 50 * 1024 * 1024

// -----------------------------------------------------------------------
// Data types
// -----------------------------------------------------------------------

// FileEntry represents a single file's metadata in a snapshot.
type FileEntry struct {
	// Path is the path relative to the snapshot root.
	Path string `json:"path"`

	// ModTime is the last modification time of the file.
	ModTime time.Time `json:"mod_time"`

	// Size is the file size in bytes.
	Size int64 `json:"size"`
}

// Snapshot is a point-in-time capture of file metadata for a directory.
// Files are keyed by their path relative to Root, ensuring consistent
// comparison regardless of absolute path differences.
type Snapshot struct {
	// TakenAt is when this snapshot was captured.
	TakenAt time.Time `json:"taken_at"`

	// Root is the absolute path of the directory that was snapshotted.
	Root string `json:"root"`

	// Files maps relative paths to their metadata.
	Files map[string]FileEntry `json:"files"`
}

// SnapshotOptions configures snapshot behavior.
type SnapshotOptions struct {
	// ExcludeDirs are additional directory names to skip, merged with
	// the built-in defaults. Only base names are matched, not paths.
	ExcludeDirs []string

	// MaxFileSize skips files larger than this (bytes).
	// Zero uses the default (50 MB).
	MaxFileSize int64

	// IncludeHiddenDirs controls whether dot-prefixed directories
	// (other than the hardcoded exclusions) are walked.
	// Default false: hidden directories are skipped.
	// Note: dot-prefixed *files* (e.g. .gitignore, .env) are always
	// included regardless of this setting.
	IncludeHiddenDirs bool
}

// -----------------------------------------------------------------------
// TakeSnapshot
// -----------------------------------------------------------------------

// TakeSnapshot walks rootDir recursively and returns a Snapshot containing
// metadata for every regular file that passes the exclusion filters.
//
// It never reads file contents — only os.Stat metadata is captured.
// Symlinks are not followed.
func TakeSnapshot(rootDir string, opts SnapshotOptions) (*Snapshot, error) {
	absRoot, err := filepath.Abs(rootDir)
	if err != nil {
		return nil, fmt.Errorf("failed to resolve root directory: %w", err)
	}

	// Verify rootDir exists and is a directory.
	info, err := os.Stat(absRoot)
	if err != nil {
		return nil, fmt.Errorf("failed to stat root directory %s: %w", absRoot, err)
	}
	if !info.IsDir() {
		return nil, fmt.Errorf("%s is not a directory", absRoot)
	}

	// Build the merged exclusion set.
	excludeSet := mergeExcludeSets(opts.ExcludeDirs)

	maxSize := opts.MaxFileSize
	if maxSize <= 0 {
		maxSize = defaultMaxFileSize
	}

	snap := &Snapshot{
		TakenAt: time.Now().UTC(),
		Root:    absRoot,
		Files:   make(map[string]FileEntry),
	}

	err = filepath.WalkDir(absRoot, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			// Skip entries we cannot access rather than aborting the
			// entire walk. Permission errors on a few dirs are common.
			return nil
		}

		name := d.Name()

		// --- Directory filtering ---
		if d.IsDir() {
			// Never descend into excluded directories.
			if excludeSet[name] {
				return filepath.SkipDir
			}
			// Skip hidden directories unless explicitly included.
			if !opts.IncludeHiddenDirs && strings.HasPrefix(name, ".") && path != absRoot {
				return filepath.SkipDir
			}
			return nil
		}

		// --- File filtering ---

		// Skip symlinks.
		if d.Type()&os.ModeSymlink != 0 {
			return nil
		}

		// Only regular files.
		if !d.Type().IsRegular() {
			return nil
		}

		fi, err := d.Info()
		if err != nil {
			return nil // skip unreadable files
		}

		// Skip files exceeding the size limit.
		if fi.Size() > maxSize {
			return nil
		}

		relPath, err := filepath.Rel(absRoot, path)
		if err != nil {
			return nil
		}

		// Normalize path separators to forward slashes for consistent
		// cross-platform comparison.
		relPath = filepath.ToSlash(relPath)

		snap.Files[relPath] = FileEntry{
			Path:    relPath,
			ModTime: fi.ModTime().UTC(),
			Size:    fi.Size(),
		}

		return nil
	})

	if err != nil {
		return nil, fmt.Errorf("error walking directory %s: %w", absRoot, err)
	}

	return snap, nil
}

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

// mergeExcludeSets combines the default exclusion set with user-provided
// additional directory names.
func mergeExcludeSets(additional []string) map[string]bool {
	merged := make(map[string]bool, len(defaultExcludeDirs)+len(additional))
	for k, v := range defaultExcludeDirs {
		merged[k] = v
	}
	for _, name := range additional {
		if name != "" {
			merged[name] = true
		}
	}
	return merged
}
