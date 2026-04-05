// Package adapters defines the common interface and data model for
// parsing agent session logs into a normalized representation.
//
// Each supported AI coding agent (Claude Code, Codex, Cursor, Copilot)
// implements the Adapter interface to produce a NormalizedSession from
// its native JSONL log format.
package adapters

import "time"

// -----------------------------------------------------------------------
// Normalized data model
// -----------------------------------------------------------------------

// NormalizedMessage represents a single message in the session,
// regardless of which agent produced it.
type NormalizedMessage struct {
	// Role is "user", "assistant", or "system".
	Role string `json:"role"`

	// Content is the text content of the message.
	// This will be redacted before leaving the machine.
	Content string `json:"content"`

	// ContentLength is the character count of the original content,
	// captured before redaction so stats are accurate.
	ContentLength int `json:"content_length"`

	// ToolCalls lists any tool invocations in this message (assistant only).
	ToolCalls []NormalizedToolCall `json:"tool_calls,omitempty"`

	// Timestamp of this message, if available.
	Timestamp time.Time `json:"timestamp,omitempty"`
}

// NormalizedToolCall represents a single tool invocation by the assistant.
type NormalizedToolCall struct {
	// ID is the native tool call ID (e.g. tool_use_id for Claude).
	ID string `json:"id"`

	// Name is the tool function name (e.g. "Write", "Bash", "Edit").
	Name string `json:"name"`

	// Input is the raw input to the tool, serialized as a string.
	// This will be redacted before leaving the machine.
	Input string `json:"input,omitempty"`

	// Output is the tool result, matched back from a separate event.
	// This will be redacted before leaving the machine.
	Output string `json:"output,omitempty"`

	// IsFileModifying is true for Write, Edit, MultiEdit, NotebookEdit.
	IsFileModifying bool `json:"is_file_modifying"`

	// IsShellCommand is true for Bash tool calls.
	IsShellCommand bool `json:"is_shell_command"`

	// FilePath is the file targeted by this tool call, if any.
	// Used only for extension extraction — the path itself is redacted.
	FilePath string `json:"file_path,omitempty"`
}

// NormalizedSession is the agent-agnostic representation of a complete
// coding session. All adapters produce this; all pipeline stages consume it.
type NormalizedSession struct {
	// SessionID is a unique identifier for this session.
	// Derived from the agent's native ID or sha256(filePath + startedAt).
	SessionID string `json:"session_id"`

	// Agent identifies which agent produced this session.
	// One of: "claude-code", "codex", "cursor", "copilot", "custom".
	Agent string `json:"agent"`

	// AgentVersion is the version of the agent, if detectable.
	AgentVersion string `json:"agent_version"`

	// SourceFile is the path to the original JSONL log file.
	// Used for diagnostics only — never transmitted.
	SourceFile string `json:"source_file"`

	// StartedAt is when the session began.
	StartedAt time.Time `json:"started_at"`

	// EndedAt is when the session ended.
	EndedAt time.Time `json:"ended_at"`

	// Messages is the ordered list of all messages in the session.
	Messages []NormalizedMessage `json:"messages"`

	// FileExtensions is the deduplicated set of file extensions
	// observed across all tool calls (e.g. ["go", "yaml", "sql"]).
	// Never contains file names or paths.
	FileExtensions []string `json:"file_extensions"`
}

// -----------------------------------------------------------------------
// Adapter interface
// -----------------------------------------------------------------------

// Adapter parses an agent-specific JSONL session log file and returns
// a NormalizedSession ready for the pipeline.
type Adapter interface {
	// ParseSessionFile reads a JSONL file and returns a NormalizedSession.
	ParseSessionFile(filePath string) (*NormalizedSession, error)

	// AgentName returns the canonical agent identifier
	// (e.g. "claude-code", "codex").
	AgentName() string
}
