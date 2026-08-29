package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// -----------------------------------------------------------------------
// GET /api/v1/me
// -----------------------------------------------------------------------

func TestGetMe_Success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Verify request.
		if r.Method != http.MethodGet {
			t.Errorf("expected GET, got %s", r.Method)
		}
		if r.URL.Path != "/api/v1/cli/me" {
			t.Errorf("expected /api/v1/cli/me, got %s", r.URL.Path)
		}
		if got := r.Header.Get("Authorization"); got != "Bearer test-key" {
			t.Errorf("Authorization header: got %q", got)
		}
		if got := r.Header.Get("X-CLI-Version"); got != "0.1.0" {
			t.Errorf("X-CLI-Version header: got %q", got)
		}

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(MeResponse{
			UserID:             "user-001",
			OrgID:              "org-001",
			Name:               "Jane Developer",
			Email:              "jane@example.com",
			DefaultProjectSlug: "backend-api",
			Projects: []MeProject{
				{ID: "proj-1", Slug: "backend-api", Name: "Backend API"},
				{ID: "proj-2", Slug: "frontend", Name: "Frontend App"},
			},
		})
	}))
	defer server.Close()

	client := NewClient(server.URL, "test-key", "0.1.0")
	me, err := client.GetMe()
	if err != nil {
		t.Fatalf("GetMe failed: %v", err)
	}

	if me.UserID != "user-001" {
		t.Errorf("UserID: got %q", me.UserID)
	}
	if me.OrgID != "org-001" {
		t.Errorf("OrgID: got %q", me.OrgID)
	}
	if me.Name != "Jane Developer" {
		t.Errorf("Name: got %q", me.Name)
	}
	if me.Email != "jane@example.com" {
		t.Errorf("Email: got %q", me.Email)
	}
	if me.DefaultProjectSlug != "backend-api" {
		t.Errorf("DefaultProjectSlug: got %q", me.DefaultProjectSlug)
	}
	if len(me.Projects) != 2 {
		t.Fatalf("Projects count: got %d, want 2", len(me.Projects))
	}
	if me.Projects[0].Slug != "backend-api" {
		t.Errorf("Projects[0].Slug: got %q", me.Projects[0].Slug)
	}
}

func TestGetMe_Unauthorized(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		w.Write([]byte(`{"error":"invalid key"}`))
	}))
	defer server.Close()

	client := NewClient(server.URL, "bad-key", "0.1.0")
	_, err := client.GetMe()
	if err == nil {
		t.Fatal("expected error for 401")
	}
	if !strings.Contains(err.Error(), "devscope auth") {
		t.Errorf("error should mention 'devscope auth': %v", err)
	}
}

func TestGetMe_ServerDown(t *testing.T) {
	// Point to a closed server → connection refused.
	client := NewClient("http://127.0.0.1:1", "key", "0.1.0")
	_, err := client.GetMe()
	if err == nil {
		t.Fatal("expected error when server is down")
	}
	if !strings.Contains(err.Error(), "Could not reach") {
		t.Errorf("error should mention connectivity: %v", err)
	}
}

// -----------------------------------------------------------------------
// Error classification (R-01): callers distinguish an actionable auth
// failure from a transient backend outage via errors.Is.
// -----------------------------------------------------------------------

func TestGetMe_ErrorClassification(t *testing.T) {
	tests := []struct {
		name    string
		handler http.HandlerFunc // nil → point at a closed server
		want    error
	}{
		{
			name:    "401 wraps ErrAuthRejected",
			handler: func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusUnauthorized) },
			want:    ErrAuthRejected,
		},
		{
			name:    "503 wraps ErrUnavailable",
			handler: func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusServiceUnavailable) },
			want:    ErrUnavailable,
		},
		{
			name:    "429 wraps ErrUnavailable",
			handler: func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusTooManyRequests) },
			want:    ErrUnavailable,
		},
		{
			name:    "transport failure wraps ErrUnavailable",
			handler: nil,
			want:    ErrUnavailable,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			url := "http://127.0.0.1:1"
			if tt.handler != nil {
				server := httptest.NewServer(tt.handler)
				defer server.Close()
				url = server.URL
			}
			_, err := NewClient(url, "key", "0.1.0").GetMe()
			if !errors.Is(err, tt.want) {
				t.Fatalf("GetMe error = %v, want errors.Is(_, %v)", err, tt.want)
			}
		})
	}
}

func TestGetRecentSessions_ErrorClassification(t *testing.T) {
	tests := []struct {
		name    string
		handler http.HandlerFunc
		want    error
	}{
		{
			name:    "401 wraps ErrAuthRejected",
			handler: func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusUnauthorized) },
			want:    ErrAuthRejected,
		},
		{
			name:    "500 wraps ErrUnavailable",
			handler: func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusInternalServerError) },
			want:    ErrUnavailable,
		},
		{
			name:    "transport failure wraps ErrUnavailable",
			handler: nil,
			want:    ErrUnavailable,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			url := "http://127.0.0.1:1"
			if tt.handler != nil {
				server := httptest.NewServer(tt.handler)
				defer server.Close()
				url = server.URL
			}
			_, err := NewClient(url, "key", "0.1.0").GetRecentSessions(5)
			if !errors.Is(err, tt.want) {
				t.Fatalf("GetRecentSessions error = %v, want errors.Is(_, %v)", err, tt.want)
			}
		})
	}
}

// -----------------------------------------------------------------------
// POST /api/v1/sessions
// -----------------------------------------------------------------------

func TestSubmitSession_Accepted(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("expected POST, got %s", r.Method)
		}
		if r.URL.Path != "/api/v1/cli/sessions" {
			t.Errorf("expected /api/v1/cli/sessions, got %s", r.URL.Path)
		}
		if ct := r.Header.Get("Content-Type"); ct != "application/json" {
			t.Errorf("Content-Type: got %q", ct)
		}

		// Decode and verify payload.
		var payload SessionPayload
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatalf("failed to decode payload: %v", err)
		}
		if payload.SessionID != "sess-001" {
			t.Errorf("SessionID: got %q", payload.SessionID)
		}

		w.WriteHeader(http.StatusAccepted)
	}))
	defer server.Close()

	client := NewClient(server.URL, "test-key", "0.1.0")
	result := client.SubmitSession(&SessionPayload{
		SessionID:    "sess-001",
		UserID:       "user-001",
		OrgID:        "org-001",
		ProjectID:    "proj-001",
		Agent:        "claude-code",
		AgentVersion: "1.0.0",
		StartedAt:    "2026-03-28T10:00:00Z",
		EndedAt:      "2026-03-28T10:30:00Z",
		DurationMs:   1800000,
		CLIVersion:   "0.1.0",
		Signature:    "abc123",
		Stats: SessionStats{
			TotalPrompts:    5,
			TotalResponses:  5,
			TotalIterations: 10,
		},
	})

	if !result.Accepted {
		t.Errorf("expected Accepted=true, got false (err: %v)", result.Err)
	}
	if result.Err != nil {
		t.Errorf("expected nil error: %v", result.Err)
	}
}

func TestSubmitSession_Unauthorized(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer server.Close()

	client := NewClient(server.URL, "bad-key", "0.1.0")
	result := client.SubmitSession(&SessionPayload{SessionID: "s1"})

	if result.Accepted {
		t.Error("should not be accepted")
	}
	if result.Retriable {
		t.Error("401 should not be retriable")
	}
	if result.Err == nil || !strings.Contains(result.Err.Error(), "devscope auth") {
		t.Errorf("should mention devscope auth: %v", result.Err)
	}
}

func TestSubmitSession_BadRequest(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		w.Write([]byte("signature mismatch"))
	}))
	defer server.Close()

	client := NewClient(server.URL, "key", "0.1.0")
	result := client.SubmitSession(&SessionPayload{SessionID: "s1"})

	if result.Accepted {
		t.Error("should not be accepted")
	}
	if result.Retriable {
		t.Error("400 should not be retriable")
	}
	if result.Err == nil || !strings.Contains(result.Err.Error(), "signature") {
		t.Errorf("should mention signature: %v", result.Err)
	}
}

func TestSubmitSession_RateLimited(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusTooManyRequests)
	}))
	defer server.Close()

	client := NewClient(server.URL, "key", "0.1.0")
	result := client.SubmitSession(&SessionPayload{SessionID: "s1"})

	if result.Accepted {
		t.Error("should not be accepted")
	}
	if !result.Retriable {
		t.Error("429 should be retriable")
	}
}

func TestSubmitSession_ServerError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	client := NewClient(server.URL, "key", "0.1.0")
	result := client.SubmitSession(&SessionPayload{SessionID: "s1"})

	if result.Accepted {
		t.Error("should not be accepted")
	}
	if !result.Retriable {
		t.Error("500 should be retriable")
	}
	if result.Err == nil || !strings.Contains(result.Err.Error(), "saved locally") {
		t.Errorf("should mention local save: %v", result.Err)
	}
}

func TestSubmitSession_Unreachable(t *testing.T) {
	client := NewClient("http://127.0.0.1:1", "key", "0.1.0")
	result := client.SubmitSession(&SessionPayload{SessionID: "s1"})

	if result.Accepted {
		t.Error("should not be accepted")
	}
	if !result.Retriable {
		t.Error("unreachable should be retriable")
	}
}

// -----------------------------------------------------------------------
// GET /api/v1/sessions/recent
// -----------------------------------------------------------------------

func TestGetRecentSessions_Success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/cli/sessions/recent" {
			t.Errorf("expected /api/v1/cli/sessions/recent, got %s", r.URL.Path)
		}
		if got := r.URL.Query().Get("limit"); got != "5" {
			t.Errorf("limit param: got %q", got)
		}

		w.WriteHeader(http.StatusOK)
		// s2 is unscored — the backend sends score: null.
		w.Write([]byte(`{"sessions":[` +
			`{"session_id":"s1","agent":"claude-code","started_at":"2026-03-28T10:00:00Z","score":8.5,"status":"scored"},` +
			`{"session_id":"s2","agent":"codex","started_at":"2026-03-27T14:00:00Z","score":null,"status":"queued"}` +
			`]}`))
	}))
	defer server.Close()

	client := NewClient(server.URL, "test-key", "0.1.0")
	result, err := client.GetRecentSessions(5)
	if err != nil {
		t.Fatalf("GetRecentSessions failed: %v", err)
	}

	if len(result.Sessions) != 2 {
		t.Fatalf("Sessions count: got %d, want 2", len(result.Sessions))
	}
	if result.Sessions[0].SessionID != "s1" {
		t.Errorf("Sessions[0].SessionID: got %q", result.Sessions[0].SessionID)
	}
	if result.Sessions[0].Score == nil || *result.Sessions[0].Score != 8.5 {
		t.Errorf("Sessions[0].Score: got %v, want 8.5", result.Sessions[0].Score)
	}
	if result.Sessions[1].Score != nil {
		t.Errorf("Sessions[1].Score: got %v, want nil (unscored)", *result.Sessions[1].Score)
	}
}

func TestGetRecentSessions_Unauthorized(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer server.Close()

	client := NewClient(server.URL, "bad-key", "0.1.0")
	_, err := client.GetRecentSessions(5)
	if err == nil {
		t.Fatal("expected error for 401")
	}
}
