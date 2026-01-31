CREATE TABLE locations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  difficulty ENUM("E", "M", "H", "I") NOT NULL,
  xpos INT NOT NULL,
  ypos INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_indoor BOOLEAN DEFAULT 0,
  is_outdoor BOOLEAN DEFAULT 0,
  is_carpark BOOLEAN DEFAULT 0
);

CREATE TABLE sessions (
  sessionid BIGINT PRIMARY KEY,
  gamemode ENUM("S", "E") NOT NULL,
  difficulty ENUM("E", "M", "H", "I"),
  locationid INT,
  score INT DEFAULT 0,
  curr_round INT DEFAULT 1,
  is_custom BOOLEAN DEFAULT 0,
  custom_params JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (locationid) REFERENCES locations(id)
);

CREATE USER 'backend'@'%' IDENTIFIED BY 'super_secure_password';
GRANT SELECT, INSERT, UPDATE, EXECUTE, SHOW VIEW ON mguessr.* TO 'backend'@'%';
FLUSH PRIVILEGES;