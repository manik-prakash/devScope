package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
	"github.com/manik-prakash/devscope-cli/internal/api"
	"github.com/manik-prakash/devscope-cli/internal/config"
)

var syncCmd = &cobra.Command{
	Use:   "sync",
	Short: "Refresh your environment and project mappings natively from DevScope",
	Long: `Forces a direct fetch against the DevScope backend to update your
user context. This will overwrite localized projects definitions replacing
them structurally with immediate remote assignments.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		cfg, err := config.Load()
		if err != nil {
			return err
		}

		apiURL, err := config.APIBaseURL()
		if err != nil {
			return err
		}

		fmt.Println("Syncing context with DevScope...")

		client := api.NewClient(apiURL, cfg.APIKey, Version())
		meResp, err := client.GetMe()
		if err != nil {
			fmt.Fprintf(os.Stderr, "\n❌ Sync failed:\n%v\n", err)
			return nil // returning nil intentionally so it doesn't print Cobra usage
		}

		// Mutate local configuration structurally
		cfg.UserID = meResp.UserID
		cfg.OrgID = meResp.OrgID
		cfg.Name = meResp.Name
		cfg.Email = meResp.Email
		
		var projs []config.Project
		for _, p := range meResp.Projects {
			projs = append(projs, config.Project{
				ID:   p.ID,
				Slug: p.Slug,
				Name: p.Name,
			})
		}
		cfg.Projects = projs
		
		// If the user's default project is totally empty or reset, overwrite
		if cfg.DefaultProject == "" && meResp.DefaultProjectSlug != "" {
			cfg.DefaultProject = meResp.DefaultProjectSlug
		}

		config.TouchCache(cfg)

		if err := config.Save(cfg); err != nil {
			return fmt.Errorf("failed to save synced config locally: %w", err)
		}

		fmt.Println("✅ Environment definitions synchronized successfully!")
		return nil
	},
}

func init() {
	RegisterCommand(syncCmd)
}
