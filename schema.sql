DROP TABLE IF EXISTS verbs;
CREATE TABLE verbs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  base_word TEXT NOT NULL,
  past_tense TEXT NOT NULL,
  past_participle TEXT NOT NULL,
  definition TEXT,
  note TEXT
);

-- 创建唯一索引，如果 base_word 和 past_tense 相同，则视为同一条数据
CREATE UNIQUE INDEX IF NOT EXISTS idx_verbs_unique ON verbs(base_word, past_tense);
-- 初始化测试数据：Lie 的两种含义
-- INSERT INTO verbs (base_word, past_tense, past_participle, definition, note) VALUES 
-- ('lie', 'lay', 'lain', '躺; 位于', '不规则'),
-- ('lie', 'lied', 'lied', '撒谎', '规则'),
-- ('go', 'went', 'gone', '去', NULL);