#!/bin/bash

# Exit on error
set -e

# Deploy the function
echo "Deploying OpenAI Edge Function..."
supabase functions deploy openai-edge --no-verify-jwt

# Set environment variables
echo "Setting environment variables..."
supabase secrets set OPENAI_API_KEY="$OPENAI_API_KEY"

echo "Deployment complete!" 