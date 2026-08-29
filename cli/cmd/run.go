package cmd

import (
	"fmt"
	"os"
	"os/exec"
	"time"

	"github.com/spf13/cobra"
	"github.com/manik-prakash/devscope-cli/internal/agent"
	"github.com/manik-prakash/devscope-cli/internal/agent/adapters"
	"github.com/manik-prakash/devscope-cli/internal/api"
	"github.com/manik-prakash/devscope-cli/internal/config"
	"github.com/manik-prakash/devscope-cli/internal/pipeline"
)

// resolveAgentInvocation decides which agent to wrap. Precedence: a positional
// `devscope run <agent> …` arg, else the configured default (`config set agent`).
// `config set custom_command` overrides only the binary that is exec'd — the
// slug used for adapter selection and log discovery still comes from the agent
// name. Returns (slug, execCmd, passthroughArgs, err).
func resolveAgentInvocation(args []string, cfg *config.Config) (string, string, []string, error) {
	raw := cfg.Agent
	var rest []string
	if len(args) > 0 {
		raw = args[0]
		rest = args[1:]
	}
	if raw == "" {
		return "", "", nil, fmt.Errorf(
			"no agent specified — run \"devscope run <agent>\" or set a default with \"devscope config set agent <agent>\"")
	}
	execCmd := raw
	if cfg.CustomCommand != "" {
		execCmd = cfg.CustomCommand
	}
	return raw, execCmd, rest, nil
}

var runCmd = &cobra.Command{
	Use:   "run [agent] [args...]",
	Short: "Wrap an AI agent to automatically capture and ship behavioral telemetry",
	Long: `run executes your AI agent, takes pre/post filesystem snapshots to calculate
diffs, securely redacts any sensitive information from the local logs, and
calculates behavioral telemetry metadata before shipping to DevScope.

Example:
  devscope run claude code
  devscope run my-custom-agent --args`,
	Args: cobra.ArbitraryArgs,
	RunE: func(cmd *cobra.Command, args []string) error {
		// 1. Core Integrations
		cfg, err := config.Load()
		if err != nil {
			return err
		}

		if config.IsCacheStale(cfg) {
			fmt.Fprintln(os.Stderr, "devscope: cached project/user info may be stale — run \"devscope sync\".")
		}

		apiURL, err := config.APIBaseURL()
		if err != nil {
			return err
		}

		client := api.NewClient(apiURL, cfg.APIKey, Version())

		// 2. Drain Existing Offline Queues implicitly
		pipeline.DrainQueue(client, config.QueueDir())

		// 3. Command Definition — positional arg wins, else the configured
		// default agent; `custom_command` overrides only the exec'd binary.
		agentRaw, agentCmd, agentArgs, err := resolveAgentInvocation(args, cfg)
		if err != nil {
			return err
		}

		agentSlug := agent.ResolveAgent(agentRaw)
		agentVersion := agent.ProbeVersion(agentCmd)
		
		// Map active project — repo-local .devscope.yaml `project:` participates.
		cwd, _ := os.Getwd()
		projectSlug, _ := cmd.Flags().GetString("project")
		project, err := config.ResolveProjectForDir(cfg, projectSlug, cwd)
		if err != nil {
			return err
		}

		// 4. Pre-Flight Tracking
		preSnapshot, _ := pipeline.TakeSnapshot(cwd, pipeline.SnapshotOptions{})

		startedAt := time.Now().UTC()

		// 5. Execute Command natively (wrap IO completely)
		execCmd := exec.Command(agentCmd, agentArgs...)
		execCmd.Stdin = os.Stdin
		execCmd.Stdout = os.Stdout
		execCmd.Stderr = os.Stderr

		// Wait for the agent to exit. We don't bubble its exit code (telemetry
		// still ships), but a non-nil error means it crashed or was killed — say
		// so, otherwise a session with no messages looks like "nothing recorded".
		if runErr := execCmd.Run(); runErr != nil {
			fmt.Fprintf(os.Stderr, "devscope: agent exited with error: %v\n", runErr)
		}

		endedAt := time.Now().UTC()
		durationMs := int(endedAt.Sub(startedAt).Milliseconds())

		// 6. Post-Flight Diff Tracking
		postSnapshot, _ := pipeline.TakeSnapshot(cwd, pipeline.SnapshotOptions{})
		diff := pipeline.ComputeDiff(preSnapshot, postSnapshot)

		// 7. Locate & Parse Log output
		// Only consider transcripts touched during this run. A small grace absorbs
		// filesystem mtime granularity and minor clock skew.
		logFile := agent.FindLatestLogFile(agentSlug, "", startedAt.Add(-2*time.Second))
		if logFile == "" {
			// Without logs, we can't build meaningful metrics. Gracefully exit analytics, but workflow succeeded.
			fmt.Println("devscope: Log capture disabled or missing. No session recorded.")
			return nil
		}

		var adapter adapters.Adapter
		switch agentSlug {
		case "claude-code":
			adapter = &adapters.ClaudeAdapter{}
		case "codex":
			adapter = &adapters.CodexAdapter{}
		default:
			// Adapter not implemented yet.
			fmt.Printf("devscope: Adapter for '%s' not implemented yet.\n", agentSlug)
			return nil
		}
		
		sess, err := adapter.ParseSessionFile(logFile)
		if err != nil {
			// Don't fail the wrapped agent's exit code, but say why telemetry
			// was skipped instead of vanishing silently.
			fmt.Fprintf(os.Stderr, "devscope: could not parse session log: %v\n", err)
			return nil
		}
		if sess == nil || len(sess.Messages) == 0 {
			// Could occur if they simply booted and instantly killed without interaction.
			return nil
		}

		// 8. Pipeline Sequence
		if err := pipeline.Normalize(sess); err != nil {
			return fmt.Errorf("failed to normalize session: %w", err)
		}

		// Redact deeply (no local configs fetched yet for brevity, using built-ins)
		customPatterns := []string{}
		repoCfg, _ := config.LoadRepoConfig(cwd)
		if repoCfg != nil {
			customPatterns = repoCfg.CustomStripPatterns
		}
		if bad := pipeline.InvalidPatterns(customPatterns); len(bad) > 0 {
			fmt.Fprintf(os.Stderr,
				"devscope: ignoring %d invalid custom_strip_patterns (secrets matching these will NOT be redacted): %v\n",
				len(bad), bad)
		}

		sanitized, redactionCount, err := pipeline.RedactSession(sess, customPatterns)
		if err != nil {
			return fmt.Errorf("failed to sanitize session: %w", err)
		}
		if redactionCount > 0 {
			if logErr := pipeline.AppendRedactionLog(config.RedactionLogPath(), sanitized.SessionID, redactionCount); logErr != nil {
				fmt.Fprintf(os.Stderr, "devscope: could not write redaction log: %v\n", logErr)
			}
		}

		stats := pipeline.ExtractStats(sanitized, diff)

		// Map redacted messages into the transmittable shape.
		// FilePath is intentionally dropped here — only behavioral metadata is sent.
		sanitizedMessages := make([]api.SanitizedMessage, 0, len(sanitized.Messages))
		for _, m := range sanitized.Messages {
			msg := api.SanitizedMessage{
				Role:          m.Role,
				Content:       m.Content,
				ContentLength: m.ContentLength,
				Timestamp:     m.Timestamp,
			}
			for _, tc := range m.ToolCalls {
				msg.ToolCalls = append(msg.ToolCalls, api.SanitizedToolCall{
					ID:              tc.ID,
					Name:            tc.Name,
					Input:           tc.Input,
					Output:          tc.Output,
					IsFileModifying: tc.IsFileModifying,
					IsShellCommand:  tc.IsShellCommand,
				})
			}
			sanitizedMessages = append(sanitizedMessages, msg)
		}

		payload := &api.SessionPayload{
			SessionID:    sanitized.SessionID,
			UserID:       cfg.UserID,
			OrgID:        cfg.OrgID,
			ProjectID:    project.ID,
			Agent:        agentSlug,
			AgentVersion: agentVersion,
			StartedAt:    startedAt.Format(time.RFC3339),
			EndedAt:      endedAt.Format(time.RFC3339),
			DurationMs:   int64(durationMs),
			Stats:        stats,
			Messages:     sanitizedMessages,
			CLIVersion:   Version(),
		}

		// 9. Protect & Ship
		if cfg.SigningSecret == "" {
			return fmt.Errorf(
				"missing signing secret in local config.\n" +
					"Run \"devscope auth\" again to fetch it from the backend.")
		}
		if err := pipeline.SignPayload(payload, cfg.SigningSecret); err != nil {
			return fmt.Errorf("failed to secure session payload: %w", err)
		}

		if err := pipeline.ShipSession(client, config.QueueDir(), payload); err != nil {
			fmt.Fprintf(os.Stderr, "devscope: Local queue fault: %v\n", err)
		}

		return nil
	},
}

func init() {
	runCmd.Flags().StringP("project", "p", "", "Explicitly override the project slug tracking")
	RegisterCommand(runCmd)
}
