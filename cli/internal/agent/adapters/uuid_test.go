package adapters

import (
	"regexp"
	"testing"
	"time"
)

// zodUUIDRegex mirrors the pattern Zod's z.string().uuid() enforces on the
// backend (version nibble 1-8, RFC 4122 variant nibble 8-b). POST /cli/sessions
// returns 400 — which the CLI treats as non-retriable and drops — if session_id
// does not match.
var zodUUIDRegex = regexp.MustCompile(`^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$`)

func TestDeriveSessionID_IsZodAcceptableUUID(t *testing.T) {
	seed := "/home/u/.claude/projects/x/abc.jsonl"
	ts := time.Unix(1735000000, 0).UTC()

	got := deriveSessionID(seed, ts)
	if !zodUUIDRegex.MatchString(got) {
		t.Errorf("deriveSessionID = %q, not a Zod-acceptable UUID", got)
	}
	if again := deriveSessionID(seed, ts); got != again {
		t.Errorf("deriveSessionID is not deterministic: %q vs %q", got, again)
	}
}

func TestDeriveCodexSessionID_IsZodAcceptableUUID(t *testing.T) {
	seed := "/home/u/.codex/sessions/2026/rollout-abc.jsonl"

	got := deriveCodexSessionID(seed)
	if !zodUUIDRegex.MatchString(got) {
		t.Errorf("deriveCodexSessionID = %q, not a Zod-acceptable UUID", got)
	}
	if got != deriveCodexSessionID(seed) {
		t.Error("deriveCodexSessionID is not deterministic")
	}
}

func TestNormalizeSessionID(t *testing.T) {
	// A real UUID is passed through untouched.
	real := "3f6d1e2a-8b4c-4d5e-9f0a-1b2c3d4e5f60"
	if got := normalizeSessionID(real); got != real {
		t.Errorf("normalizeSessionID(%q) = %q, want unchanged", real, got)
	}

	// A non-UUID native id (e.g. Claude's "sess-abc-123") is coerced to a
	// deterministic UUID the backend will accept.
	got := normalizeSessionID("sess-abc-123")
	if !zodUUIDRegex.MatchString(got) {
		t.Errorf("normalizeSessionID(non-uuid) = %q, not a Zod-acceptable UUID", got)
	}
	if got != normalizeSessionID("sess-abc-123") {
		t.Error("normalizeSessionID is not deterministic for a non-uuid input")
	}
}
