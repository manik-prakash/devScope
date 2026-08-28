// Package api provides a typed HTTP client for the DevScope backend.
//
// Endpoints covered:
//
//	GET  /api/v1/cli/me               — fetch authenticated user context
//	POST /api/v1/cli/sessions         — submit a signed session payload
//	GET  /api/v1/cli/sessions/recent  — fetch recent scored sessions
package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// -----------------------------------------------------------------------
// Response models
// -----------------------------------------------------------------------

// MeProject is a single project returned from GET /api/v1/me.
type MeProject struct {
	ID   string `json:"id"`
	Slug string `json:"slug"`
	Name string `json:"name"`
}

// MeResponse is the typed response from GET /api/v1/cli/me.
type MeResponse struct {
	UserID             string      `json:"user_id"`
	OrgID              string      `json:"org_id"`
	Name               string      `json:"name"`
	Email              string      `json:"email"`
	Projects           []MeProject `json:"projects"`
	DefaultProjectSlug string      `json:"default_project_slug"`
	// SigningSecret is the per-API-key HMAC secret the CLI uses to sign session
	// payloads. It is distinct from the bearer API key and must never be logged.
	SigningSecret string `json:"signing_secret"`
}

// RecentSession is a single session returned from GET /api/v1/sessions/recent.
type RecentSession struct {
	SessionID string  `json:"session_id"`
	Agent     string  `json:"agent"`
	StartedAt string  `json:"started_at"`
	Score     float64 `json:"score"`
	Status    string  `json:"status"` // "queued" | "scored" | "failed"
}

// RecentSessionsResponse is the typed response from GET /api/v1/sessions/recent.
type RecentSessionsResponse struct {
	Sessions []RecentSession `json:"sessions"`
}

// SanitizedToolCall is the redacted representation of a single tool invocation,
// safe to transmit to the backend.
type SanitizedToolCall struct {
	ID              string `json:"id"`
	Name            string `json:"name"`
	Input           string `json:"input,omitempty"`
	Output          string `json:"output,omitempty"`
	IsFileModifying bool   `json:"is_file_modifying"`
	IsShellCommand  bool   `json:"is_shell_command"`
	// FilePath is intentionally omitted — paths are never transmitted.
}

// SanitizedMessage is the redacted representation of a single session message,
// safe to transmit to the backend. All content has been run through the
// redaction pipeline before arriving here.
type SanitizedMessage struct {
	Role          string              `json:"role"`
	Content       string              `json:"content"`
	ContentLength int                 `json:"content_length"`
	ToolCalls     []SanitizedToolCall `json:"tool_calls,omitempty"`
	Timestamp     time.Time           `json:"timestamp,omitempty"`
}

// SessionPayload is the complete signed session object sent to POST /api/v1/sessions.
// This matches the schema defined in the spec exactly.
type SessionPayload struct {
	SessionID    string             `json:"session_id"`
	UserID       string             `json:"user_id"`
	OrgID        string             `json:"org_id"`
	ProjectID    string             `json:"project_id"`
	Agent        string             `json:"agent"`
	AgentVersion string             `json:"agent_version"`
	StartedAt    string             `json:"started_at"`
	EndedAt      string             `json:"ended_at"`
	DurationMs   int64              `json:"duration_ms"`
	Stats        SessionStats       `json:"stats"`
	// Messages contains the fully redacted, sanitized session log.
	// Content and tool I/O have been scrubbed of all secrets before inclusion.
	Messages     []SanitizedMessage `json:"messages,omitempty"`
	CLIVersion   string             `json:"cli_version"`
	Signature    string             `json:"signature"`
}

// SessionStats holds the behavioral metadata extracted from a session.
type SessionStats struct {
	TotalPrompts      int      `json:"total_prompts"`
	TotalResponses    int      `json:"total_responses"`
	TotalIterations   int      `json:"total_iterations"`
	TotalToolCalls    int      `json:"total_tool_calls"`
	FilesChangedCount int      `json:"files_changed_count"`
	ShellCommandsCount int     `json:"shell_commands_count"`
	AvgPromptLength   float64  `json:"avg_prompt_length"`
	AvgResponseLength float64  `json:"avg_response_length"`
	FileTypesTouched  []string `json:"file_types_touched"`
}

// -----------------------------------------------------------------------
// Client
// -----------------------------------------------------------------------

// Client is a typed HTTP client for the DevScope backend.
type Client struct {
	baseURL    string
	apiKey     string
	cliVersion string
	httpClient *http.Client
}

// NewClient creates a new API client.
//
//	baseURL    — from DEVSCOPE_API_BASE_URL
//	apiKey     — the developer's API key
//	cliVersion — current CLI semver for X-CLI-Version header
func NewClient(baseURL, apiKey, cliVersion string) *Client {
	return &Client{
		baseURL:    baseURL,
		apiKey:     apiKey,
		cliVersion: cliVersion,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// -----------------------------------------------------------------------
// GET /api/v1/me
// -----------------------------------------------------------------------

// GetMe fetches the authenticated user's context from the backend.
// Returns a human-readable error on auth failure or network issues.
func (c *Client) GetMe() (*MeResponse, error) {
	req, err := http.NewRequest(http.MethodGet, c.baseURL+"/api/v1/cli/me", nil)
	if err != nil {
		return nil, fmt.Errorf("failed to build request: %w", err)
	}

	c.setHeaders(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf(
			"Could not reach DevScope at %s.\n"+
				"Check your network connection and DEVSCOPE_API_BASE_URL.", c.baseURL)
	}
	defer resp.Body.Close()

	if err := c.checkAuthError(resp); err != nil {
		return nil, err
	}

	if resp.StatusCode != http.StatusOK {
		return nil, c.unexpectedStatusError(resp)
	}

	var me MeResponse
	if err := json.NewDecoder(resp.Body).Decode(&me); err != nil {
		return nil, fmt.Errorf("failed to parse response from DevScope: %w", err)
	}

	return &me, nil
}

// -----------------------------------------------------------------------
// POST /api/v1/sessions
// -----------------------------------------------------------------------

// SubmitResult describes the outcome of a session submission attempt.
type SubmitResult struct {
	// Accepted is true if the backend returned 202.
	Accepted bool
	// Retriable is true if the error is transient (429, 5xx) and the
	// caller should retry or queue the payload.
	Retriable bool
	// Err is the human-readable error, nil on success.
	Err error
}

// SubmitSession sends a signed session payload to the backend.
// It does NOT implement retry logic — that is handled by the shipping
// pipeline (ship.go). This method makes a single attempt.
func (c *Client) SubmitSession(payload *SessionPayload) *SubmitResult {
	body, err := json.Marshal(payload)
	if err != nil {
		return &SubmitResult{Err: fmt.Errorf("failed to serialize session: %w", err)}
	}

	req, err := http.NewRequest(http.MethodPost, c.baseURL+"/api/v1/cli/sessions", bytes.NewReader(body))
	if err != nil {
		return &SubmitResult{Err: fmt.Errorf("failed to build request: %w", err)}
	}

	c.setHeaders(req)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return &SubmitResult{
			Retriable: true,
			Err: fmt.Errorf(
				"Could not reach DevScope. Your session has been saved locally "+
					"and will be sent automatically on your next run."),
		}
	}
	defer resp.Body.Close()

	switch resp.StatusCode {
	case http.StatusAccepted:
		return &SubmitResult{Accepted: true}

	case http.StatusUnauthorized:
		return &SubmitResult{
			Err: fmt.Errorf(
				"Your API key was rejected. Run \"devscope auth\" to re-authenticate."),
		}

	case http.StatusBadRequest:
		msg := c.readErrorBody(resp)
		return &SubmitResult{
			Err: fmt.Errorf(
				"Session signature was rejected by the server. "+
					"This may indicate a config issue. Run \"devscope sync\".\n"+
					"Detail: %s", msg),
		}

	case http.StatusTooManyRequests:
		return &SubmitResult{
			Retriable: true,
			Err:       fmt.Errorf("rate limited by DevScope — will retry"),
		}

	default:
		if resp.StatusCode >= 500 {
			return &SubmitResult{
				Retriable: true,
				Err: fmt.Errorf(
					"DevScope returned a server error (%d). Your session has been "+
						"saved locally and will be sent automatically on your next run.",
					resp.StatusCode),
			}
		}
		return &SubmitResult{
			Err: c.unexpectedStatusError(resp),
		}
	}
}

// -----------------------------------------------------------------------
// GET /api/v1/sessions/recent
// -----------------------------------------------------------------------

// GetRecentSessions fetches the last N scored sessions for the authenticated user.
func (c *Client) GetRecentSessions(limit int) (*RecentSessionsResponse, error) {
	url := fmt.Sprintf("%s/api/v1/cli/sessions/recent?limit=%d", c.baseURL, limit)

	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to build request: %w", err)
	}

	c.setHeaders(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf(
			"Could not reach DevScope at %s.\n"+
				"Check your network connection and DEVSCOPE_API_BASE_URL.", c.baseURL)
	}
	defer resp.Body.Close()

	if err := c.checkAuthError(resp); err != nil {
		return nil, err
	}

	if resp.StatusCode != http.StatusOK {
		return nil, c.unexpectedStatusError(resp)
	}

	var result RecentSessionsResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to parse recent sessions response: %w", err)
	}

	return &result, nil
}

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

// setHeaders applies the standard DevScope headers to a request.
func (c *Client) setHeaders(req *http.Request) {
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("X-CLI-Version", c.cliVersion)
}

// checkAuthError returns a human-readable error if the response is 401.
func (c *Client) checkAuthError(resp *http.Response) error {
	if resp.StatusCode == http.StatusUnauthorized {
		return fmt.Errorf(
			"Your API key was rejected. Run \"devscope auth\" to re-authenticate.")
	}
	return nil
}

// unexpectedStatusError builds an error from a non-success response.
func (c *Client) unexpectedStatusError(resp *http.Response) error {
	msg := c.readErrorBody(resp)
	return fmt.Errorf("DevScope returned an unexpected response (HTTP %d): %s",
		resp.StatusCode, msg)
}

// readErrorBody reads the response body as a string, capped at 512 bytes,
// for inclusion in error messages.
func (c *Client) readErrorBody(resp *http.Response) string {
	body, err := io.ReadAll(io.LimitReader(resp.Body, 512))
	if err != nil || len(body) == 0 {
		return "(no detail)"
	}
	return string(body)
}
