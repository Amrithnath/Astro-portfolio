package main

import (
  "log"

  "github.com/Amrithnath/Astro-portfolio/wedding-api/internal/app"
)

func main() {
  application, err := app.New()
  if err != nil {
    log.Fatal(err)
  }

  if err := application.Run(); err != nil {
    log.Fatal(err)
  }
}
