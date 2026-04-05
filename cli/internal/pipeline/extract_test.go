package pipeline

import (
	"testing"

	"github.com/example/devscope-cli/internal/agent/adapters"
)

func TestExtractStats_EmptySession(t *testing.T) {
	stats := ExtractStats(nil, nil)
	if stats.TotalPrompts != 0 {
		t.Errorf("expected 0 prompts, got %d", stats.TotalPrompts)
	}
	if stats.AvgPromptLength != 0 {
		t.Errorf("expected 0 avg prompt length, got %f", stats.AvgPromptLength)
	}
	if len(stats.FileTypesTouched) != 0 {
		t.Errorf("expected empty FileTypesTouched")
	}

	emptySess := &adapters.NormalizedSession{}
	stats2 := ExtractStats(emptySess, nil)
	if stats2.TotalIterations != 0 {
		t.Errorf("expected 0 iterations, got %d", stats2.TotalIterations)
	}
}

func TestExtractStats_CalculatesAverages(t *testing.T) {
	sess := &adapters.NormalizedSession{
		Messages: []adapters.NormalizedMessage{
			{Role: "user", ContentLength: 10},
			{Role: "user", ContentLength: 20}, // Avg 15
			{Role: "assistant", ContentLength: 100},
			{Role: "assistant", ContentLength: 300}, // Avg 200
		},
	}

	stats := ExtractStats(sess, nil)

	if stats.TotalPrompts != 2 {
		t.Errorf("TotalPrompts: got %d, want 2", stats.TotalPrompts)
	}
	if stats.TotalIterations != 2 {
		t.Errorf("TotalIterations: got %d, want 2", stats.TotalIterations)
	}
	if stats.AvgPromptLength != 15 {
		t.Errorf("AvgPromptLength: got %v, want 15", stats.AvgPromptLength)
	}

	if stats.TotalResponses != 2 {
		t.Errorf("TotalResponses: got %d, want 2", stats.TotalResponses)
	}
	if stats.AvgResponseLength != 200 {
		t.Errorf("AvgResponseLength: got %v, want 200", stats.AvgResponseLength)
	}
}

func TestExtractStats_CountsTools(t *testing.T) {
	sess := &adapters.NormalizedSession{
		Messages: []adapters.NormalizedMessage{
			{
				Role: "assistant",
				ToolCalls: []adapters.NormalizedToolCall{
					{IsShellCommand: false},
					{IsShellCommand: true},
					{IsShellCommand: true},
				},
			},
			{
				Role: "assistant",
				ToolCalls: []adapters.NormalizedToolCall{
					{IsShellCommand: false},
				},
			},
		},
	}

	stats := ExtractStats(sess, nil)

	if stats.TotalToolCalls != 4 {
		t.Errorf("TotalToolCalls: got %d, want 4", stats.TotalToolCalls)
	}
	if stats.ShellCommandsCount != 2 {
		t.Errorf("ShellCommandsCount: got %d, want 2", stats.ShellCommandsCount)
	}
}

func TestExtractStats_MergesExtensions(t *testing.T) {
	sess := &adapters.NormalizedSession{
		FileExtensions: []string{"go", "yaml"},
	}
	diff := &DiffResult{
		// Simulate files changed with diverse extensions
		Added: []FileChange{
			{Path: "main.go", Extension: "go"},
			{Path: "styles.css", Extension: "css"},
		},
		Modified: []FileChange{},
		Deleted: []FileChange{
			{Path: "config.yaml", Extension: "yaml"},
		},
	}

	stats := ExtractStats(sess, diff)

	if stats.FilesChangedCount != 3 {
		t.Errorf("FilesChangedCount: got %d, want 3", stats.FilesChangedCount)
	}

	exts := stats.FileTypesTouched
	// Should be deduplicated and sorted: css, go, yaml
	if len(exts) != 3 {
		t.Fatalf("Extensions: got %d, want 3 (%v)", len(exts), exts)
	}
	if exts[0] != "css" || exts[1] != "go" || exts[2] != "yaml" {
		t.Errorf("Extensions are misordered or missing: %v", exts)
	}
}
