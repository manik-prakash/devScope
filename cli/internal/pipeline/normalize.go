package pipeline

import (
	"errors"
	"sort"
	"strings"

	"github.com/manik-prakash/devscope-cli/internal/agent/adapters"
)

// Normalize performs in-place generic cleanup and validation on a parsed session
// from any adapter before it enters the redaction and extraction phases.
func Normalize(sess *adapters.NormalizedSession) error {
	if sess == nil {
		return errors.New("cannot normalize nil session")
	}

	if sess.SessionID == "" {
		return errors.New("missing session ID")
	}

	// 1. Filter empty messages
	var filtered []adapters.NormalizedMessage
	for _, msg := range sess.Messages {
		if msg.ContentLength == 0 && len(msg.ToolCalls) == 0 {
			// Skip entirely empty messages that add no analytical value
			continue
		}
		filtered = append(filtered, msg)
	}
	sess.Messages = filtered

	// 2. Sort messages chronologically.
	// Stable sort + only reorder a pair when BOTH timestamps are real. Go's zero
	// time.Time is "before" every real time, so comparing a zero against a real
	// one would yank every timestamp-less message to the front and scramble logs
	// that only carry partial timestamps (common for Codex). Leaving those pairs
	// "equal" keeps them in parsed order.
	sort.SliceStable(sess.Messages, func(i, j int) bool {
		ti := sess.Messages[i].Timestamp
		tj := sess.Messages[j].Timestamp

		if ti.IsZero() || tj.IsZero() {
			return false
		}
		return ti.Before(tj)
	})

	// 3. Derive missing session-level timestamps
	if sess.StartedAt.IsZero() {
		for _, msg := range sess.Messages {
			if !msg.Timestamp.IsZero() {
				sess.StartedAt = msg.Timestamp
				break
			}
		}
	}

	if sess.EndedAt.IsZero() {
		// Iterate backwards to find the last valid timestamp
		for i := len(sess.Messages) - 1; i >= 0; i-- {
			if !sess.Messages[i].Timestamp.IsZero() {
				sess.EndedAt = sess.Messages[i].Timestamp
				break
			}
		}
	}

	// If StartedAt or EndedAt are still zero, duration will be calculated as 0 naturally later.
	// But if EndedAt is before StartedAt (due to weird clock skew or out-of-order partial timestamps),
	// clamp it to StartedAt to prevent negative duration.
	if !sess.StartedAt.IsZero() && !sess.EndedAt.IsZero() {
		if sess.EndedAt.Before(sess.StartedAt) {
			sess.EndedAt = sess.StartedAt
		}
	}

	// 4. Deduplicate and clean file extensions
	extSet := make(map[string]bool)
	for _, ext := range sess.FileExtensions {
		clean := strings.ToLower(strings.TrimSpace(ext))
		// Optional: strip leading dot if any adapter leaked it
		clean = strings.TrimPrefix(clean, ".")
		if clean != "" {
			extSet[clean] = true
		}
	}

	var cleanedExts []string
	for ext := range extSet {
		cleanedExts = append(cleanedExts, ext)
	}
	sort.Strings(cleanedExts)
	sess.FileExtensions = cleanedExts

	return nil
}
