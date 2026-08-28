package pipeline

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"

	"github.com/manik-prakash/devscope-cli/internal/api"
)

// SignPayload computes a deterministic HMAC-SHA256 signature for the session
// payload using the API key's signing secret (NOT the bearer API key). The
// payload is mutated to carry the signature hex in its .Signature field.
//
// The bytes that are hashed are a canonical form of the payload:
//   - the .Signature field is blanked so it can't salt its own hash
//   - object keys are sorted alphabetically, recursively
//   - HTML characters (< > &) are left un-escaped
//
// This canonical form is what the backend reproduces in
// backend/src/utils/crypto.ts (canonicalJson) when it verifies the signature.
func SignPayload(payload *api.SessionPayload, signingSecret string) error {
	if payload == nil {
		return fmt.Errorf("cannot sign nil payload")
	}
	if signingSecret == "" {
		return fmt.Errorf("cannot sign with empty signing secret")
	}

	originalSig := payload.Signature
	payload.Signature = ""

	canonical, err := canonicalJSON(payload)
	if err != nil {
		payload.Signature = originalSig
		return fmt.Errorf("failed to canonicalize payload for signing: %w", err)
	}

	h := hmac.New(sha256.New, []byte(signingSecret))
	h.Write(canonical)
	payload.Signature = hex.EncodeToString(h.Sum(nil))

	return nil
}

// canonicalJSON serializes v to a deterministic JSON form: object keys sorted
// alphabetically (recursively) and no HTML escaping. It matches the output of
// the backend's canonicalJson helper for the payload shapes we send.
func canonicalJSON(v any) ([]byte, error) {
	// Round-trip through a generic value so every struct becomes a map; Go's
	// encoding/json marshals map keys in sorted order.
	raw, err := json.Marshal(v)
	if err != nil {
		return nil, err
	}

	var generic any
	if err := json.Unmarshal(raw, &generic); err != nil {
		return nil, err
	}

	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	if err := enc.Encode(generic); err != nil {
		return nil, err
	}

	// Encoder.Encode appends a trailing newline — drop it.
	return bytes.TrimRight(buf.Bytes(), "\n"), nil
}
