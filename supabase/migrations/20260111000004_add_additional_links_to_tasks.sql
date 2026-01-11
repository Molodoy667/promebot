-- Додаємо поле для додаткових посилань (масив до 3 посилань)
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS additional_links TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Додаємо constraint для обмеження кількості посилань
ALTER TABLE tasks
ADD CONSTRAINT check_additional_links_count 
CHECK (array_length(additional_links, 1) IS NULL OR array_length(additional_links, 1) <= 3);
