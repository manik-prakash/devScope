package pipeline

import (
	"strings"
	"testing"
	"time"

	"github.com/manik-prakash/devscope-cli/internal/agent/adapters"
)

func TestRedactSession_NilSession(t *testing.T) {
	_, counts, err := RedactSession(nil, nil)
	if err == nil {
		t.Fatal("expected error on nil session")
	}
	if counts != 0 {
		t.Fatalf("expected 0 counts, got %d", counts)
	}
}

func TestRedactSession_BuiltIns(t *testing.T) {
	sess := &adapters.NormalizedSession{
		SessionID: "sess-1",
		Messages: []adapters.NormalizedMessage{
			{
				Role:          "user",
				Content:       "Here is my AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE",
				ContentLength: 50,
				Timestamp:     time.Now(),
			},
			{
				Role:    "assistant",
				Content: "I found your GitHub token: ghp_1A2B3C4D5E6F7G8H9I0J1K2L3M4N5O6P7Q8R. I will use it.",
				ToolCalls: []adapters.NormalizedToolCall{
					{
						ID:    "tool_one",
						Name:  "Bash",
						Input: "curl -H 'Authorization: Bearer mySecretToken1234567890abcdef' https://api.github.com",
					},
				},
			},
		},
	}

	sanitized, counts, err := RedactSession(sess, nil)
	if err != nil {
		t.Fatalf("RedactSession failed: %v", err)
	}

	if counts != 3 {
		t.Fatalf("expected 3 redactions, got %d", counts)
	}

	if sanitized.SessionID != "sess-1" {
		t.Fatalf("session ID damaged: %s", sanitized.SessionID)
	}

	msg1Content := sanitized.Messages[0].Content
	msg2Content := sanitized.Messages[1].Content
	toolInput := sanitized.Messages[1].ToolCalls[0].Input

	if !contains(msg1Content, "[REDACTED]") || contains(msg1Content, "AKIA") {
		t.Errorf("AWS Key failed replacement: %s", msg1Content)
	}

	if !contains(msg2Content, "[REDACTED]") || contains(msg2Content, "ghp_") {
		t.Errorf("GitHub token failed replacement: %s", msg2Content)
	}

	if !contains(toolInput, "[REDACTED]") || contains(toolInput, "mySecretToken") {
		t.Errorf("Bearer token failed replacement: %s", toolInput)
	}
}

func TestRedactSession_CustomPatterns(t *testing.T) {
	sess := &adapters.NormalizedSession{
		SessionID: "custom-sess",
		Messages: []adapters.NormalizedMessage{
			{
				Role:    "user",
				Content: "API Key is myCompany_12345",
			},
		},
	}

	customPatterns := []string{
		`myCompany_[0-9]+`,
		`invalid(`, // Should safely skip invalid regexes
	}

	sanitized, counts, err := RedactSession(sess, customPatterns)
	if err != nil {
		t.Fatalf("RedactSession failed: %v", err)
	}

	if counts != 1 {
		t.Fatalf("expected 1 redaction, got %d", counts)
	}

	msgContent := sanitized.Messages[0].Content
	if !contains(msgContent, "[REDACTED]") || contains(msgContent, "myCompany_") {
		t.Fatalf("Custom pattern failed replacement: %s", msgContent)
	}
}

func TestRedactSession_MalformedJSONSafety(t *testing.T) {
	sess := &adapters.NormalizedSession{
		SessionID: "json-safe",
		Messages: []adapters.NormalizedMessage{
			{
				Role:    "user",
				Content: "Here is a secret: gh_p_willNotMatchSoWeTrySomethingElse",
				ToolCalls: []adapters.NormalizedToolCall{
					{Input: "{\"key\": \"ghp_1A2B3C4D5E6F7G8H9I0J1K2L3M4N5O6P7Q8R\"}"},
				},
			},
		},
	}

	_, counts, err := RedactSession(sess, nil)
	if err != nil {
		t.Fatalf("RedactSession JSON unmarshaling failed: %v", err)
	}

	if counts != 1 {
		t.Fatalf("expected 1 redaction, got %d", counts)
	}
}

// An orphan "-----BEGIN ... PRIVATE KEY-----" in one message and a stray
// "-----END ... PRIVATE KEY-----" in another must not let the multi-line PEM
// pattern chew through the structure between them and drop the session.
func TestRedactSession_OrphanPEMMarkersDoNotDropSession(t *testing.T) {
	sess := &adapters.NormalizedSession{
		SessionID: "pem-orphans",
		Messages: []adapters.NormalizedMessage{
			{Role: "user", Content: "pasted a header by mistake: -----BEGIN RSA PRIVATE KEY-----", ContentLength: 60},
			{Role: "assistant", Content: "the deploy script logged -----END RSA PRIVATE KEY----- to stderr", ContentLength: 60},
			{Role: "user", Content: "keep this message intact", ContentLength: 24},
		},
	}

	sanitized, _, err := RedactSession(sess, nil)
	if err != nil {
		t.Fatalf("RedactSession errored on orphan PEM markers: %v", err)
	}
	if len(sanitized.Messages) != 3 {
		t.Fatalf("session lost messages: got %d, want 3", len(sanitized.Messages))
	}
	if sanitized.Messages[2].Content != "keep this message intact" {
		t.Fatalf("unrelated message corrupted: %q", sanitized.Messages[2].Content)
	}
}

// A complete PEM block contained in a single field is still redacted.
func TestRedactSession_FullPEMBlockInOneField(t *testing.T) {
	pem := "-----BEGIN RSA PRIVATE KEY-----\nMIIabc123\nMIIdef456\n-----END RSA PRIVATE KEY-----"
	sess := &adapters.NormalizedSession{
		SessionID: "pem-full",
		Messages: []adapters.NormalizedMessage{
			{
				Role: "assistant",
				ToolCalls: []adapters.NormalizedToolCall{
					{ID: "t1", Name: "Bash", Input: "echo '" + pem + "' > key.pem"},
				},
			},
		},
	}

	sanitized, counts, err := RedactSession(sess, nil)
	if err != nil {
		t.Fatalf("RedactSession failed: %v", err)
	}
	if counts != 1 {
		t.Fatalf("expected 1 redaction, got %d", counts)
	}
	got := sanitized.Messages[0].ToolCalls[0].Input
	if contains(got, "BEGIN RSA PRIVATE KEY") || !contains(got, "[REDACTED]") {
		t.Fatalf("PEM block not redacted: %q", got)
	}
}

// ContentLength is captured pre-redaction and must survive untouched so stats
// stay accurate.
func TestRedactSession_PreservesContentLength(t *testing.T) {
	sess := &adapters.NormalizedSession{
		SessionID: "len-1",
		Messages: []adapters.NormalizedMessage{
			{Role: "user", Content: "token ghp_1A2B3C4D5E6F7G8H9I0J1K2L3M4N5O6P7Q8R here", ContentLength: 999},
		},
	}
	sanitized, _, err := RedactSession(sess, nil)
	if err != nil {
		t.Fatalf("RedactSession failed: %v", err)
	}
	if sanitized.Messages[0].ContentLength != 999 {
		t.Fatalf("ContentLength changed: got %d, want 999", sanitized.Messages[0].ContentLength)
	}
}

// Helper utility
func contains(s, substr string) bool {
	return strings.Contains(s, substr)
}
