package config

import "testing"

func TestSplitCSV(t *testing.T) {
  t.Parallel()

  actual := splitCSV(" one@example.com, two@example.com ,,three@example.com ")

  expected := []string{"one@example.com", "two@example.com", "three@example.com"}
  if len(actual) != len(expected) {
    t.Fatalf("expected %d entries, got %d", len(expected), len(actual))
  }

  for index := range expected {
    if actual[index] != expected[index] {
      t.Fatalf("expected %q at index %d, got %q", expected[index], index, actual[index])
    }
  }
}
