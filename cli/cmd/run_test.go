package cmd

import (
	"testing"
)

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
