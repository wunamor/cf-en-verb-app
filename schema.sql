DROP TABLE IF EXISTS verbs;
CREATE TABLE verbs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  base_word TEXT NOT NULL,
  past_tense TEXT NOT NULL,
  past_participle TEXT NOT NULL,
  definition TEXT,
  note TEXT
);
-- 初始化测试数据：Lie 的两种含义
INSERT INTO verbs (base_word, past_tense, past_participle, definition, note) VALUES 
('lie', 'lay', 'lain', '躺; 位于', '不规则'),
('lie', 'lied', 'lied', '撒谎', '规则'),
('go', 'went', 'gone', '去', NULL);