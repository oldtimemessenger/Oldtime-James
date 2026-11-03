-- Retain each published response, including repeated answers to one question.
CREATE TABLE story_question_answers (
  story_id TEXT PRIMARY KEY NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES story_questions(id) ON DELETE CASCADE
);
CREATE INDEX story_question_answers_question ON story_question_answers(question_id);
CREATE INDEX story_questions_asker_notification ON story_questions(asker_id,created_at DESC);
INSERT INTO story_question_answers(story_id,question_id)
SELECT answer_story_id,id FROM story_questions WHERE answer_story_id IS NOT NULL;
