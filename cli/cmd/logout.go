package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
	"github.com/manik-prakash/devscope-cli/internal/config"
)

var logoutCmd = &cobra.Command{
	Use:   "logout",
	Short: "Disconnect your environment and wipe identity files locally",
	Long: `Permanently deletes the active localized config layer preventing subsequent operations.
Stored offline queues are unaffected logically preventing telemetry wipes structurally.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		if !config.Exists() {
			fmt.Println("Already securely logged out — no identity footprint found locally.")
			return nil
		}

		if err := config.Delete(); err != nil {
			return fmt.Errorf("failed structurally to process environmental wipe securely: %w", err)
		}

		fmt.Println("✅ Successfully disconnected.")
		return nil
	},
}

func init() {
	RegisterCommand(logoutCmd)
}
