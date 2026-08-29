package main

import (
	"errors"
	"os"

	"github.com/manik-prakash/devscope-cli/cmd"
)

// version is injected at build time via:
//
//	go build -ldflags "-X main.version=1.2.3"
//
// GoReleaser sets this automatically from the git tag.
var version = "dev"

func main() {
	cmd.SetVersion(version)

	if err := cmd.Execute(); err != nil {
		if ee, ok := errors.AsType[*cmd.ExitError](err); ok {
			os.Exit(ee.Code)
		}
		os.Exit(1)
	}
}
