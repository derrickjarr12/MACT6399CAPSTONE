CREATE DATABASE IF NOT EXISTS pnf_aims;

CREATE USER IF NOT EXISTS 'pnf_app'@'127.0.0.1' IDENTIFIED BY 'BrooklynBowie11203@';
ALTER USER 'pnf_app'@'127.0.0.1' IDENTIFIED BY 'BrooklynBowie11203@';

GRANT ALL PRIVILEGES ON pnf_aims.* TO 'pnf_app'@'127.0.0.1';
FLUSH PRIVILEGES;

SELECT user, host FROM mysql.user WHERE user IN ('pnf_app', 'root');