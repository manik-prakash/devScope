package cmd

import (
	"fmt"
	"strings"

	"github.com/spf13/cobra"
	"github.com/manik-prakash/devscope-cli/internal/config"
)

var configCmd = &cobra.Command{
	Use:   "config",
	Short: "Manage local DevScope configuration structures",
	Long:  `View or mutate DevScope configuration values directly avoiding manual YAML editing.`,
}

var configSetCmd = &cobra.Command{
	Use:   "set [key] [value]",
	Short: "Set a specific configuration key explicitly (e.g. default_project, agent)",
	Args:  cobra.ExactArgs(2),
	RunE: func(cmd *cobra.Command, args []string) error {
		key := strings.ToLower(args[0])
		val := args[1]

		allowedKeys := map[string]bool{
			"default_project": true,
			"agent":           true,
			"custom_command":  true,
		}

		if !allowedKeys[key] {
			return fmt.Errorf("invalid config key '%s'. Explicitly mutable keys are: default_project, agent, custom_command", key)
		}

		if err := config.Set(key, val); err != nil {
			return err
		}

		fmt.Printf("✅ Set %s = %s successfully.\n", key, val)
		return nil
	},
}

func init() {
	configCmd.AddCommand(configSetCmd)
	RegisterCommand(configCmd)
}
