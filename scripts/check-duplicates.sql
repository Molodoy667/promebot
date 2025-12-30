-- Перевірка дублікатів в AI постах

-- 1. Знайти пости з однаковим контентом
SELECT 
  content,
  COUNT(*) as duplicate_count,
  array_agg(id) as post_ids,
  array_agg(created_at) as created_dates
FROM ai_generated_posts
GROUP BY content
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 2. Знайти схожі пости (перші 100 символів)
SELECT 
  LEFT(content, 100) as content_preview,
  COUNT(*) as similar_count,
  array_agg(id) as post_ids
FROM ai_generated_posts
GROUP BY LEFT(content, 100)
HAVING COUNT(*) > 1
ORDER BY similar_count DESC;

-- 3. Статистика по категоріям
SELECT 
  category,
  COUNT(*) as total_posts,
  COUNT(DISTINCT LEFT(content, 50)) as unique_starts,
  ROUND(COUNT(DISTINCT LEFT(content, 50))::numeric / COUNT(*)::numeric * 100, 2) as uniqueness_percent
FROM ai_generated_posts
GROUP BY category
ORDER BY total_posts DESC;

-- 4. Останні 10 постів
SELECT 
  id,
  category,
  LEFT(content, 80) as preview,
  status,
  created_at
FROM ai_generated_posts
ORDER BY created_at DESC
LIMIT 10;
