package pipeline

import (
	"fmt"
	"os"
	"path/filepath"
	"time"
)

// AppendRedactionLog records that a session had `count` secrets scrubbed. It
// writes one tab-separated line — "<RFC3339>\t<sessionID>\t<count>\n" — to the
// given path, creating the parent directory and file if needed. Only the counts
// are logged; no redacted content ever touches disk.
func AppendRedactionLog(path, sessionID string, count int) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return fmt.Errorf("failed to create log directory: %w", err)
	}

	f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o600)
	if err != nil {
		return fmt.Errorf("failed to open redaction log: %w", err)
	}
	defer f.Close()

	line := fmt.Sprintf("%s\t%s\t%d\n", time.Now().UTC().Format(time.RFC3339), sessionID, count)
	if _, err := f.WriteString(line); err != nil {
		return fmt.Errorf("failed to write redaction log: %w", err)
	}
	return nil
}
