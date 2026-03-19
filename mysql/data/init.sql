USE OruCa_DB;

CREATE TABLE users (
    student_ID VARCHAR(16) NOT NULL PRIMARY KEY,
    student_Name VARCHAR(64),
    student_token VARCHAR(64) NOT NULL
);

CREATE TABLE logs (
    student_ID VARCHAR(16) NOT NULL PRIMARY KEY,
    isInRoom BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_logs_users FOREIGN KEY (student_ID) REFERENCES users (student_ID) ON DELETE CASCADE
);

CREATE TABLE app_settings (
    id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
    slack_channel_id VARCHAR(64),
    slack_bot_token_encrypted TEXT,
    slack_bot_token_iv VARCHAR(64),
    slack_bot_token_auth_tag VARCHAR(64),
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO app_settings (id) VALUES (1)
ON DUPLICATE KEY UPDATE id = id;

CREATE VIEW student_token_view AS
SELECT u.student_ID, u.student_token
FROM users u
    JOIN logs l ON u.student_ID = l.student_ID;

CREATE VIEW student_log_view AS
SELECT l.student_ID, u.student_Name, l.isInRoom, l.updated_at
FROM logs l
    JOIN users u ON l.student_ID = u.student_ID;

CREATE VIEW student_name_view AS
SELECT l.student_ID, u.student_Name
FROM logs l
    JOIN users u ON l.student_ID = u.student_ID;
