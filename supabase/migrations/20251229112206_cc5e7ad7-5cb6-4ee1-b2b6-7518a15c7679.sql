UPDATE ai_service_settings 
SET 
  provider = 'MegaLLM',
  api_endpoint = 'https://ai.megallm.io/v1/chat/completions',
  model_name = 'qwen/qwen3-next-80b-a3b-instruct',
  api_key = (SELECT api_key FROM ai_service_settings WHERE service_name = 'text_generation'),
  test_status = NULL,
  test_message = NULL,
  test_last_run = NULL
WHERE service_name = 'ai_chat'