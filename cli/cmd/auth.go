package cmd

import (
	"bufio"
	"fmt"
	"os"
	"strings"

	"github.com/manik-prakash/devscope-cli/internal/api"
	"github.com/manik-prakash/devscope-cli/internal/config"
	"github.com/spf13/cobra"
)

func init() {
	RegisterCommand(authCmd)
}

var authCmd = &cobra.Command{
	Use:   "auth",
	Short: "Authenticate with your DevScope API key",
	Long: `Authenticate with your DevScope API key.

Log in to the DevScope developer dashboard, generate a personal API key,
and paste it here. Your key is stored locally at ~/.devscope/config.yaml
and is never sent anywhere except the DevScope backend.`,
	RunE: runAuth,
}

func runAuth(cmd *cobra.Command, args []string) error {
	// 1. Resolve backend URL.
	baseURL, err := config.APIBaseURL()
	if err != nil {
		return err
	}

	// 2. Prompt for API key.
	apiKey, err := promptAPIKey()
	if err != nil {
		return err
	}

	// 3. Validate the key against the backend.
	fmt.Println("\n  Validating your API key...")

	client := api.NewClient(baseURL, apiKey, version)
	me, err := client.GetMe()
	if err != nil {
		return err
	}

	// 4. Build config and save.
	cfg := &config.Config{
		APIKey:         apiKey,
		SigningSecret:  me.SigningSecret,
		UserID:         me.UserID,
		OrgID:          me.OrgID,
		Name:           me.Name,
		Email:          me.Email,
		DefaultProject: me.DefaultProjectSlug,
		CacheTTL:       3600,
	}

	// Map API projects to config projects.
	cfg.Projects = make([]config.Project, len(me.Projects))
	for i, p := range me.Projects {
		cfg.Projects[i] = config.Project{
			ID:   p.ID,
			Slug: p.Slug,
			Name: p.Name,
		}
	}

	config.TouchCache(cfg)

	if err := config.Save(cfg); err != nil {
		return err
	}

	// 5. Display confirmation.
	printAuthSuccess(cfg)

	return nil
}

// promptAPIKey reads the API key from stdin, masking is not implemented
// because terminals handle paste differently — clarity over cleverness.
func promptAPIKey() (string, error) {
	fmt.Println("  ┌─────────────────────────────────────────────┐")
	fmt.Println("  │         DevScope Authentication             │")
	fmt.Println("  └─────────────────────────────────────────────┘")
	fmt.Println()
	fmt.Println("  Paste your API key from the DevScope dashboard.")
	fmt.Println("  (https://app.devscope.io → Settings → API Keys)")
	fmt.Println()
	fmt.Print("  API Key: ")

	reader := bufio.NewReader(os.Stdin)
	key, err := reader.ReadString('\n')
	if err != nil {
		return "", fmt.Errorf("failed to read API key: %w", err)
	}

	key = strings.TrimSpace(key)
	if key == "" {
		return "", fmt.Errorf("API key cannot be empty. Get your key from the DevScope dashboard.")
	}

	return key, nil
}

// printAuthSuccess displays a formatted confirmation after successful auth.
func printAuthSuccess(cfg *config.Config) {
	fmt.Println()
	fmt.Println("  ✓ Authenticated successfully!")
	fmt.Println()
	fmt.Printf("  Name:    %s\n", cfg.Name)
	fmt.Printf("  Email:   %s\n", cfg.Email)
	fmt.Printf("  Org:     %s\n", cfg.OrgID)
	fmt.Println()

	if len(cfg.Projects) > 0 {
		fmt.Println("  Assigned Projects:")
		for _, p := range cfg.Projects {
			marker := "  "
			if p.Slug == cfg.DefaultProject {
				marker = "→ "
			}
			fmt.Printf("    %s%s (%s)\n", marker, p.Name, p.Slug)
		}
		fmt.Println()
	}

	if cfg.DefaultProject != "" {
		fmt.Printf("  Default project: %s\n", cfg.DefaultProject)
	}

	fmt.Println()
	fmt.Println("  You're all set! Run \"devscope run\" to start a session.")
}
