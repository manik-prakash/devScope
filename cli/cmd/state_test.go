package cmd

import (
	"testing"
)

func TestSyncCmd_Registration(t *testing.T) {
	if syncCmd.Use != "sync" {
		t.Errorf("Unexpected use signature: %s", syncCmd.Use)
	}
}

func TestConfigCmd_Registration(t *testing.T) {
	if configCmd.Use != "config" {
		t.Errorf("Unexpected use signature: %s", configCmd.Use)
	}
	
	// Ensure set is nested properly mathematically
	if len(configCmd.Commands()) != 1 || configCmd.Commands()[0].Use != "set [key] [value]" {
		t.Errorf("Nested command structures broken or improperly matched")
	}
}

func TestLogoutCmd_Registration(t *testing.T) {
	if logoutCmd.Use != "logout" {
		t.Errorf("Unexpected use signature: %s", logoutCmd.Use)
	}
}
