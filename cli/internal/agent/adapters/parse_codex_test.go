package adapters

import (
	"os"
	"path/filepath"
	"testing"
)

// -----------------------------------------------------------------------
// Test fixtures
// -----------------------------------------------------------------------

// codexFixture is a realistic Codex JSONL session log.
// Contains:
//   - 1 system message
//   - 2 user prompts
//   - 2 assistant responses (1 with text, 1 with tool calls)
//   - 1 tool/function result matched back
const codexFixture = `{"sessionId":"codex-sess-001","role":"system","timestamp":"2026-03-28T10:00:00Z","content":"You are Codex, an AI coding assistant."}
{"sessionId":"codex-sess-001","role":"user","timestamp":"2026-03-28T10:00:05Z","content":"Create a Python hello world script"}
{"sessionId":"codex-sess-001","role":"assistant","timestamp":"2026-03-28T10:00:10Z","content":"I'll create that for you.","tool_calls":[{"id":"call-001","type":"function","function":{"name":"write_file","arguments":"{\"file_path\":\"hello.py\",\"content\":\"print('Hello, World!')\"}"}}]}
{"sessionId":"codex-sess-001","role":"tool","timestamp":"2026-03-28T10:00:11Z","function_call_id":"call-001","output":"File written successfully"}
{"sessionId":"codex-sess-001","role":"user","timestamp":"2026-03-28T10:00:15Z","content":"Now run it"}
{"sessionId":"codex-sess-001","role":"assistant","timestamp":"2026-03-28T10:00:20Z","content":"Running the script now.","tool_calls":[{"id":"call-002","type":"function","function":{"name":"shell","arguments":"{\"command\":\"python hello.py\"}"}}]}
{"sessionId":"codex-sess-001","role":"tool","timestamp":"2026-03-28T10:00:22Z","function_call_id":"call-002","output":"Hello, World!"}
`

// codexFixtureNoSessionID uses "id" field instead.
const codexFixtureNoSessionID = `{"id":"alt-id-xyz","role":"user","timestamp":"2026-03-28T12:00:00Z","content":"help"}
{"id":"alt-id-xyz","role":"assistant","timestamp":"2026-03-28T12:00:05Z","content":"How can I help?"}
`

// codexFixtureNoID has no session ID at all.
const codexFixtureNoID = `{"role":"user","timestamp":"2026-03-28T12:00:00Z","content":"hello"}
`

// codexFixtureContentBlocks uses array content format.
const codexFixtureContentBlocks = `{"sessionId":"s1","role":"user","timestamp":"2026-03-28T10:00:00Z","content":[{"type":"text","text":"part one"},{"type":"text","text":"part two"}]}
`

// -----------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------

func TestCodexAdapter_AgentName(t *testing.T) {
	a := &CodexAdapter{}
	if got := a.AgentName(); got != "codex" {
		t.Errorf("AgentName: got %q, want %q", got, "codex")
	}
}

func TestCodexAdapter_ParseSessionFile(t *testing.T) {
	tmp := t.TempDir()
	file := filepath.Join(tmp, "rollout-001.jsonl")
	if err := os.WriteFile(file, []byte(codexFixture), 0o644); err != nil {
		t.Fatal(err)
	}

	adapter := &CodexAdapter{}
	session, err := adapter.ParseSessionFile(file)
	if err != nil {
		t.Fatalf("ParseSessionFile failed: %v", err)
	}

	// Native session id "codex-sess-001" is not a UUID; it must be coerced.
	if !zodUUIDRegex.MatchString(session.SessionID) {
		t.Errorf("SessionID %q is not a Zod-acceptable UUID", session.SessionID)
	}

	// Agent.
	if session.Agent != "codex" {
		t.Errorf("Agent: got %q", session.Agent)
	}

	// Timestamps.
	if session.StartedAt.IsZero() {
		t.Error("StartedAt should not be zero")
	}
	if session.EndedAt.IsZero() {
		t.Error("EndedAt should not be zero")
	}

	// Messages: 1 system + 2 user + 2 assistant = 5
	// (tool results are matched back, not separate messages).
	if len(session.Messages) != 5 {
		t.Fatalf("Messages count: got %d, want 5", len(session.Messages))
	}

	// Verify roles.
	expectedRoles := []string{"system", "user", "assistant", "user", "assistant"}
	for i, r := range expectedRoles {
		if session.Messages[i].Role != r {
			t.Errorf("Messages[%d].Role: got %q, want %q", i, session.Messages[i].Role, r)
		}
	}

	// First user message content.
	if session.Messages[1].Content != "Create a Python hello world script" {
		t.Errorf("Messages[1].Content: got %q", session.Messages[1].Content)
	}

	// Assistant with tool calls.
	assistant1 := session.Messages[2]
	if len(assistant1.ToolCalls) != 1 {
		t.Fatalf("assistant1 ToolCalls count: got %d, want 1", len(assistant1.ToolCalls))
	}

	writeTool := assistant1.ToolCalls[0]
	if writeTool.ID != "call-001" {
		t.Errorf("ToolCall.ID: got %q", writeTool.ID)
	}
	if writeTool.Name != "write_file" {
		t.Errorf("ToolCall.Name: got %q", writeTool.Name)
	}
	if !writeTool.IsFileModifying {
		t.Error("write_file should be file-modifying")
	}
	if writeTool.IsShellCommand {
		t.Error("write_file should not be a shell command")
	}
	if writeTool.FilePath != "hello.py" {
		t.Errorf("ToolCall.FilePath: got %q", writeTool.FilePath)
	}

	// Tool result matched back.
	if writeTool.Output != "File written successfully" {
		t.Errorf("ToolCall.Output: got %q", writeTool.Output)
	}

	// Second assistant with shell tool.
	assistant2 := session.Messages[4]
	if len(assistant2.ToolCalls) != 1 {
		t.Fatalf("assistant2 ToolCalls count: got %d, want 1", len(assistant2.ToolCalls))
	}
	shellTool := assistant2.ToolCalls[0]
	if shellTool.Name != "shell" {
		t.Errorf("ToolCall.Name: got %q", shellTool.Name)
	}
	if !shellTool.IsShellCommand {
		t.Error("shell should be a shell command")
	}
	if shellTool.IsFileModifying {
		t.Error("shell should not be file-modifying")
	}

	// File extensions — should have "py".
	foundPy := false
	for _, ext := range session.FileExtensions {
		if ext == "py" {
			foundPy = true
		}
	}
	if !foundPy {
		t.Errorf("FileExtensions should contain 'py', got %v", session.FileExtensions)
	}
}

func TestCodexAdapter_FallbackSessionID_FromID(t *testing.T) {
	tmp := t.TempDir()
	file := filepath.Join(tmp, "rollout-002.jsonl")
	if err := os.WriteFile(file, []byte(codexFixtureNoSessionID), 0o644); err != nil {
		t.Fatal(err)
	}

	adapter := &CodexAdapter{}
	session, err := adapter.ParseSessionFile(file)
	if err != nil {
		t.Fatalf("ParseSessionFile failed: %v", err)
	}

	// Falls back to the "id" field ("alt-id-xyz"), coerced to a UUID.
	if !zodUUIDRegex.MatchString(session.SessionID) {
		t.Errorf("SessionID %q is not a Zod-acceptable UUID", session.SessionID)
	}
}

func TestCodexAdapter_FallbackSessionID_DerivedUUID(t *testing.T) {
	tmp := t.TempDir()
	file := filepath.Join(tmp, "rollout-003.jsonl")
	if err := os.WriteFile(file, []byte(codexFixtureNoID), 0o644); err != nil {
		t.Fatal(err)
	}

	adapter := &CodexAdapter{}
	session, err := adapter.ParseSessionFile(file)
	if err != nil {
		t.Fatalf("ParseSessionFile failed: %v", err)
	}

	// Should be a deterministic UUID the backend will accept.
	if session.SessionID == "" {
		t.Error("SessionID should not be empty")
	}
	if !zodUUIDRegex.MatchString(session.SessionID) {
		t.Errorf("fallback SessionID should be a Zod-acceptable UUID, got %q", session.SessionID)
	}
}

func TestCodexAdapter_ContentBlocks(t *testing.T) {
	tmp := t.TempDir()
	file := filepath.Join(tmp, "session.jsonl")
	if err := os.WriteFile(file, []byte(codexFixtureContentBlocks), 0o644); err != nil {
		t.Fatal(err)
	}

	adapter := &CodexAdapter{}
	session, err := adapter.ParseSessionFile(file)
	if err != nil {
		t.Fatalf("ParseSessionFile failed: %v", err)
	}

	if len(session.Messages) != 1 {
		t.Fatalf("Messages count: got %d, want 1", len(session.Messages))
	}

	// Content should be joined from blocks.
	expected := "part one\npart two"
	if session.Messages[0].Content != expected {
		t.Errorf("Content: got %q, want %q", session.Messages[0].Content, expected)
	}
}

func TestCodexAdapter_EmptyFile(t *testing.T) {
	tmp := t.TempDir()
	file := filepath.Join(tmp, "empty.jsonl")
	if err := os.WriteFile(file, []byte(""), 0o644); err != nil {
		t.Fatal(err)
	}

	adapter := &CodexAdapter{}
	session, err := adapter.ParseSessionFile(file)
	if err != nil {
		t.Fatalf("ParseSessionFile failed: %v", err)
	}

	if len(session.Messages) != 0 {
		t.Errorf("empty file should produce 0 messages, got %d", len(session.Messages))
	}
}

func TestCodexAdapter_FileNotFound(t *testing.T) {
	adapter := &CodexAdapter{}
	_, err := adapter.ParseSessionFile("/nonexistent/file.jsonl")
	if err == nil {
		t.Fatal("expected error for nonexistent file")
	}
}

