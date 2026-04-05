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

// Helper utility
func contains(s, substr string) bool {
	return strings.Contains(s, substr)
}
