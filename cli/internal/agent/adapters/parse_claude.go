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
// Claude Code adapter
// -----------------------------------------------------------------------

// ClaudeAdapter parses Claude Code JSONL session logs.
type ClaudeAdapter struct{}

// AgentName returns the canonical identifier for Claude Code.
func (a *ClaudeAdapter) AgentName() string {
	return "claude-code"
}

// -----------------------------------------------------------------------
// Raw JSONL event structures
// -----------------------------------------------------------------------

// claudeEvent is the top-level structure of each line in a Claude Code
// JSONL session log. Fields vary by type; we parse generically and
// inspect per type.
type claudeEvent struct {
	Type      string          `json:"type"`
	SessionID string          `json:"sessionId"`
	Timestamp string          `json:"timestamp"`
	Message   json.RawMessage `json:"message"`

	// For some event types, the entire line IS the message.
	// We also keep the raw bytes for fallback parsing.
	raw []byte
}

// claudeMessage is the structure inside the "message" field for
// user/assistant/system events.
type claudeMessage struct {
	Role    string             `json:"role"`
	Content json.RawMessage    `json:"content"`
	Model   string             `json:"model"`
}

// claudeContentBlock is a single block inside the "content" array.
// Claude uses a multi-block content format.
type claudeContentBlock struct {
	Type  string `json:"type"`
	Text  string `json:"text"`

	// Tool use fields.
	ID    string          `json:"id"`
	Name  string          `json:"name"`
	Input json.RawMessage `json:"input"`

	// Tool result fields.
	ToolUseID string          `json:"tool_use_id"`
	Content   json.RawMessage `json:"content"`
}

// -----------------------------------------------------------------------
// File-modifying and shell tool sets
// -----------------------------------------------------------------------

// fileModifyingTools are Claude Code tool names that modify files.
var fileModifyingTools = map[string]bool{
	"Write":        true,
	"Edit":         true,
	"MultiEdit":    true,
	"NotebookEdit": true,
}

// shellTools are Claude Code tool names that execute shell commands.
var shellTools = map[string]bool{
	"Bash": true,
}

// -----------------------------------------------------------------------
// ParseSessionFile
// -----------------------------------------------------------------------

// ParseSessionFile reads a Claude Code JSONL log file and returns a
// NormalizedSession. It handles:
//   - user, assistant, system message types
//   - tool_use blocks inside assistant content
//   - tool_result events matched back via tool_use_id
//   - file extension extraction from tool call file paths
//   - session ID derivation (native or sha256 fallback)
func (a *ClaudeAdapter) ParseSessionFile(filePath string) (*NormalizedSession, error) {
	f, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open session file %s: %w", filePath, err)
	}
	defer f.Close()

	session := &NormalizedSession{
		Agent:      a.AgentName(),
		SourceFile: filePath,
	}

	// Track tool calls by ID so we can match tool_result events back.
	toolCallIndex := make(map[string]*NormalizedToolCall)

	// Track file extensions as a set.
	extSet := make(map[string]bool)

	scanner := bufio.NewScanner(f)
	// Increase buffer size for potentially large JSONL lines.
	scanner.Buffer(make([]byte, 0, 1024*1024), 10*1024*1024)

	var firstTimestamp, lastTimestamp time.Time
	var nativeSessionID string

	lineNum := 0
	for scanner.Scan() {
		lineNum++
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}

		var event claudeEvent
		if err := json.Unmarshal(line, &event); err != nil {
			// Skip malformed lines — real session logs sometimes have
			// partial writes at the end.
			continue
		}
		event.raw = line

		// Capture session ID from the first event that has one.
		if nativeSessionID == "" && event.SessionID != "" {
			nativeSessionID = event.SessionID
		}

		// Parse timestamp.
		ts := parseTimestamp(event.Timestamp)
		if !ts.IsZero() {
			if firstTimestamp.IsZero() || ts.Before(firstTimestamp) {
				firstTimestamp = ts
			}
			if ts.After(lastTimestamp) {
				lastTimestamp = ts
			}
		}

		// Process by event type.
		switch event.Type {
		case "user", "human":
			msg := a.parseMessageEvent(event, "user")
			if msg != nil {
				session.Messages = append(session.Messages, *msg)
			}

		case "assistant":
			msg, toolCalls := a.parseAssistantEvent(event)
			if msg != nil {
				session.Messages = append(session.Messages, *msg)
			}
			// Index tool calls for later matching.
			for i := range toolCalls {
				tc := &toolCalls[i]
				if tc.ID != "" {
					toolCallIndex[tc.ID] = tc
				}
				// Extract file extensions.
				if tc.FilePath != "" {
					ext := extractExtension(tc.FilePath)
					if ext != "" {
						extSet[ext] = true
					}
				}
				// Also look for file paths in the tool input.
				extractExtensionsFromJSON(tc.Input, extSet)
			}

		case "tool_result", "result":
			a.matchToolResult(event, toolCallIndex)

		case "system":
			msg := a.parseMessageEvent(event, "system")
			if msg != nil {
				session.Messages = append(session.Messages, *msg)
			}

		// Skip progress, file-history-snapshot, and other types —
		// they don't contain user/assistant dialogue.
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("error reading session file %s: %w", filePath, err)
	}

	// Derive session ID. A native id is used only if it is already a valid UUID;
	// otherwise it (or the file path) is hashed into a deterministic UUID the
	// backend will accept.
	if nativeSessionID != "" {
		session.SessionID = normalizeSessionID(nativeSessionID)
	} else {
		session.SessionID = deriveSessionID(filePath, firstTimestamp)
	}

	// Set timestamps.
	session.StartedAt = firstTimestamp
	session.EndedAt = lastTimestamp

	// Collect file extensions.
	session.FileExtensions = setToSlice(extSet)

	return session, nil
}

// -----------------------------------------------------------------------
// Event parsing helpers
// -----------------------------------------------------------------------

// parseMessageEvent extracts a NormalizedMessage from a user or system event.
func (a *ClaudeAdapter) parseMessageEvent(event claudeEvent, role string) *NormalizedMessage {
	var cm claudeMessage
	if event.Message != nil {
		if err := json.Unmarshal(event.Message, &cm); err != nil {
			// Try treating the message field as plain text.
			text := strings.Trim(string(event.Message), `"`)
			if text != "" {
				return &NormalizedMessage{
					Role:          role,
					Content:       text,
					ContentLength: len(text),
					Timestamp:     parseTimestamp(event.Timestamp),
				}
			}
			return nil
		}
	}

	// Extract text content from the content blocks.
	text := extractTextContent(cm.Content)
	if text == "" && cm.Role == "" {
		return nil
	}

	return &NormalizedMessage{
		Role:          role,
		Content:       text,
		ContentLength: len(text),
		Timestamp:     parseTimestamp(event.Timestamp),
	}
}

// parseAssistantEvent extracts a NormalizedMessage and any tool calls
// from an assistant event. Claude's assistant messages have a content
// array with mixed text and tool_use blocks.
func (a *ClaudeAdapter) parseAssistantEvent(event claudeEvent) (*NormalizedMessage, []NormalizedToolCall) {
	var cm claudeMessage
	if event.Message != nil {
		if err := json.Unmarshal(event.Message, &cm); err != nil {
			return nil, nil
		}
	}

	var textParts []string
	var toolCalls []NormalizedToolCall

	// Parse content blocks.
	var blocks []claudeContentBlock
	if cm.Content != nil {
		// Content can be a string or an array of blocks.
		var contentStr string
		if err := json.Unmarshal(cm.Content, &contentStr); err == nil {
			// Plain string content.
			textParts = append(textParts, contentStr)
		} else if err := json.Unmarshal(cm.Content, &blocks); err == nil {
			for _, block := range blocks {
				switch block.Type {
				case "text":
					textParts = append(textParts, block.Text)

				case "tool_use":
					inputStr := ""
					if block.Input != nil {
						inputStr = string(block.Input)
					}

					tc := NormalizedToolCall{
						ID:              block.ID,
						Name:            block.Name,
						Input:           inputStr,
						IsFileModifying: fileModifyingTools[block.Name],
						IsShellCommand:  shellTools[block.Name],
						FilePath:        extractFilePathFromInput(block.Input),
					}
					toolCalls = append(toolCalls, tc)
				}
			}
		}
	}

	// Capture agent version from model field.
	text := strings.Join(textParts, "\n")

	msg := &NormalizedMessage{
		Role:          "assistant",
		Content:       text,
		ContentLength: len(text),
		ToolCalls:     toolCalls,
		Timestamp:     parseTimestamp(event.Timestamp),
	}

	return msg, toolCalls
}

// matchToolResult matches a tool_result event back to its originating
// tool_use call via tool_use_id and stores the output.
func (a *ClaudeAdapter) matchToolResult(event claudeEvent, index map[string]*NormalizedToolCall) {
	// Tool result structure varies — try multiple approaches.
	var result struct {
		ToolUseID string          `json:"tool_use_id"`
		Content   json.RawMessage `json:"content"`
		Output    string          `json:"output"`
	}

	// Try parsing from the message field first.
	data := event.Message
	if data == nil {
		data = event.raw
	}

	if err := json.Unmarshal(data, &result); err != nil {
		return
	}

	if result.ToolUseID == "" {
		// Try at the top level of the raw event.
		var topLevel struct {
			ToolUseID string `json:"tool_use_id"`
			Content   string `json:"content"`
		}
		if err := json.Unmarshal(event.raw, &topLevel); err == nil {
			result.ToolUseID = topLevel.ToolUseID
			result.Output = topLevel.Content
		}
	}

	if result.ToolUseID == "" {
		return
	}

	tc, ok := index[result.ToolUseID]
	if !ok {
		return
	}

	// Store output.
	if result.Output != "" {
		tc.Output = result.Output
	} else if result.Content != nil {
		tc.Output = string(result.Content)
	}
}

// -----------------------------------------------------------------------
// Utility functions
// -----------------------------------------------------------------------

// extractTextContent pulls text from a content field that may be a
// string or an array of content blocks.
func extractTextContent(content json.RawMessage) string {
	if content == nil {
		return ""
	}

	// Try as string.
	var s string
	if err := json.Unmarshal(content, &s); err == nil {
		return s
	}

	// Try as array of blocks.
	var blocks []claudeContentBlock
	if err := json.Unmarshal(content, &blocks); err == nil {
		var parts []string
		for _, b := range blocks {
			if b.Type == "text" && b.Text != "" {
				parts = append(parts, b.Text)
			}
		}
		return strings.Join(parts, "\n")
	}

	return ""
}

// extractFilePathFromInput looks for a "file_path" or "path" key in
// a tool call's JSON input and returns the value if found.
func extractFilePathFromInput(input json.RawMessage) string {
	if input == nil {
		return ""
	}

	var fields map[string]json.RawMessage
	if err := json.Unmarshal(input, &fields); err != nil {
		return ""
	}

	// Check common field names for file paths.
	for _, key := range []string{"file_path", "path", "filePath", "file", "filename"} {
		if val, ok := fields[key]; ok {
			var s string
			if err := json.Unmarshal(val, &s); err == nil && s != "" {
				return s
			}
		}
	}

	return ""
}

// extractExtension returns the file extension without the dot,
// lowercased. Returns empty string if no extension found.
func extractExtension(filePath string) string {
	ext := filepath.Ext(filePath)
	if ext == "" {
		return ""
	}
	// Remove the leading dot and lowercase.
	return strings.ToLower(ext[1:])
}

// extractExtensionsFromJSON scans a JSON string for patterns that look
// like file paths and extracts their extensions into the set.
func extractExtensionsFromJSON(jsonStr string, extSet map[string]bool) {
	if jsonStr == "" {
		return
	}

	// Look for common file path patterns in the JSON.
	// We scan for strings that contain a dot followed by a known extension.
	// This is intentionally broad — we want to catch paths mentioned
	// anywhere in tool inputs/outputs.
	words := strings.Fields(jsonStr)
	for _, word := range words {
		// Strip JSON artifacts.
		word = strings.Trim(word, `"',;:{}[]()`)
		// Only consider words that look like file paths.
		if strings.Contains(word, ".") && (strings.Contains(word, "/") || strings.Contains(word, "\\")) {
			ext := extractExtension(word)
			if ext != "" && isLikelyFileExtension(ext) {
				extSet[ext] = true
			}
		}
	}
}

// isLikelyFileExtension returns true if the extension looks like a real
// file extension (not a domain or random dot-separated string).
func isLikelyFileExtension(ext string) bool {
	if len(ext) == 0 || len(ext) > 10 {
		return false
	}
	// Allow alphanumeric extensions.
	for _, c := range ext {
		if !((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9')) {
			return false
		}
	}
	return true
}

// parseTimestamp tries multiple timestamp formats and returns the parsed
// time, or zero time if none work.
func parseTimestamp(ts string) time.Time {
	if ts == "" {
		return time.Time{}
	}

	formats := []string{
		time.RFC3339,
		time.RFC3339Nano,
		"2006-01-02T15:04:05Z",
		"2006-01-02T15:04:05.000Z",
		"2006-01-02T15:04:05",
		"2006-01-02 15:04:05",
	}

	for _, fmt := range formats {
		if t, err := time.Parse(fmt, ts); err == nil {
			return t
		}
	}

	return time.Time{}
}

// deriveSessionID generates a deterministic RFC 4122 UUID from the file path and
// start time, as a fallback when the native sessionId field is not present.
func deriveSessionID(filePath string, startedAt time.Time) string {
	return deriveUUIDv8(filePath + "|" + startedAt.Format(time.RFC3339))
}

// setToSlice converts a map[string]bool set to a sorted slice.
func setToSlice(s map[string]bool) []string {
	result := make([]string, 0, len(s))
	for k := range s {
		result = append(result, k)
	}
	// Sort for deterministic output.
	sortStrings(result)
	return result
}

// sortStrings sorts a slice of strings in place (simple insertion sort
// to avoid importing sort for a small utility).
func sortStrings(s []string) {
	for i := 1; i < len(s); i++ {
		for j := i; j > 0 && s[j] < s[j-1]; j-- {
			s[j], s[j-1] = s[j-1], s[j]
		}
	}
}
