-- Додаємо політику для видалення завдань
-- Тільки власник може видалити своє завдання
CREATE POLICY "Users can delete their own tasks"
  ON tasks
  FOR DELETE
  USING (auth.uid() = user_id);
