package pipeline

import (
	"bytes"
	"encoding/json"
	"fmt"
	"regexp"

	"github.com/manik-prakash/devscope-cli/internal/agent/adapters"
)

// builtInPatterns contains common patterns for secrets that should unconditionally be redacted.
var builtInPatterns = []string{
	// AWS access keys and secrets (simplified)
	`(?i)(?:aws(?:_access_key_id|_secret_access_key|-secret)?\s*=\s*)([A-Z0-9]{20,40})`,
	// Generic Bearer Tokens
	`(?i)(?:bearer\s+)([a-zA-Z0-9_\-\.]{20,})`,
	// GitHub Tokens
	`(?:gh[pousr]_[A-Za-z0-9_]{36,255})`,
	// Private Keys
	`(?:-----BEGIN\s+(?:RSA|OPENSSH|DSA|EC|PGP)?\s*PRIVATE\s+KEY-----[\s\S]*?-----END\s+(?:RSA|OPENSSH|DSA|EC|PGP)?\s*PRIVATE\s+KEY-----)`,
}

var compiledBuiltIns []*regexp.Regexp

func init() {
	for _, p := range builtInPatterns {
		compiledBuiltIns = append(compiledBuiltIns, regexp.MustCompile(p))
	}
}

// RedactSession serializes the session to JSON, applies built-in and custom regex
// redaction patterns across the raw string, and deserializes back into a new NormalizedSession.
// It returns the new session and the total number of replacements made.
func RedactSession(sess *adapters.NormalizedSession, customPatterns []string) (*adapters.NormalizedSession, int, error) {
	if sess == nil {
		return nil, 0, fmt.Errorf("cannot redact nil session")
	}

	// 1. Serialize entire normalized session to JSON text
	rawBytes, err := json.Marshal(sess)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to marshal session for redaction: %w", err)
	}

	// 2. Compile custom patterns provided by config
	var compiledCustoms []*regexp.Regexp
	for _, pattern := range customPatterns {
		if pattern == "" {
			continue
		}
		rx, err := regexp.Compile(pattern)
		if err != nil {
			// Skip invalid custom regexes rather than block the whole CLI,
			// but in an ideal world we'd log a warning.
			continue
		}
		compiledCustoms = append(compiledCustoms, rx)
	}

	totalRedactions := 0
	redactionStr := []byte("[REDACTED]")

	// 3. Apply Built-in patterns
	for _, rx := range compiledBuiltIns {
		// ReplaceAll doesn't report count directly, so we use ReplaceAllFunc
		// or count first, but ReplaceAllFunc is safe and precise.
		matches := rx.FindAll(rawBytes, -1)
		totalRedactions += len(matches)
		if len(matches) > 0 {
			rawBytes = rx.ReplaceAll(rawBytes, redactionStr)
		}
	}

	// 4. Apply Custom patterns
	for _, rx := range compiledCustoms {
		matches := rx.FindAll(rawBytes, -1)
		totalRedactions += len(matches)
		if len(matches) > 0 {
			rawBytes = rx.ReplaceAll(rawBytes, redactionStr)
		}
	}

	// 5. Deserialize back into a sanitized struct.
	// Since we blind-replaced bytes in JSON strings, we need to ensure the JSON
	// didn't break. Since [REDACTED] has no quotes or curly braces, it is universally
	// safe to drop into any JSON string value.
	var sanitized adapters.NormalizedSession
	// Using a decoder directly to catch structural errors safely.
	decoder := json.NewDecoder(bytes.NewReader(rawBytes))
	if err := decoder.Decode(&sanitized); err != nil {
		return nil, 0, fmt.Errorf("failed to parse sanitized session back into struct: %w", err)
	}

	return &sanitized, totalRedactions, nil
}
