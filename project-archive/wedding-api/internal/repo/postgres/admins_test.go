package postgres

import "testing"

func TestInferDisplayName(t *testing.T) {
  t.Parallel()

  testCases := []struct {
    name     string
    email    string
    expected string
  }{
    {
      name:     "dot separated local part",
      email:    "arjun.amrith@gmail.com",
      expected: "Arjun Amrith",
    },
    {
      name:     "underscore separated local part",
      email:    "amrithnath_vijayakumar@gmail.com",
      expected: "Amrithnath Vijayakumar",
    },
    {
      name:     "fallback to email for empty local part",
      email:    "@example.com",
      expected: "@example.com",
    },
  }

  for _, testCase := range testCases {
    testCase := testCase
    t.Run(testCase.name, func(t *testing.T) {
      t.Parallel()

      actual := inferDisplayName(testCase.email)

      if actual != testCase.expected {
        t.Fatalf("expected %q, got %q", testCase.expected, actual)
      }
    })
  }
}
