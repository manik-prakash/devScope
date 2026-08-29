package cmd

import "testing"

func TestFormatScore(t *testing.T) {
	if got := formatScore(nil); got != "—" {
		t.Errorf("formatScore(nil) = %q, want %q", got, "—")
	}

	v := 82.0
	if got := formatScore(&v); got != "82.0" {
		t.Errorf("formatScore(&82.0) = %q, want %q", got, "82.0")
	}

	z := 0.0
	if got := formatScore(&z); got != "0.0" {
		t.Errorf("formatScore(&0.0) = %q, want %q — a real zero score is not the same as unscored", got, "0.0")
	}
}
