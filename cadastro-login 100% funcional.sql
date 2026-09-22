CREATE DATABASE IF NOT EXISTS auth_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE auth_db;

CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    senha VARCHAR(255) NOT NULL,
    tipo VARCHAR(20) NOT NULL DEFAULT 'aluno',
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Se a tabela já existir sem a coluna tipo, execute a linha abaixo:
-- ALTER TABLE usuarios ADD COLUMN tipo VARCHAR(20) NOT NULL DEFAULT 'aluno' AFTER senha;


-- Inserindo um único usuário (senha: 123456)
INSERT INTO usuarios (nome, email, senha) 
VALUES ('João Silva', 'joao@email.com', '$2b$10$gNGL/4xKJw4A1D0Hqr/Q4O2gQ4sLUZNp2KXIQ9RgM/GWTqF5Tmg.K');

select * from usuarios;