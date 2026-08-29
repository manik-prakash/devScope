package cmd

import (
	"testing"

	"github.com/manik-prakash/devscope-cli/internal/config"
)

func TestResolveAgentInvocation(t *testing.T) {
	t.Run("positional arg wins", func(t *testing.T) {
		raw, cmd, rest, err := resolveAgentInvocation([]string{"claude", "code", "-x"}, &config.Config{Agent: "codex"})
		if err != nil {
			t.Fatal(err)
		}
		if raw != "claude" || cmd != "claude" {
			t.Errorf("raw/cmd = %q/%q, want claude/claude", raw, cmd)
		}
		if len(rest) != 2 || rest[0] != "code" {
			t.Errorf("rest = %v", rest)
		}
	})

	t.Run("falls back to cfg.Agent when no positional arg", func(t *testing.T) {
		raw, cmd, _, err := resolveAgentInvocation(nil, &config.Config{Agent: "codex"})
		if err != nil {
			t.Fatal(err)
		}
		if raw != "codex" || cmd != "codex" {
			t.Errorf("raw/cmd = %q/%q, want codex/codex", raw, cmd)
		}
	})

	t.Run("cfg.CustomCommand overrides the exec binary but not the slug", func(t *testing.T) {
		raw, cmd, _, err := resolveAgentInvocation([]string{"claude"}, &config.Config{CustomCommand: "/opt/bin/claude-wrap"})
		if err != nil {
			t.Fatal(err)
		}
		if raw != "claude" {
			t.Errorf("raw = %q, want claude (slug for adapter/log discovery)", raw)
		}
		if cmd != "/opt/bin/claude-wrap" {
			t.Errorf("cmd = %q, want the custom command", cmd)
		}
	})

	t.Run("errors when nothing specifies an agent", func(t *testing.T) {
		if _, _, _, err := resolveAgentInvocation(nil, &config.Config{}); err == nil {
			t.Error("expected an error when no agent is given and no default is set")
		}
	})
}

func TestRunCmd_Registration(t *testing.T) {
	if runCmd.Use != "run [agent] [args...]" {
		t.Errorf("Unexpected use signature: %s", runCmd.Use)
	}

	if runCmd.Args == nil {
		t.Errorf("Expected args validation")
	}

	flag := runCmd.Flags().Lookup("project")
	if flag == nil {
		t.Errorf("Expected project flag")
	}
	if flag.Shorthand != "p" {
		t.Errorf("Expected shorthand project flag p")
	}
}

// NOTE: End-to-End mocking for RunE entails stubbing deeply reliant OS components like 
// exec.Command and user configuration maps. For CLI frameworks, functional regression 
// runs are typically captured outside standard golang unit tests using integration hooks.
