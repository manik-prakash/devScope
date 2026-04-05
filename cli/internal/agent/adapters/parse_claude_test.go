package adapters

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// -----------------------------------------------------------------------
// Test fixtures
// -----------------------------------------------------------------------

// claudeFixture is a realistic Claude Code JSONL session log.
// It contains:
//   - 1 system event
//   - 2 user prompts
//   - 2 assistant responses (1 with text, 1 with tool calls)
//   - 1 tool_result event matching back to the Write tool call
//   - Tool calls: Write (file-modifying), Bash (shell)
const claudeFixture = `{"type":"system","sessionId":"sess-abc-123","timestamp":"2026-03-28T10:00:00Z","message":{"role":"system","content":"You are Claude Code, an AI coding assistant."}}
{"type":"user","sessionId":"sess-abc-123","timestamp":"2026-03-28T10:00:05Z","message":{"role":"user","content":"Create a hello world Go program"}}
{"type":"assistant","sessionId":"sess-abc-123","timestamp":"2026-03-28T10:00:10Z","message":{"role":"assistant","content":[{"type":"text","text":"I'll create a hello world program for you."},{"type":"tool_use","id":"tool-001","name":"Write","input":{"file_path":"cmd/main.go","content":"package main\n\nimport \"fmt\"\n\nfunc main() {\n\tfmt.Println(\"Hello, World!\")\n}"}}]}}
{"type":"tool_result","sessionId":"sess-abc-123","timestamp":"2026-03-28T10:00:11Z","message":{"tool_use_id":"tool-001","content":"File written successfully"}}
{"type":"user","sessionId":"sess-abc-123","timestamp":"2026-03-28T10:00:15Z","message":{"role":"user","content":"Now run it"}}
{"type":"assistant","sessionId":"sess-abc-123","timestamp":"2026-03-28T10:00:20Z","message":{"role":"assistant","content":[{"type":"text","text":"Let me run it for you."},{"type":"tool_use","id":"tool-002","name":"Bash","input":{"command":"go run cmd/main.go"}}]}}
{"type":"tool_result","sessionId":"sess-abc-123","timestamp":"2026-03-28T10:00:22Z","message":{"tool_use_id":"tool-002","content":"Hello, World!"}}
`

// claudeFixtureNoSessionID has events without a native sessionId field.
const claudeFixtureNoSessionID = `{"type":"user","timestamp":"2026-03-28T12:00:00Z","message":{"role":"user","content":"help me"}}
{"type":"assistant","timestamp":"2026-03-28T12:00:05Z","message":{"role":"assistant","content":"Sure, how can I help?"}}
`

// claudeFixtureMultipleToolTypes tests Edit, MultiEdit, NotebookEdit detection.
const claudeFixtureMultipleToolTypes = `{"type":"assistant","sessionId":"sess-multi","timestamp":"2026-03-28T10:00:00Z","message":{"role":"assistant","content":[{"type":"tool_use","id":"t1","name":"Edit","input":{"file_path":"utils/helper.go","old_text":"foo","new_text":"bar"}},{"type":"tool_use","id":"t2","name":"MultiEdit","input":{"file_path":"config/settings.yaml","edits":[]}},{"type":"tool_use","id":"t3","name":"NotebookEdit","input":{"file_path":"notebooks/analysis.ipynb","cell":1}},{"type":"tool_use","id":"t4","name":"Read","input":{"file_path":"README.md"}}]}}
`

// -----------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------

func TestClaudeAdapter_AgentName(t *testing.T) {
	a := &ClaudeAdapter{}
	if got := a.AgentName(); got != "claude-code" {
		t.Errorf("AgentName: got %q, want %q", got, "claude-code")
	}
}

func TestClaudeAdapter_ParseSessionFile(t *testing.T) {
	// Write fixture to temp file.
	tmp := t.TempDir()
	file := filepath.Join(tmp, "session.jsonl")
	if err := os.WriteFile(file, []byte(claudeFixture), 0o644); err != nil {
		t.Fatal(err)
	}

	adapter := &ClaudeAdapter{}
	session, err := adapter.ParseSessionFile(file)
	if err != nil {
		t.Fatalf("ParseSessionFile failed: %v", err)
	}

	// Session ID from native field.
	if session.SessionID != "sess-abc-123" {
		t.Errorf("SessionID: got %q, want %q", session.SessionID, "sess-abc-123")
	}

	// Agent.
	if session.Agent != "claude-code" {
		t.Errorf("Agent: got %q", session.Agent)
	}

	// Timestamps.
	if session.StartedAt.IsZero() {
		t.Error("StartedAt should not be zero")
	}
	if session.EndedAt.IsZero() {
		t.Error("EndedAt should not be zero")
	}
	if !session.EndedAt.After(session.StartedAt) {
		t.Error("EndedAt should be after StartedAt")
	}

	// Messages: 1 system + 2 user + 2 assistant = 5.
	if len(session.Messages) != 5 {
		t.Fatalf("Messages count: got %d, want 5", len(session.Messages))
	}

	// Verify roles.
	roles := make([]string, len(session.Messages))
	for i, m := range session.Messages {
		roles[i] = m.Role
	}
	expectedRoles := []string{"system", "user", "assistant", "user", "assistant"}
	for i, r := range expectedRoles {
		if roles[i] != r {
			t.Errorf("Messages[%d].Role: got %q, want %q", i, roles[i], r)
		}
	}

	// First user message content.
	if session.Messages[1].Content != "Create a hello world Go program" {
		t.Errorf("Messages[1].Content: got %q", session.Messages[1].Content)
	}
	if session.Messages[1].ContentLength != len("Create a hello world Go program") {
		t.Errorf("Messages[1].ContentLength: got %d", session.Messages[1].ContentLength)
	}

	// First assistant message with tool calls.
	assistantMsg := session.Messages[2]
	if len(assistantMsg.ToolCalls) != 1 {
		t.Fatalf("assistant ToolCalls count: got %d, want 1", len(assistantMsg.ToolCalls))
	}

	writeTool := assistantMsg.ToolCalls[0]
	if writeTool.ID != "tool-001" {
		t.Errorf("ToolCall.ID: got %q", writeTool.ID)
	}
	if writeTool.Name != "Write" {
		t.Errorf("ToolCall.Name: got %q", writeTool.Name)
	}
	if !writeTool.IsFileModifying {
		t.Error("Write should be marked as file-modifying")
	}
	if writeTool.IsShellCommand {
		t.Error("Write should not be a shell command")
	}
	if writeTool.FilePath != "cmd/main.go" {
		t.Errorf("ToolCall.FilePath: got %q", writeTool.FilePath)
	}

	// Tool result should be matched back.
	if writeTool.Output == "" {
		t.Error("Write tool should have output matched from tool_result")
	}

	// Second assistant message with Bash tool call.
	assistantMsg2 := session.Messages[4]
	if len(assistantMsg2.ToolCalls) != 1 {
		t.Fatalf("assistant2 ToolCalls count: got %d, want 1", len(assistantMsg2.ToolCalls))
	}

	bashTool := assistantMsg2.ToolCalls[0]
	if bashTool.Name != "Bash" {
		t.Errorf("ToolCall.Name: got %q", bashTool.Name)
	}
	if !bashTool.IsShellCommand {
		t.Error("Bash should be marked as shell command")
	}
	if bashTool.IsFileModifying {
		t.Error("Bash should not be file-modifying")
	}

	// File extensions — should have "go" from the Write tool call path.
	if len(session.FileExtensions) == 0 {
		t.Error("FileExtensions should not be empty")
	}
	foundGo := false
	for _, ext := range session.FileExtensions {
		if ext == "go" {
			foundGo = true
		}
	}
	if !foundGo {
		t.Errorf("FileExtensions should contain 'go', got %v", session.FileExtensions)
	}
}

func TestClaudeAdapter_FallbackSessionID(t *testing.T) {
	tmp := t.TempDir()
	file := filepath.Join(tmp, "session.jsonl")
	if err := os.WriteFile(file, []byte(claudeFixtureNoSessionID), 0o644); err != nil {
		t.Fatal(err)
	}

	adapter := &ClaudeAdapter{}
	session, err := adapter.ParseSessionFile(file)
	if err != nil {
		t.Fatalf("ParseSessionFile failed: %v", err)
	}

	// Session ID should be a sha256-derived hex string.
	if session.SessionID == "" {
		t.Error("SessionID should not be empty")
	}
	if len(session.SessionID) != 32 {
		t.Errorf("fallback SessionID should be 32 hex chars, got %d: %q",
			len(session.SessionID), session.SessionID)
	}

	// Messages should still be parsed.
	if len(session.Messages) != 2 {
		t.Errorf("Messages count: got %d, want 2", len(session.Messages))
	}
}

func TestClaudeAdapter_FileModifyingToolDetection(t *testing.T) {
	tmp := t.TempDir()
	file := filepath.Join(tmp, "session.jsonl")
	if err := os.WriteFile(file, []byte(claudeFixtureMultipleToolTypes), 0o644); err != nil {
		t.Fatal(err)
	}

	adapter := &ClaudeAdapter{}
	session, err := adapter.ParseSessionFile(file)
	if err != nil {
		t.Fatalf("ParseSessionFile failed: %v", err)
	}

	if len(session.Messages) != 1 {
		t.Fatalf("Messages count: got %d, want 1", len(session.Messages))
	}

	toolCalls := session.Messages[0].ToolCalls
	if len(toolCalls) != 4 {
		t.Fatalf("ToolCalls count: got %d, want 4", len(toolCalls))
	}

	// Edit → file-modifying.
	if !toolCalls[0].IsFileModifying {
		t.Error("Edit should be file-modifying")
	}

	// MultiEdit → file-modifying.
	if !toolCalls[1].IsFileModifying {
		t.Error("MultiEdit should be file-modifying")
	}

	// NotebookEdit → file-modifying.
	if !toolCalls[2].IsFileModifying {
		t.Error("NotebookEdit should be file-modifying")
	}

	// Read → NOT file-modifying.
	if toolCalls[3].IsFileModifying {
		t.Error("Read should NOT be file-modifying")
	}

	// Check file extensions.
	extMap := make(map[string]bool)
	for _, ext := range session.FileExtensions {
		extMap[ext] = true
	}
	for _, expected := range []string{"go", "yaml", "ipynb", "md"} {
		if !extMap[expected] {
			t.Errorf("FileExtensions should contain %q, got %v", expected, session.FileExtensions)
		}
	}
}

func TestClaudeAdapter_EmptyFile(t *testing.T) {
	tmp := t.TempDir()
	file := filepath.Join(tmp, "empty.jsonl")
	if err := os.WriteFile(file, []byte(""), 0o644); err != nil {
		t.Fatal(err)
	}

	adapter := &ClaudeAdapter{}
	session, err := adapter.ParseSessionFile(file)
	if err != nil {
		t.Fatalf("ParseSessionFile failed: %v", err)
	}

	if len(session.Messages) != 0 {
		t.Errorf("empty file should produce 0 messages, got %d", len(session.Messages))
	}
}

func TestClaudeAdapter_MalformedLines(t *testing.T) {
	fixture := `not json at all
{"type":"user","timestamp":"2026-03-28T10:00:00Z","message":{"role":"user","content":"valid message"}}
{invalid json}
`
	tmp := t.TempDir()
	file := filepath.Join(tmp, "mixed.jsonl")
	if err := os.WriteFile(file, []byte(fixture), 0o644); err != nil {
		t.Fatal(err)
	}

	adapter := &ClaudeAdapter{}
	session, err := adapter.ParseSessionFile(file)
	if err != nil {
		t.Fatalf("ParseSessionFile failed: %v", err)
	}

	// Should skip malformed lines and parse the valid one.
	if len(session.Messages) != 1 {
		t.Errorf("Messages count: got %d, want 1", len(session.Messages))
	}
}

func TestClaudeAdapter_FileNotFound(t *testing.T) {
	adapter := &ClaudeAdapter{}
	_, err := adapter.ParseSessionFile("/nonexistent/file.jsonl")
	if err == nil {
		t.Fatal("expected error for nonexistent file")
	}
}

// -----------------------------------------------------------------------
// Utility function tests
// -----------------------------------------------------------------------

func TestExtractExtension(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"cmd/main.go", "go"},
		{"config.yaml", "yaml"},
		{"path/to/file.SQL", "sql"},
		{"Makefile", ""},
		{"", ""},
		{"src/app.test.ts", "ts"},
	}

	for _, tt := range tests {
		got := extractExtension(tt.input)
		if got != tt.want {
			t.Errorf("extractExtension(%q): got %q, want %q", tt.input, got, tt.want)
		}
	}
}

func TestDeriveSessionID(t *testing.T) {
	id1 := deriveSessionID("/path/a.jsonl", parseTimestamp("2026-03-28T10:00:00Z"))
	id2 := deriveSessionID("/path/a.jsonl", parseTimestamp("2026-03-28T10:00:00Z"))
	id3 := deriveSessionID("/path/b.jsonl", parseTimestamp("2026-03-28T10:00:00Z"))

	// Same input → same ID.
	if id1 != id2 {
		t.Error("same input should produce same ID")
	}

	// Different input → different ID.
	if id1 == id3 {
		t.Error("different input should produce different ID")
	}

	// Should be 32 hex chars.
	if len(id1) != 32 {
		t.Errorf("ID length: got %d, want 32", len(id1))
	}
}

func TestParseTimestamp(t *testing.T) {
	// RFC3339.
	ts := parseTimestamp("2026-03-28T10:00:00Z")
	if ts.IsZero() {
		t.Error("should parse RFC3339")
	}

	// Empty.
	if !parseTimestamp("").IsZero() {
		t.Error("empty string should return zero time")
	}

	// Invalid.
	if !parseTimestamp("not-a-timestamp").IsZero() {
		t.Error("invalid string should return zero time")
	}
}

func TestIsLikelyFileExtension(t *testing.T) {
	good := []string{"go", "yaml", "ts", "py", "rs", "sql", "json"}
	for _, ext := range good {
		if !isLikelyFileExtension(ext) {
			t.Errorf("%q should be a valid extension", ext)
		}
	}

	bad := []string{"", strings.Repeat("a", 11), "COM", "a-b"}
	for _, ext := range bad {
		if isLikelyFileExtension(ext) {
			t.Errorf("%q should NOT be a valid extension", ext)
		}
	}
}
