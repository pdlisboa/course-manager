# Aulas

App web para assistir videoaulas e acompanhar o progresso (geral, por módulo e por vídeo).
Roda em Docker e é configurado por variáveis de ambiente.

## Como organizar os arquivos

```
MeuCurso/
  01 - Introdução/
    01 - Boas-vindas.mp4
    01 - Boas-vindas.pdf     ← mesmo nome do vídeo = anexo da aula
    materiais.zip            ← sem vídeo correspondente = material do módulo
  02 - Básico/
    ...
```

- Cada **subpasta** é um **módulo**; cada **vídeo** (`.mp4`, `.webm`, `.m4v`, `.mov`) é uma **aula**.
- A ordem segue o nome (ordenação natural: "2" vem antes de "10"). Números no início são escondidos no título.
- PDFs abrem dentro do app; ZIPs e outros arquivos são baixados.

## Variáveis de ambiente

| Variável | Padrão | O que faz |
|---|---|---|
| `COURSES_DIR` | `/courses` | Pasta com os cursos dentro do container |
| `COURSE_NAME` | — | Se definida, `COURSES_DIR` é **um curso só** com esse nome. Se vazia, **cada subpasta** de `COURSES_DIR` vira um curso |
| `DATA_DIR` | `/data` | Onde o banco de progresso (`progress.db`) é salvo |
| `APP_PASSWORD` | — | Senha opcional. O navegador pede usuário/senha: o usuário pode ser qualquer um |
| `COMPLETE_THRESHOLD` | `0.9` | Fração assistida para a aula contar como concluída |
| `PORT` | `3000` | Porta do servidor |

## Subindo no Portainer

O Portainer precisa de uma imagem. Duas formas:

**A) Stack a partir de um repositório Git (mais simples)**
1. Coloque esta pasta num repositório Git (GitHub, Gitea etc.).
2. Portainer → *Stacks* → *Add stack* → *Repository*, aponte para o repositório e o arquivo `docker-compose.yml`.
3. Ajuste no compose (ou em *Environment variables*) o caminho do volume do curso e as variáveis.
4. *Deploy*. O Portainer faz o build da imagem no servidor.

**B) Build no servidor e stack pelo editor**
```bash
docker build -t aulas:latest .
```
Depois, em *Stacks → Add stack → Web editor*, cole o `docker-compose.yml` removendo a linha `build: .`.

### Volumes
- Monte a pasta do curso em `/courses` como somente leitura (`:ro`).
- `/data` guarda o progresso. Use um volume nomeado (como no compose de exemplo). Se usar uma pasta do servidor (bind mount), ela precisa ser gravável pelo usuário `1000` do container: `sudo chown 1000:1000 /caminho/data`.

### Vários cursos
Deixe `COURSE_NAME` vazio e monte a pasta que contém todos os cursos:
```yaml
volumes:
  - /srv/cursos:/courses:ro   # /srv/cursos/Curso A, /srv/cursos/Curso B ...
```

## Usando
- A tela do curso mostra o progresso geral (aulas concluídas e horas assistidas) e o de cada módulo.
- O vídeo salva a posição a cada 5 s e ao pausar/fechar; ao voltar, continua de onde parou.
- A aula é marcada como concluída ao passar de 90% (ou manualmente pelo botão).
- Adicionou vídeos na pasta? Clique em **⟳** no topo para reescanear.
- Atalhos: espaço/K pausar · J/L ±10s · N próxima · P anterior · F tela cheia · M concluir.

## Desenvolvimento

Precisa do Node.js 24+ (roda TypeScript direto, sem build).

```bash
npm install
COURSES_DIR=/caminho/do/curso DATA_DIR=./data npm run dev   # recarrega ao salvar
npm run typecheck                                           # checa os tipos
```

| Arquivo | Responsabilidade |
|---|---|
| `src/config.ts` | Lê as variáveis de ambiente |
| `src/scanner.ts` | Varre as pastas e monta curso → módulos → aulas |
| `src/db.ts` | Banco SQLite (progresso e cache de duração dos vídeos) |
| `src/server.ts` | Servidor Express: API, arquivos de mídia, senha |
| `public/` | Interface (HTML, CSS e JS puro) |
