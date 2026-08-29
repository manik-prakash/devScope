package cmd

import (
	"errors"
	"os"
	"strconv"
	"testing"

	"github.com/manik-prakash/devscope-cli/internal/config"
)

// TestHelperProcess is not a real test — it's the subprocess runAgent execs in
// TestRunAgent. It exits with HELPER_EXIT_CODE when GO_WANT_HELPER_PROCESS=1.
func TestHelperProcess(t *testing.T) {
	if os.Getenv("GO_WANT_HELPER_PROCESS") != "1" {
		return
	}
	code, _ := strconv.Atoi(os.Getenv("HELPER_EXIT_CODE"))
	os.Exit(code)
}

func TestRunAgent(t *testing.T) {
	t.Run("returns the wrapped process exit code, not an error", func(t *testing.T) {
		t.Setenv("GO_WANT_HELPER_PROCESS", "1")
		t.Setenv("HELPER_EXIT_CODE", "7")

		code, err := runAgent(os.Args[0], []string{"-test.run=TestHelperProcess"})
		if err != nil {
			t.Fatalf("runAgent returned err = %v, want nil (a non-zero exit is not our error)", err)
		}
		if code != 7 {
			t.Fatalf("runAgent code = %d, want 7", code)
		}
	})

	t.Run("zero exit → (0, nil)", func(t *testing.T) {
		t.Setenv("GO_WANT_HELPER_PROCESS", "1")
		t.Setenv("HELPER_EXIT_CODE", "0")

		code, err := runAgent(os.Args[0], []string{"-test.run=TestHelperProcess"})
		if err != nil || code != 0 {
			t.Fatalf("runAgent = (%d, %v), want (0, nil)", code, err)
		}
	})

	t.Run("failure to start → error", func(t *testing.T) {
		_, err := runAgent("devscope-no-such-binary-xyzzy", nil)
		if err == nil {
			t.Fatal("expected an error when the agent binary cannot be started")
		}
	})
}

func TestAgentResult(t *testing.T) {
	if err := agentResult(0); err != nil {
		t.Fatalf("agentResult(0) = %v, want nil", err)
	}
	ee, ok := errors.AsType[*ExitError](agentResult(7))
	if !ok {
		t.Fatal("agentResult(7) should be an *ExitError")
	}
	if ee.Code != 7 {
		t.Fatalf("ExitError.Code = %d, want 7", ee.Code)
	}
}

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
