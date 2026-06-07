package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadDotEnv(t *testing.T) {
	path := filepath.Join(t.TempDir(), ".env")
	content := "# comment\n\nADDR=:9999\nexport PUBLIC_BASE_URL=\"https://example.test/api\"\nBROKEN LINE\n"
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}

	// Real environment must win over the file.
	t.Setenv("ADDR", ":1234")
	t.Setenv("PUBLIC_BASE_URL", "")

	LoadDotEnv(path)

	if got := os.Getenv("ADDR"); got != ":1234" {
		t.Errorf("ADDR = %q, want real env to win (:1234)", got)
	}
	if got := os.Getenv("PUBLIC_BASE_URL"); got != "https://example.test/api" {
		t.Errorf("PUBLIC_BASE_URL = %q, want value from file without quotes", got)
	}
}

func TestLoadDotEnvMissingFileIsNoop(t *testing.T) {
	LoadDotEnv(filepath.Join(t.TempDir(), "does-not-exist"))
}
