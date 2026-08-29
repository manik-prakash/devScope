package pipeline

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
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

// TestSignPayload_HashInputExcludesSignatureKey pins the CLI<->backend contract:
// the backend verifies with `const { signature, ...rest } = payload` — it removes
// the "signature" key entirely before canonicalizing. The bytes SignPayload hashes
// must therefore also carry NO "signature" key (not a blank one).
func TestSignPayload_HashInputExcludesSignatureKey(t *testing.T) {
	secret := "signing-secret-xyz"
	payload := &api.SessionPayload{
		SessionID:    "11111111-1111-4111-8111-111111111111",
		UserID:       "user-1",
		OrgID:        "org-1",
		ProjectID:    "proj-1",
		Agent:        "claude-code",
		AgentVersion: "1.0.0",
		StartedAt:    "2026-03-29T10:00:00Z",
		EndedAt:      "2026-03-29T10:05:00Z",
		DurationMs:   300000,
		Stats:        api.SessionStats{TotalPrompts: 2, AvgPromptLength: 15.5},
		CLIVersion:   "0.1.0",
	}

	if err := SignPayload(payload, secret); err != nil {
		t.Fatalf("SignPayload failed: %v", err)
	}

	// Reproduce exactly what the backend hashes: take the payload as sent on the
	// wire, drop the "signature" key, canonicalize the rest, HMAC it.
	sent, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal sent payload: %v", err)
	}
	var m map[string]any
	if err := json.Unmarshal(sent, &m); err != nil {
		t.Fatalf("unmarshal sent payload: %v", err)
	}
	if _, ok := m["signature"]; !ok {
		t.Fatal("sent payload has no signature key at all — SubmitSession would send an unsigned body")
	}
	delete(m, "signature")

	canonical, err := canonicalJSON(m)
	if err != nil {
		t.Fatalf("canonicalJSON failed: %v", err)
	}
	h := hmac.New(sha256.New, []byte(secret))
	h.Write(canonical)
	want := hex.EncodeToString(h.Sum(nil))

	if payload.Signature != want {
		t.Errorf("signature is computed over a canonical form the backend cannot reproduce\n got:  %s\n want: %s\n backend-canonical: %s", payload.Signature, want, canonical)
	}
}

// crossImplSecret / crossImplSignature pin one concrete payload's signature so the
// backend's verifySignature can be tested against a value the Go signer actually
// produced. The mirror assertion lives in
// backend/src/__tests__/signature-crossimpl.test.ts — if either canonicaliser
// drifts, one of the two tests fails.
const (
	crossImplSecret    = "cross-impl-signing-secret"
	crossImplSignature = "dc8069baab2c49a21ae87508c9019b346fb8f52ae9df1e10a4caef2486467eec"
)

func crossImplPayload() *api.SessionPayload {
	return &api.SessionPayload{
		SessionID:    "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
		UserID:       "user-cross",
		OrgID:        "org-cross",
		ProjectID:    "proj-cross",
		Agent:        "claude-code",
		AgentVersion: "2.1.0",
		StartedAt:    "2026-08-29T12:00:00Z",
		EndedAt:      "2026-08-29T12:30:00Z",
		DurationMs:   1800000,
		Stats: api.SessionStats{
			TotalPrompts:       4,
			TotalResponses:     4,
			TotalIterations:    6,
			TotalToolCalls:     9,
			FilesChangedCount:  2,
			ShellCommandsCount: 1,
			AvgPromptLength:    22.5,
			AvgResponseLength:  310,
			FileTypesTouched:   []string{"go", "ts"},
		},
		CLIVersion: "0.2.0",
	}
}

func TestSignPayload_CrossImplFixture(t *testing.T) {
	payload := crossImplPayload()
	if err := SignPayload(payload, crossImplSecret); err != nil {
		t.Fatalf("SignPayload failed: %v", err)
	}
	body, _ := json.Marshal(payload)
	t.Logf("cross-impl body: %s", body)
	if payload.Signature != crossImplSignature {
		t.Errorf("cross-impl signature drift:\n got:  %s\n want: %s", payload.Signature, crossImplSignature)
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
