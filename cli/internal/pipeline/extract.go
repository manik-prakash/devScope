package pipeline

import (
	"sort"

	"github.com/manik-prakash/devscope-cli/internal/agent/adapters"
	"github.com/manik-prakash/devscope-cli/internal/api"
)

// ExtractStats calculates behavioral metadata from a sanitized session and file diff.
// The resulting SessionStats contains purely mathematical insights without
// any raw user code or PII.
func ExtractStats(sess *adapters.NormalizedSession, diffResult *DiffResult) api.SessionStats {
	var stats api.SessionStats

	if sess == nil {
		return stats
	}

	var totalPromptLen, totalResponseLen int

	for _, msg := range sess.Messages {
		switch msg.Role {
		case "user", "human":
			stats.TotalPrompts++
			totalPromptLen += msg.ContentLength
		case "assistant":
			stats.TotalResponses++
			totalResponseLen += msg.ContentLength

			stats.TotalToolCalls += len(msg.ToolCalls)
			for _, tc := range msg.ToolCalls {
				if tc.IsShellCommand {
					stats.ShellCommandsCount++
				}
			}
		}
	}

	// Calculate True Meaning of "Iterations" - 
	// Commonly, Total Iterations == Total Prompts (one prompt kicks off an action cycle)
	stats.TotalIterations = stats.TotalPrompts

	// Averages derived from pre-redaction ContentLength variables.
	if stats.TotalPrompts > 0 {
		stats.AvgPromptLength = float64(totalPromptLen) / float64(stats.TotalPrompts)
	}
	if stats.TotalResponses > 0 {
		stats.AvgResponseLength = float64(totalResponseLen) / float64(stats.TotalResponses)
	}

	// Diff metadata
	if diffResult != nil {
		stats.FilesChangedCount = diffResult.TotalChanged()
	}

	// Consolidate 'FileTypesTouched'
	extMap := make(map[string]bool)

	// Extensions detected by adapting logs
	for _, ext := range sess.FileExtensions {
		if ext != "" {
			extMap[ext] = true
		}
	}

	// Extensions derived from comparing the physical disk paths
	if diffResult != nil {
		for _, ext := range diffResult.Extensions() {
			if ext != "" {
				extMap[ext] = true
			}
		}
	}

	var mergedExts []string
	for ext := range extMap {
		mergedExts = append(mergedExts, ext)
	}

	// Keep outputs predictably sorted
	sort.Strings(mergedExts)
	stats.FileTypesTouched = mergedExts

	return stats
}
