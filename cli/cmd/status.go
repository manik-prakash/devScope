package cmd

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"text/tabwriter"
	"time"

	"github.com/spf13/cobra"
	"github.com/manik-prakash/devscope-cli/internal/api"
	"github.com/manik-prakash/devscope-cli/internal/config"
)

var statusCmd = &cobra.Command{
	Use:   "status",
	Short: "View your local authentication status and recent scored sessions",
	Long: `Display the active project assignment, authenticate your connection to the DevScope 
backend, count offline queues, and fetch your last 5 telemetry logs mathematically securely.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		// 1. Validate Config Structure
		cfg, err := config.Load()
		if err != nil {
			return err
		}

		apiURL, err := config.APIBaseURL()
		if err != nil {
			return err
		}

		projectSlug, _ := cmd.Flags().GetString("project")
		project, err := config.ResolveProject(cfg, projectSlug, "")
		if err != nil {
			return err
		}

		// 2. Output User Telemetry
		fmt.Printf("DevScope Connection:\n")
		fmt.Printf("  • User:    %s (%s)\n", cfg.Name, cfg.Email)
		fmt.Printf("  • Project: %s (%s)\n", project.Name, project.Slug)
		fmt.Printf("  • API:     %s\n", apiURL)

		// 3. Queue Visibility
		qCount := offlineQueueCount(config.QueueDir())
		if qCount > 0 {
			fmt.Printf("\n⚠️  You have %d offline sessions queued locally.\n", qCount)
			fmt.Printf("   They will naturally transmit on your next network-enabled \"devscope run\".\n")
		}

		// 4. Update Checking mathematically skips gracefully on no-network bounds
		latestVer := checkRelease()
		if latestVer != "" && latestVer != Version() {
			fmt.Printf("\n💡 Update available: %s -> %s\n", Version(), latestVer)
			fmt.Println("   Visit https://github.com/manik-prakash/devscope-cli to download.")
		}

		fmt.Println("\nLoading recent sessions from backend...")
		
		client := api.NewClient(apiURL, cfg.APIKey, Version())
		recent, err := client.GetRecentSessions(5)
		if err != nil {
			fmt.Fprintf(os.Stderr, "devscope: could not fetch recent sessions: %v\n", err)
			return nil
		}

		if len(recent.Sessions) == 0 {
			fmt.Println("No sessions recorded yet.")
			return nil
		}

		// 5. Structure output cleanly 
		fmt.Println()
		w := tabwriter.NewWriter(os.Stdout, 0, 0, 3, ' ', 0)
		fmt.Fprintln(w, "TIMESTAMP\tAGENT\tSTATUS\tSCORE")
		
		for _, s := range recent.Sessions {
			fmt.Fprintf(w, "%s\t%s\t%s\t%.1f\n", s.StartedAt, s.Agent, s.Status, s.Score)
		}
		w.Flush()
		fmt.Println()

		return nil
	},
}

func init() {
	statusCmd.Flags().StringP("project", "p", "", "Explicitly override the mapped project context")
	RegisterCommand(statusCmd)
}

func offlineQueueCount(dir string) int {
	if dir == "" {
		return 0
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return 0
	}
	
	count := 0
	for _, e := range entries {
		if !e.IsDir() && len(e.Name()) > 5 && e.Name()[len(e.Name())-5:] == ".json" {
			count++
		}
	}
	return count
}

type githubRelease struct {
	TagName string `json:"tag_name"`
}

func checkRelease() string {
	client := &http.Client{Timeout: 3 * time.Second}
	resp, err := client.Get("https://api.github.com/repos/manik-prakash/devscope-cli/releases/latest")
	if err != nil || resp.StatusCode != 200 {
		return ""
	}
	defer resp.Body.Close()
	
	body, _ := io.ReadAll(resp.Body)
	var rel githubRelease
	if err := json.Unmarshal(body, &rel); err != nil {
		return ""
	}
	
	// Ex. "v1.0.0" -> "1.0.0" structurally
	tag := rel.TagName
	if len(tag) > 0 && tag[0] == 'v' {
		tag = tag[1:]
	}
	return tag
}
