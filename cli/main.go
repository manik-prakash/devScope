package main

import (
	"os"

	"github.com/example/devscope-cli/cmd"
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
		os.Exit(1)
	}
}
