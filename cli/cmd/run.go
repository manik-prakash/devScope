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

var runCmd = &cobra.Command{
	Use:   "run [agent] [args...]",
	Short: "Wrap an AI agent to automatically capture and ship behavioral telemetry",
	Long: `run executes your AI agent, takes pre/post filesystem snapshots to calculate
diffs, securely redacts any sensitive information from the local logs, and
calculates behavioral telemetry metadata before shipping to DevScope.

Example:
  devscope run claude code
  devscope run my-custom-agent --args`,
	Args: cobra.MinimumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		// 1. Core Integrations
		cfg, err := config.Load()
		if err != nil {
			return err
		}

		apiURL, err := config.APIBaseURL()
		if err != nil {
			return err
		}

		client := api.NewClient(apiURL, cfg.APIKey, Version())

		// 2. Drain Existing Offline Queues implicitly
		pipeline.DrainQueue(client, config.QueueDir())

		// 3. Command Definition
		agentRaw := args[0]
		agentCmd := args[0]
		var agentArgs []string
		if len(args) > 1 {
			agentArgs = args[1:]
		}

		agentSlug := agent.ResolveAgent(agentRaw)
		agentVersion := agent.ProbeVersion(agentCmd)
		
		// Map active project
		projectSlug, _ := cmd.Flags().GetString("project")
		project, err := config.ResolveProject(cfg, projectSlug, "")
		if err != nil {
			return err
		}

		// 4. Pre-Flight Tracking
		cwd, _ := os.Getwd()
		preSnapshot, _ := pipeline.TakeSnapshot(cwd, pipeline.SnapshotOptions{})

		startedAt := time.Now().UTC()

		// 5. Execute Command natively (wrap IO completely)
		execCmd := exec.Command(agentCmd, agentArgs...)
		execCmd.Stdin = os.Stdin
		execCmd.Stdout = os.Stdout
		execCmd.Stderr = os.Stderr

		_ = execCmd.Run() // Wait for agent to exit. We don't bubble its specific execution errors here, just tracking is done.

		endedAt := time.Now().UTC()
		durationMs := int(endedAt.Sub(startedAt).Milliseconds())

		// 6. Post-Flight Diff Tracking
		postSnapshot, _ := pipeline.TakeSnapshot(cwd, pipeline.SnapshotOptions{})
		diff := pipeline.ComputeDiff(preSnapshot, postSnapshot)

		// 7. Locate & Parse Log output
		logFile := agent.FindLatestLogFile(agentSlug, "")
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
		
		if err != nil || sess == nil || len(sess.Messages) == 0 {
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

		sanitized, _, err := pipeline.RedactSession(sess, customPatterns)
		if err != nil {
			return fmt.Errorf("failed to sanitize session: %w", err)
		}

		stats := pipeline.ExtractStats(sanitized, diff)

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
			CLIVersion:   Version(),
		}

		// 9. Protect & Ship
		if err := pipeline.SignPayload(payload, cfg.APIKey); err != nil {
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
