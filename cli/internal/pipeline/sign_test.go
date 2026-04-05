package pipeline

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"testing"

	"github.com/example/devscope-cli/internal/api"
)

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

	// Verify exact manual deterministic computation
	payload.Signature = "" // clear it to mimic the internal step
	rawBytes, _ := json.Marshal(payload)
	h := hmac.New(sha256.New, []byte(apiKey))
	h.Write(rawBytes)
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
		t.Errorf("Expected error for empty API key")
	}
}
