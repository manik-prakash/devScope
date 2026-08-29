package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
)

// version holds the CLI version, set from main.go via SetVersion().
var version = "dev"

// ExitError carries an explicit process exit code from a RunE up to main().
// Cobra collapses every returned error to exit 1; main() unwraps this type so
// `devscope run <agent>` can exit with the wrapped agent's own code (R-01).
type ExitError struct{ Code int }

func (e *ExitError) Error() string { return fmt.Sprintf("exit code %d", e.Code) }

// SetVersion sets the CLI version string. Called from main before Execute.
func SetVersion(v string) {
	version = v
}

// Version returns the current CLI version.
func Version() string {
	return version
}

// rootCmd is the top-level Cobra command. Every subcommand attaches to this.
var rootCmd = &cobra.Command{
	Use:   "devscope",
	Short: "DevScope — AI agent analytics for engineering teams",
	Long: `DevScope captures AI coding agent sessions, redacts all sensitive content
on-device, and ships only behavioral metadata to the DevScope platform
for AI-powered evaluation.

No code, no prompt text, no file names, no secrets ever leave your machine.

Getting started:
  1. Run "devscope auth" to authenticate with your API key
  2. Run "devscope run" to wrap your AI coding agent
  3. Run "devscope status" to view your session scores`,

	// The root command itself does nothing — print help when invoked bare.
	RunE: func(cmd *cobra.Command, args []string) error {
		return cmd.Help()
	},

	// Silence Cobra's default error and usage printing so we control the output.
	SilenceErrors: true,
	SilenceUsage:  true,
}

// init registers the persistent --version flag on the root command.
func init() {
	rootCmd.Flags().BoolP("version", "v", false, "Print the CLI version and exit")

	// Override the default version behavior so --version prints our format.
	rootCmd.PersistentPreRunE = func(cmd *cobra.Command, args []string) error {
		return nil
	}

	// Custom version handling: if --version is passed on root, print and exit.
	rootCmd.RunE = func(cmd *cobra.Command, args []string) error {
		v, _ := cmd.Flags().GetBool("version")
		if v {
			fmt.Printf("devscope version %s\n", version)
			return nil
		}
		return cmd.Help()
	}
}

// RegisterCommand adds a subcommand to the root command.
// All command files call this from their init() function.
func RegisterCommand(cmd *cobra.Command) {
	rootCmd.AddCommand(cmd)
}

// Execute runs the root command. Called from main.
func Execute() error {
	return rootCmd.Execute()
}
