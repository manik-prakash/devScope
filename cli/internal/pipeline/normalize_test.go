package pipeline

import (
	"testing"
	"time"

	"github.com/example/devscope-cli/internal/agent/adapters"
)

func TestNormalize_NilSession(t *testing.T) {
	err := Normalize(nil)
	if err == nil {
		t.Fatal("expected error on nil session")
	}
}

func TestNormalize_EmptySessionID(t *testing.T) {
	sess := &adapters.NormalizedSession{}
	err := Normalize(sess)
	if err == nil {
		t.Fatal("expected error on empty session ID")
	}
}

func TestNormalize_RemovesEmptyMessages(t *testing.T) {
	sess := &adapters.NormalizedSession{
		SessionID: "sess-1",
		Messages: []adapters.NormalizedMessage{
			{ContentLength: 5, Role: "user", Content: "Hello"}, // Valid
			{ContentLength: 0, Role: "system", Content: ""},    // Empty string
			{
				ContentLength: 0,
				Role:          "assistant",
				ToolCalls:     []adapters.NormalizedToolCall{{ID: "1"}},
			}, // Contains tool calls, so keep it
		},
	}

	if err := Normalize(sess); err != nil {
		t.Fatalf("Normalize failed: %v", err)
	}

	if len(sess.Messages) != 2 {
		t.Fatalf("expected 2 messages, got %d", len(sess.Messages))
	}
	if sess.Messages[0].Role != "user" || sess.Messages[1].Role != "assistant" {
		t.Fatal("wrong messages kept")
	}
}

func TestNormalize_SortsMessagesStable(t *testing.T) {
	t1 := time.Date(2026, 1, 1, 10, 0, 0, 0, time.UTC)
	t2 := time.Date(2026, 1, 1, 11, 0, 0, 0, time.UTC)

	sess := &adapters.NormalizedSession{
		SessionID: "sess-1",
		Messages: []adapters.NormalizedMessage{
			{ContentLength: 1, Role: "msg3", Timestamp: t2},
			{ContentLength: 1, Role: "msg1", Timestamp: t1},
			{ContentLength: 1, Role: "msg2", Timestamp: t1}, // same time as msg1
		},
	}

	if err := Normalize(sess); err != nil {
		t.Fatalf("Normalize failed: %v", err)
	}

	if len(sess.Messages) != 3 {
		t.Fatal("wrong message count")
	}
	if sess.Messages[0].Role != "msg1" || sess.Messages[1].Role != "msg2" || sess.Messages[2].Role != "msg3" {
		t.Fatalf("wrong sort order: %v", sess.Messages)
	}
}

func TestNormalize_FillsTimestamps(t *testing.T) {
	t1 := time.Date(2026, 2, 2, 8, 0, 0, 0, time.UTC)
	t2 := time.Date(2026, 2, 2, 9, 0, 0, 0, time.UTC)

	sess := &adapters.NormalizedSession{
		SessionID: "sess-1",
		Messages: []adapters.NormalizedMessage{
			{ContentLength: 1, Timestamp: t1},
			{ContentLength: 1, Timestamp: time.Time{}}, // Zero time
			{ContentLength: 1, Timestamp: t2},
		},
	}

	if err := Normalize(sess); err != nil {
		t.Fatalf("Normalize failed: %v", err)
	}

	if !sess.StartedAt.Equal(t1) {
		t.Errorf("StartedAt = %v, want %v", sess.StartedAt, t1)
	}
	if !sess.EndedAt.Equal(t2) {
		t.Errorf("EndedAt = %v, want %v", sess.EndedAt, t2)
	}
}

func TestNormalize_ClampsEndedAt(t *testing.T) {
	t1 := time.Date(2026, 3, 3, 10, 0, 0, 0, time.UTC)
	t0 := time.Date(2026, 3, 3, 9, 0, 0, 0, time.UTC) // Before t1

	sess := &adapters.NormalizedSession{
		SessionID: "sess-1",
		StartedAt: t1,
		EndedAt:   t0,
		Messages:  []adapters.NormalizedMessage{},
	}

	if err := Normalize(sess); err != nil {
		t.Fatalf("Normalize failed: %v", err)
	}

	if sess.EndedAt != t1 {
		t.Fatalf("EndedAt was not clamped to StartedAt: %v", sess.EndedAt)
	}
}

func TestNormalize_CleansExtensions(t *testing.T) {
	sess := &adapters.NormalizedSession{
		SessionID:      "sess-1",
		FileExtensions: []string{"GO", "   yaml ", ".js", "go", "", "YAML"},
	}

	if err := Normalize(sess); err != nil {
		t.Fatalf("Normalize failed: %v", err)
	}

	// Expecting "go", "js", "yaml"
	if len(sess.FileExtensions) != 3 {
		t.Fatalf("expected 3 extensions, got %v", sess.FileExtensions)
	}
	if sess.FileExtensions[0] != "go" || sess.FileExtensions[1] != "js" || sess.FileExtensions[2] != "yaml" {
		t.Fatalf("wrong extension cleanup result: %v", sess.FileExtensions)
	}
}
