package adminassets

import (
  "context"
  "fmt"
  "io"
  "net/http"
  "strings"
  "time"

  appconfig "github.com/Amrithnath/Astro-portfolio/wedding-api/internal/config"
  awsconfig "github.com/aws/aws-sdk-go-v2/config"
  "github.com/aws/aws-sdk-go-v2/credentials"
  "github.com/aws/aws-sdk-go-v2/service/s3"
)

type R2Store struct {
  bucket string
  client *s3.Client
}

func NewR2Store(ctx context.Context, env appconfig.Env) (*R2Store, error) {
  endpoint := fmt.Sprintf("https://%s.r2.cloudflarestorage.com", strings.TrimSpace(env.R2AccountID))
  resolver := s3.EndpointResolverFromURL(endpoint)

  cfg, err := awsconfig.LoadDefaultConfig(ctx,
    awsconfig.WithRegion("auto"),
    awsconfig.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(env.R2AccessKeyID, env.R2SecretAccessKey, "")),
    awsconfig.WithHTTPClient(&http.Client{Timeout: 30 * time.Second}),
  )
  if err != nil {
    return nil, fmt.Errorf("load r2 config: %w", err)
  }

  client := s3.NewFromConfig(cfg, func(options *s3.Options) {
    options.UsePathStyle = true
    options.EndpointResolver = resolver
  })

  return &R2Store{bucket: env.R2BucketName, client: client}, nil
}

func (s *R2Store) PutObject(ctx context.Context, key string, contentType string, body io.Reader) error {
  _, err := s.client.PutObject(ctx, &s3.PutObjectInput{
    Bucket:      &s.bucket,
    Key:         &key,
    Body:        body,
    ContentType: &contentType,
  })
  if err != nil {
    return fmt.Errorf("put object %s: %w", key, err)
  }
  return nil
}

func (s *R2Store) DeleteObject(ctx context.Context, key string) error {
  _, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{
    Bucket: &s.bucket,
    Key:    &key,
  })
  if err != nil {
    return fmt.Errorf("delete object %s: %w", key, err)
  }
  return nil
}
