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

func TestRedactSession_BuiltIns_ExpandedFamilies(t *testing.T) {
	// Fixtures are assembled from fragments at runtime so the source file holds
	// no literal that looks like a real provider secret — GitHub push protection
	// blocks commits that contain one.
	p := func(parts ...string) string { return strings.Join(parts, "") }
	body := strings.Repeat("a1B2c3D4", 6) // 48 chars of [A-Za-z0-9]

	skKey := p("s", "k", "-") + body
	skOr := p("s", "k", "-", "o", "r", "-") + body
	slack := p("x", "o", "x", "b", "-") + body
	goog := p("A", "I", "z", "a") + body
	jwtSeg := p("e", "y", "J") + strings.Repeat("x", 24)
	jwt := jwtSeg + "." + jwtSeg + "." + strings.Repeat("z", 20)
	urlPass := strings.Repeat("q", 16)

	cases := []struct {
		name    string
		content string
		leak    string // substring that must NOT survive
	}{
		{"openai key", "use " + skKey + " as the key", skKey},
		{"openrouter key", "OPENROUTER_API_KEY=" + skOr, skOr},
		{"slack token", "token " + slack, slack},
		{"google api key", "key " + goog, goog},
		{"jwt", "Authorization " + jwt, jwtSeg},
		{"url basic auth", "clone https://user:" + urlPass + "@example.invalid/x.git", urlPass},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			sess := &adapters.NormalizedSession{
				SessionID: "s",
				Messages:  []adapters.NormalizedMessage{{Role: "user", Content: tc.content, ContentLength: len(tc.content)}},
			}
			out, counts, err := RedactSession(sess, nil)
			if err != nil {
				t.Fatal(err)
			}
			got := out.Messages[0].Content
			if counts == 0 || !contains(got, "[REDACTED]") || contains(got, tc.leak) {
				t.Errorf("secret not redacted (counts=%d): %q", counts, got)
			}
			if out.Messages[0].ContentLength != len(tc.content) {
				t.Errorf("ContentLength changed: %d != %d", out.Messages[0].ContentLength, len(tc.content))
			}
		})
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

func TestInvalidPatterns(t *testing.T) {
	bad := InvalidPatterns([]string{`good_[0-9]+`, ``, `invalid(`, `also[bad`})
	if len(bad) != 2 {
		t.Fatalf("expected 2 invalid patterns, got %d: %v", len(bad), bad)
	}
	if bad[0] != `invalid(` || bad[1] != `also[bad` {
		t.Errorf("unexpected invalid set: %v", bad)
	}

	if got := InvalidPatterns([]string{`^ok$`, `\d+`}); got != nil {
		t.Errorf("expected no invalid patterns, got %v", got)
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
