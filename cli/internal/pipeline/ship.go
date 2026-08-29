package pipeline

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/manik-prakash/devscope-cli/internal/api"
)

// SessionSubmitter defines the interface for backend payload tracking.
// Provided organically by api.Client.
type SessionSubmitter interface {
	SubmitSession(payload *api.SessionPayload) *api.SubmitResult
}

// ShipSession attempts to transport the session payload.
// On network disruption or explicit rate limiting (Retriable=true), it queues
// the serialized JSON file locally to automatically retry downstream.
func ShipSession(client SessionSubmitter, queueDir string, payload *api.SessionPayload) error {
	if payload == nil {
		return fmt.Errorf("cannot ship nil payload")
	}

	result := client.SubmitSession(payload)

	// Immediate Success
	if result.Accepted {
		return nil
	}

	// Terminal fail, return error immediately so CLI can prompt the user
	if !result.Retriable {
		return fmt.Errorf("session rejected permanently: %w", result.Err)
	}

	// Retriable Fail, queue aggressively
	if queueDir == "" {
		return fmt.Errorf("queue directory unavailable: %w", result.Err)
	}

	rawBytes, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal offline payload (original error: %v): %w", result.Err, err)
	}

	if err := os.MkdirAll(queueDir, 0o700); err != nil {
		return fmt.Errorf("failed to create queue dir (original error: %v): %w", result.Err, err)
	}

	// Write to a temp file then rename so a kill mid-write can't leave a
	// truncated payload that DrainQueue would later quarantine or drop.
	queuePath := filepath.Join(queueDir, fmt.Sprintf("%s.json", payload.SessionID))
	tmpPath := queuePath + ".tmp"

	if err := os.WriteFile(tmpPath, rawBytes, 0o600); err != nil {
		return fmt.Errorf("failed to queue session locally (original error: %v): %w", result.Err, err)
	}
	if err := os.Rename(tmpPath, queuePath); err != nil {
		os.Remove(tmpPath)
		return fmt.Errorf("failed to finalize queued session (original error: %v): %w", result.Err, err)
	}

	// We return nil to signify the workflow itself is handled properly.
	// Or we can return a formatted wrap. In our design, queued is effectively a background success.
	return nil
}

// DrainQueue systematically recovers offline payloads and attempts to flush them up.
// Terminal failures instantly delete the payload to avoid constant gridlock.
// Retriable failures persist, returning dynamically so the execution loop skips the rest intelligently.
// Returns (shippedCount, failedCount).
func DrainQueue(client SessionSubmitter, queueDir string) (int, int) {
	if queueDir == "" {
		return 0, 0
	}

	entries, err := os.ReadDir(queueDir)
	if err != nil {
		return 0, 0
	}

	shipped := 0
	failed := 0

	for _, entry := range entries {
		// Only whole `.json` payloads — skip `.tmp` (in-flight writes) and
		// `.corrupt` (already quarantined).
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".json" {
			continue
		}

		fullPath := filepath.Join(queueDir, entry.Name())
		rawBytes, err := os.ReadFile(fullPath)
		if err != nil {
			failed++
			continue
		}

		var payload api.SessionPayload
		if err := json.Unmarshal(rawBytes, &payload); err != nil {
			// Malformed — quarantine rather than delete, so a truncated write
			// (machine sleep / crash) is recoverable and not silent data loss.
			os.Rename(fullPath, fullPath+".corrupt")
			failed++
			continue
		}

		result := client.SubmitSession(&payload)

		if result.Accepted {
			os.Remove(fullPath)
			shipped++
			continue
		}

		if result.Retriable {
			// Network still down or rate limited, stop draining to prevent rapid-fire hammering
			failed++
			break
		}

		// Permanent 400 rejection (unauthorized, structural schema drift), purge
		os.Remove(fullPath)
		failed++
	}

	return shipped, failed
}
