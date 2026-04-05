package pipeline

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"

	"github.com/manik-prakash/devscope-cli/internal/api"
)

// SignPayload computes a deterministic HMAC-SHA256 signature for the session payload
// utilizing the provided API key. The payload is mutated to include the calculated
// signature hash in the .Signature field.
func SignPayload(payload *api.SessionPayload, apiKey string) error {
	if payload == nil {
		return fmt.Errorf("cannot sign nil payload")
	}
	if apiKey == "" {
		return fmt.Errorf("cannot sign with empty api key")
	}

	// 1. Temporarily clear the signature field so it doesn't salt its own hash calculation.
	originalSig := payload.Signature
	payload.Signature = ""

	// 2. Marshal deterministic JSON.
	// Go's encodings/json package guarantees that struct fields are serialized in the order
	// they are declared, and map keys are sorted alphabetically.
	rawBytes, err := json.Marshal(payload)
	if err != nil {
		// Restore the signature in case of failure.
		payload.Signature = originalSig
		return fmt.Errorf("failed to marshal payload for signing: %w", err)
	}

	// 3. Cryptographic Hashing HMAC-SHA256
	h := hmac.New(sha256.New, []byte(apiKey))
	h.Write(rawBytes)
	hashBytes := h.Sum(nil)

	// 4. Construct Hex encoding and mutate structural payload safely.
	encodedHash := hex.EncodeToString(hashBytes)
	payload.Signature = encodedHash

	return nil
}
