package adapters

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// -----------------------------------------------------------------------
// Codex adapter
// -----------------------------------------------------------------------

// CodexAdapter parses Codex JSONL session logs.
type CodexAdapter struct{}

// AgentName returns the canonical identifier for Codex.
func (a *CodexAdapter) AgentName() string {
	return "codex"
}

// -----------------------------------------------------------------------
// Raw JSONL event structures
// -----------------------------------------------------------------------

// codexEvent is the top-level structure of each line in a Codex JSONL
// session log. Codex events are simpler than Claude — each line is a
// message with a role field.
type codexEvent struct {
	// Identity fields — Codex may use either.
	SessionID string `json:"sessionId"`
	ID        string `json:"id"`

	// Message fields.
	Role      string          `json:"role"`
	Content   json.RawMessage `json:"content"`
	Type      string          `json:"type"`
	Timestamp string          `json:"timestamp"`
	CreatedAt string          `json:"created_at"`

	// Tool call fields (when role is "assistant" with function calls).
	ToolCalls []codexToolCall `json:"tool_calls,omitempty"`

	// Function call result fields.
	FunctionCallID string `json:"function_call_id"`
	Name           string `json:"name"`
	Output         string `json:"output"`
}

// codexToolCall represents a tool/function call in a Codex assistant message.
type codexToolCall struct {
	ID       string `json:"id"`
	Type     string `json:"type"`
	Function struct {
		Name      string `json:"name"`
		Arguments string `json:"arguments"`
	} `json:"function"`
}

// -----------------------------------------------------------------------
// ParseSessionFile
// -----------------------------------------------------------------------

// ParseSessionFile reads a Codex JSONL log file and returns a
// NormalizedSession. Codex's format is simpler than Claude:
//   - Each line has a "role" field: "user", "assistant", "system"
//   - Tool calls appear inline in assistant messages as "tool_calls"
//   - Function results appear as separate lines with role "tool"
//   - Session ID comes from "sessionId" or "id" fields, fallback to sha256(filename)
func (a *CodexAdapter) ParseSessionFile(filePath string) (*NormalizedSession, error) {
	f, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open session file %s: %w", filePath, err)
	}
	defer f.Close()

	session := &NormalizedSession{
		Agent:      a.AgentName(),
		SourceFile: filePath,
	}

	// Track tool calls by ID for matching function results.
	toolCallIndex := make(map[string]*NormalizedToolCall)

	// Track file extensions as a set.
	extSet := make(map[string]bool)

	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 0, 1024*1024), 10*1024*1024)

	var firstTimestamp, lastTimestamp time.Time
	var nativeSessionID string

	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}

		var event codexEvent
		if err := json.Unmarshal(line, &event); err != nil {
			// Skip malformed lines.
			continue
		}

		// Capture session ID.
		if nativeSessionID == "" {
			if event.SessionID != "" {
				nativeSessionID = event.SessionID
			} else if event.ID != "" {
				nativeSessionID = event.ID
			}
		}

		// Parse timestamp (Codex may use "timestamp" or "created_at").
		ts := parseTimestamp(event.Timestamp)
		if ts.IsZero() {
			ts = parseTimestamp(event.CreatedAt)
		}
		if !ts.IsZero() {
			if firstTimestamp.IsZero() || ts.Before(firstTimestamp) {
				firstTimestamp = ts
			}
			if ts.After(lastTimestamp) {
				lastTimestamp = ts
			}
		}

		// Route by role.
		switch event.Role {
		case "user":
			text := extractCodexContent(event.Content)
			session.Messages = append(session.Messages, NormalizedMessage{
				Role:          "user",
				Content:       text,
				ContentLength: len(text),
				Timestamp:     ts,
			})

		case "assistant":
			text := extractCodexContent(event.Content)

			var toolCalls []NormalizedToolCall
			for _, tc := range event.ToolCalls {
				ntc := NormalizedToolCall{
					ID:              tc.ID,
					Name:            tc.Function.Name,
					Input:           tc.Function.Arguments,
					IsFileModifying: codexFileModifyingTools[tc.Function.Name],
					IsShellCommand:  codexShellTools[tc.Function.Name],
				}

				// Extract file path from arguments.
				ntc.FilePath = extractFilePathFromArgs(tc.Function.Arguments)
				if ntc.FilePath != "" {
					ext := extractExtension(ntc.FilePath)
					if ext != "" {
						extSet[ext] = true
					}
				}

				// Also scan args for file extensions.
				extractExtensionsFromJSON(tc.Function.Arguments, extSet)

				toolCalls = append(toolCalls, ntc)
				if tc.ID != "" {
					toolCallIndex[tc.ID] = &toolCalls[len(toolCalls)-1]
				}
			}

			session.Messages = append(session.Messages, NormalizedMessage{
				Role:          "assistant",
				Content:       text,
				ContentLength: len(text),
				ToolCalls:     toolCalls,
				Timestamp:     ts,
			})

		case "system":
			text := extractCodexContent(event.Content)
			if text != "" {
				session.Messages = append(session.Messages, NormalizedMessage{
					Role:          "system",
					Content:       text,
					ContentLength: len(text),
					Timestamp:     ts,
				})
			}

		case "tool", "function":
			// Match function result back to its tool call.
			if event.FunctionCallID != "" {
				if tc, ok := toolCallIndex[event.FunctionCallID]; ok {
					tc.Output = event.Output
					if tc.Output == "" {
						tc.Output = extractCodexContent(event.Content)
					}
				}
			}
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("error reading session file %s: %w", filePath, err)
	}

	// Derive session ID. A native id is used only if it is already a valid UUID;
	// otherwise it (or the file name) is hashed into a deterministic UUID the
	// backend will accept.
	if nativeSessionID != "" {
		session.SessionID = normalizeSessionID(nativeSessionID)
	} else {
		session.SessionID = deriveCodexSessionID(filePath)
	}

	session.StartedAt = firstTimestamp
	session.EndedAt = lastTimestamp
	session.FileExtensions = setToSlice(extSet)

	return session, nil
}

// -----------------------------------------------------------------------
// Codex tool classifications
// -----------------------------------------------------------------------

// codexFileModifyingTools are Codex tool names that modify files.
var codexFileModifyingTools = map[string]bool{
	"write_file":  true,
	"edit_file":   true,
	"create_file": true,
	"patch":       true,
	"apply_diff":  true,
	"apply_patch": true,
}

// codexShellTools are Codex tool names that run shell commands.
var codexShellTools = map[string]bool{
	"shell":   true,
	"bash":    true,
	"execute": true,
	"run":     true,
}

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

// extractCodexContent pulls text from a content field that may be a
// string, an array of objects with "text" fields, or null.
func extractCodexContent(content json.RawMessage) string {
	if content == nil || string(content) == "null" {
		return ""
	}

	// Try as plain string.
	var s string
	if err := json.Unmarshal(content, &s); err == nil {
		return s
	}

	// Try as array of content blocks (similar to OpenAI format).
	var blocks []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	}
	if err := json.Unmarshal(content, &blocks); err == nil {
		var parts []string
		for _, b := range blocks {
			if b.Text != "" {
				parts = append(parts, b.Text)
			}
		}
		return strings.Join(parts, "\n")
	}

	// Fallback: return raw JSON as string.
	return string(content)
}

// extractFilePathFromArgs tries to find a file path in a JSON arguments
// string (function call arguments).
func extractFilePathFromArgs(args string) string {
	if args == "" {
		return ""
	}

	var fields map[string]json.RawMessage
	if err := json.Unmarshal([]byte(args), &fields); err != nil {
		return ""
	}

	for _, key := range []string{"file_path", "path", "filePath", "file", "filename", "target"} {
		if val, ok := fields[key]; ok {
			var s string
			if err := json.Unmarshal(val, &s); err == nil && s != "" {
				return s
			}
		}
	}

	return ""
}

// deriveCodexSessionID generates a deterministic RFC 4122 UUID from just the
// filename, since Codex filenames contain date/rollout info.
func deriveCodexSessionID(filePath string) string {
	return deriveUUIDv8(filepath.Base(filePath))
}
