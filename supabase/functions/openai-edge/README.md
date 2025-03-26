# OpenAI Edge Function

This Edge Function provides a serverless API for OpenAI operations, supporting both embeddings generation and streaming chat completions.

## Features

- Embeddings generation with text-embedding-3-small model
- Streaming chat completions with GPT-4 Turbo
- Built-in error handling and retries
- Request monitoring and metrics
- CORS support
- Rate limiting protection

## Environment Variables

- `OPENAI_API_KEY`: Your OpenAI API key (required)

## API Endpoints

### Generate Embeddings

```http
POST /functions/v1/openai-edge
Content-Type: application/json

{
  "input": "Your text here",
  "model": "text-embedding-3-small"
}
```

### Stream Chat Completions

```http
POST /functions/v1/openai-edge
Content-Type: application/json

{
  "input": "Your prompt here",
  "stream": true
}
```

## Development

1. Install Supabase CLI
2. Set up environment variables in `.env.local`
3. Run locally:
   ```bash
   supabase functions serve openai-edge --env-file ./supabase/.env.local
   ```

## Deployment

1. Make sure you have Supabase CLI installed and configured
2. Run the deployment script:
   ```bash
   ./deploy.sh
   ```

## Error Handling

The function includes comprehensive error handling for:
- Rate limiting
- Network errors
- API errors
- Invalid input

## Monitoring

Request metrics are logged for:
- Request duration
- Token usage
- Success/failure status
- Error details

## Security

- JWT verification can be enabled by removing `--no-verify-jwt` from deployment
- CORS headers are configurable in `_shared/cors.ts`
- Rate limiting is handled via OpenAI's built-in limits 