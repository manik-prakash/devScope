package adapters

import (
	"crypto/sha256"
	"fmt"
	"regexp"
)

// uuidPattern matches the shape Zod's z.string().uuid() accepts on the backend
// (version nibble 1-8, RFC 4122 variant nibble 8-b). A native agent session id
// that fails this gets a 400 the CLI can't retry.
var uuidPattern = regexp.MustCompile(`(?i)^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$`)

// looksLikeUUID reports whether s is a backend-acceptable UUID.
func looksLikeUUID(s string) bool {
	return uuidPattern.MatchString(s)
}

// normalizeSessionID returns native as-is when it is already a valid UUID,
// otherwise a deterministic UUID derived from it so the backend accepts the
// session.
func normalizeSessionID(native string) string {
	if looksLikeUUID(native) {
		return native
	}
	return deriveUUIDv8(native)
}

// deriveUUIDv8 renders a deterministic RFC 4122 version-8 UUID string from an
// arbitrary seed. It is the fallback session id when an agent transcript carries
// no native UUID: the backend requires session_id to satisfy z.string().uuid(),
// and a bare hex digest (no dashes, no version/variant nibbles) is rejected with
// a 400 that the CLI cannot retry.
func deriveUUIDv8(seed string) string {
	h := sha256.Sum256([]byte(seed))
	b := h[:16]
	b[6] = (b[6] & 0x0f) | 0x80 // version 8
	b[8] = (b[8] & 0x3f) | 0x80 // RFC 4122 variant
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}
