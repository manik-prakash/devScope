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

	// 2. Sort messages chronologically
	// We use a stable sort to preserve the original parsed order when timestamps are identical or zero.
	sort.SliceStable(sess.Messages, func(i, j int) bool {
		ti := sess.Messages[i].Timestamp
		tj := sess.Messages[j].Timestamp

		// If both are zero, preserve original order
		if ti.IsZero() && tj.IsZero() {
			return false 
		}
		// If only one is zero, push the zero-timestamp to the start (or end - here we place it early)
		// But ideally if partial timestamps exist, the zero ones are just left where they were relative
		// to stable sort. Standard Time.Before says zero time is before any real time.
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
