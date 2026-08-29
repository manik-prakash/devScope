package config

// SetDirForTest overrides the resolved ~/.devscope location for the duration of
// a test and returns a function that restores the previous value. It lets
// command-level tests run against a temp dir instead of the caller's real home.
// Not for production use.
func SetDirForTest(dir string) (restore func()) {
	prev := devScopeDir
	devScopeDir = dir
	return func() { devScopeDir = prev }
}
