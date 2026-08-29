package cmd

import (
	"errors"
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

// runAgent execs the wrapped agent with stdio passed straight through. A
// non-zero exit from the agent is returned as (code, nil) — that is the agent's
// result, not our error. Only a failure to start (or a signal kill) is returned
// as a non-nil error.
func runAgent(cmdPath string, args []string) (int, error) {
	c := exec.Command(cmdPath, args...)
	c.Stdin, c.Stdout, c.Stderr = os.Stdin, os.Stdout, os.Stderr
	if err := c.Run(); err != nil {
		if ee, ok := errors.AsType[*exec.ExitError](err); ok {
			return ee.ExitCode(), nil
		}
		return 0, err
	}
	return 0, nil
}

// agentResult maps a remembered agent exit code onto RunE's return value so
// main() can exit with it. Zero → nil (clean exit); non-zero → *ExitError.
// Telemetry problems never reach this — they are logged to stderr and the
// agent's own code still wins.
func agentResult(code int) error {
	if code != 0 {
		return &ExitError{Code: code}
	}
	return nil
}

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

		// 5. Execute the agent, passing stdio straight through. Telemetry still
		// ships whatever the agent's exit code is; that code is remembered and
		// becomes `devscope run`'s own exit code once shipping is done (R-01).
		agentExitCode, runErr := runAgent(agentCmd, agentArgs)
		if runErr != nil {
			// Couldn't start / killed by signal — no session to record.
			return fmt.Errorf("devscope: agent failed to run: %w", runErr)
		}
		if agentExitCode != 0 {
			fmt.Fprintf(os.Stderr, "devscope: agent exited with code %d\n", agentExitCode)
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
			// Without logs, we can't build meaningful metrics. Skip analytics —
			// the agent still ran, so its exit code is what matters.
			fmt.Println("devscope: Log capture disabled or missing. No session recorded.")
			return agentResult(agentExitCode)
		}

		var adapter adapters.Adapter
		switch agentSlug {
		case "claude-code":
			adapter = &adapters.ClaudeAdapter{}
		case "codex":
			adapter = &adapters.CodexAdapter{}
		default:
			// A bad agent name is a usage error, not a telemetry hiccup — exit
			// non-zero so scripts/CI notice.
			return fmt.Errorf("no telemetry adapter for agent %q (supported: claude-code, codex)", agentSlug)
		}
		
		sess, err := adapter.ParseSessionFile(logFile)
		if err != nil {
			// Telemetry skipped — say why, but the agent's exit code stands.
			fmt.Fprintf(os.Stderr, "devscope: could not parse session log: %v\n", err)
			return agentResult(agentExitCode)
		}
		if sess == nil || len(sess.Messages) == 0 {
			// Could occur if they simply booted and instantly killed without interaction.
			return agentResult(agentExitCode)
		}

		// 8. Pipeline Sequence
		if err := pipeline.Normalize(sess); err != nil {
			fmt.Fprintf(os.Stderr, "devscope: failed to normalize session: %v\n", err)
			return agentResult(agentExitCode)
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
			fmt.Fprintf(os.Stderr, "devscope: failed to sanitize session: %v\n", err)
			return agentResult(agentExitCode)
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

		// 9. Protect & Ship. A telemetry failure here is logged but never
		// changes the exit code — that belongs to the wrapped agent (R-01).
		if cfg.SigningSecret == "" {
			fmt.Fprintln(os.Stderr,
				"devscope: missing signing secret in local config — session not shipped.\n"+
					"Run \"devscope auth\" again to fetch it from the backend.")
			return agentResult(agentExitCode)
		}
		if err := pipeline.SignPayload(payload, cfg.SigningSecret); err != nil {
			fmt.Fprintf(os.Stderr, "devscope: failed to secure session payload: %v\n", err)
			return agentResult(agentExitCode)
		}

		if err := pipeline.ShipSession(client, config.QueueDir(), payload); err != nil {
			fmt.Fprintf(os.Stderr, "devscope: Local queue fault: %v\n", err)
		}

		return agentResult(agentExitCode)
	},
}

func init() {
	runCmd.Flags().StringP("project", "p", "", "Explicitly override the project slug tracking")
	RegisterCommand(runCmd)
}
