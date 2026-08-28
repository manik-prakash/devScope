package pipeline

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"testing"

	"github.com/manik-prakash/devscope-cli/internal/api"
)

// canonicalContractJSON is a fixed canonical serialization that the backend's
// canonicalJson (backend/src/utils/crypto.ts) must reproduce byte-for-byte for
// the equivalent object. The matching assertion lives in
// backend/src/__tests__/signature.test.ts. If either side changes, both fail.
const canonicalContractJSON = `{"agent":"claude-code","cli_version":"0.1.0","duration_ms":300000,"stats":{"avg_prompt_length":15.5,"total_prompts":2},"user_id":"u<1>"}`

func TestSignPayload_Consistency(t *testing.T) {
	apiKey := "test_api_key_123"
	payload := &api.SessionPayload{
		SessionID:    "session-abc",
		UserID:       "user-xyz",
		OrgID:        "org-mno",
		ProjectID:    "proj-123",
		Agent:        "claude-code",
		AgentVersion: "1.0.0",
		StartedAt:    "2026-03-29T10:00:00Z",
		EndedAt:      "2026-03-29T10:05:00Z",
		DurationMs:   300000,
		Stats: api.SessionStats{
			TotalPrompts:       5,
			TotalResponses:     5,
			TotalIterations:    5,
			TotalToolCalls:     10,
			FilesChangedCount:  3,
			ShellCommandsCount: 1,
			AvgPromptLength:    15.5,
			AvgResponseLength:  250.2,
			FileTypesTouched:   []string{"go", "json"},
		},
		CLIVersion: "0.1.0",
		Signature:  "existing-signature-that-should-be-ignored",
	}

	err := SignPayload(payload, apiKey)
	if err != nil {
		t.Fatalf("SignPayload failed: %v", err)
	}

	sig1 := payload.Signature
	if sig1 == "" || sig1 == "existing-signature-that-should-be-ignored" {
		t.Fatalf("Signature was not properly calculated: %s", sig1)
	}

	// Verify exact manual deterministic computation over the canonical form.
	payload.Signature = "" // clear it to mimic the internal step
	canonical, err := canonicalJSON(payload)
	if err != nil {
		t.Fatalf("canonicalJSON failed: %v", err)
	}
	h := hmac.New(sha256.New, []byte(apiKey))
	h.Write(canonical)
	expectedHash := hex.EncodeToString(h.Sum(nil))

	if sig1 != expectedHash {
		t.Errorf("Computed signature %s does not match expected manual hash %s", sig1, expectedHash)
	}

	// Compute a second time to ensure stable output on identical struct values
	payload.Signature = "random-nonsense"
	err = SignPayload(payload, apiKey)
	if err != nil {
		t.Fatalf("SignPayload second pass failed: %v", err)
	}

	sig2 := payload.Signature
	if sig1 != sig2 {
		t.Errorf("Signatures unstable between identical struct calls: %s != %s", sig1, sig2)
	}
}

func TestSignPayload_VaryingData(t *testing.T) {
	apiKey := "secret-key"
	payload := &api.SessionPayload{
		SessionID: "sess-1",
	}

	SignPayload(payload, apiKey)
	sig1 := payload.Signature

	payload.SessionID = "sess-2" // Tiny underlying change
	SignPayload(payload, apiKey)
	sig2 := payload.Signature

	if sig1 == sig2 {
		t.Errorf("Changing struct payload did not alter the cryptograph signature: %s", sig1)
	}
}

func TestSignPayload_Errors(t *testing.T) {
	err := SignPayload(nil, "my-key")
	if err == nil {
		t.Errorf("Expected error for nil payload")
	}

	payload := &api.SessionPayload{SessionID: "test"}
	err = SignPayload(payload, "")
	if err == nil {
		t.Errorf("Expected error for empty signing secret")
	}
}

// TestCanonicalJSON_BackendContract locks the canonical serialization the
// backend relies on: object keys sorted alphabetically (recursively) and no
// HTML escaping of < > &.
func TestCanonicalJSON_BackendContract(t *testing.T) {
	obj := map[string]any{
		"user_id":     "u<1>",
		"agent":       "claude-code",
		"cli_version": "0.1.0",
		"duration_ms": 300000,
		"stats": map[string]any{
			"total_prompts":     2,
			"avg_prompt_length": 15.5,
		},
	}

	got, err := canonicalJSON(obj)
	if err != nil {
		t.Fatalf("canonicalJSON failed: %v", err)
	}
	if string(got) != canonicalContractJSON {
		t.Errorf("canonical form mismatch:\n got: %s\nwant: %s", got, canonicalContractJSON)
	}
}
