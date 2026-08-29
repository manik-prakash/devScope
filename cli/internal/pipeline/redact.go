package pipeline

import (
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

const redactionPlaceholder = "[REDACTED]"

// RedactSession returns a copy of the session with secrets scrubbed from every
// free-text field (message content and tool-call input/output) and the total
// number of replacements made.
//
// Redaction is applied field-by-field, never to a serialized blob: a pattern
// like the multi-line PRIVATE KEY matcher can only ever act inside one string,
// so it can no longer span JSON structure and corrupt the document. Structural
// fields (IDs, roles, extensions, timestamps) are copied untouched, and
// ContentLength is preserved so downstream stats stay accurate.
func RedactSession(sess *adapters.NormalizedSession, customPatterns []string) (*adapters.NormalizedSession, int, error) {
	if sess == nil {
		return nil, 0, fmt.Errorf("cannot redact nil session")
	}

	patterns := make([]*regexp.Regexp, 0, len(compiledBuiltIns)+len(customPatterns))
	patterns = append(patterns, compiledBuiltIns...)
	for _, p := range customPatterns {
		if p == "" {
			continue
		}
		rx, err := regexp.Compile(p)
		if err != nil {
			// Skip invalid custom regexes rather than fail the whole run. The
			// caller is expected to have surfaced these via InvalidPatterns so a
			// typo'd rule doesn't silently ship a secret.
			continue
		}
		patterns = append(patterns, rx)
	}

	out := *sess
	out.Messages = make([]adapters.NormalizedMessage, len(sess.Messages))
	total := 0

	for i, msg := range sess.Messages {
		nm := msg
		var n int
		nm.Content, n = redactField(patterns, msg.Content)
		total += n

		if len(msg.ToolCalls) > 0 {
			nm.ToolCalls = make([]adapters.NormalizedToolCall, len(msg.ToolCalls))
			for j, tc := range msg.ToolCalls {
				ntc := tc
				ntc.Input, n = redactField(patterns, tc.Input)
				total += n
				ntc.Output, n = redactField(patterns, tc.Output)
				total += n
				nm.ToolCalls[j] = ntc
			}
		}

		out.Messages[i] = nm
	}

	return &out, total, nil
}

// InvalidPatterns returns the entries of patterns that are not valid regular
// expressions. RedactSession silently skips these; callers should surface them
// so a typo in a `custom_strip_patterns` rule doesn't quietly ship a secret.
func InvalidPatterns(patterns []string) []string {
	var bad []string
	for _, p := range patterns {
		if p == "" {
			continue
		}
		if _, err := regexp.Compile(p); err != nil {
			bad = append(bad, p)
		}
	}
	return bad
}

// redactField applies every pattern to s, replacing matches with the placeholder,
// and returns the new string plus the number of replacements.
func redactField(patterns []*regexp.Regexp, s string) (string, int) {
	if s == "" {
		return s, 0
	}
	count := 0
	for _, rx := range patterns {
		matches := rx.FindAllString(s, -1)
		if len(matches) == 0 {
			continue
		}
		count += len(matches)
		s = rx.ReplaceAllString(s, redactionPlaceholder)
	}
	return s, count
}
