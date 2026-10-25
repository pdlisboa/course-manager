# Course Manager

Web app for watching video lessons and tracking progress (overall, per module and per video).
Runs in Docker and is configured through environment variables. The interface is in Brazilian Portuguese.

## Organizing your files

```
MyCourse/
  01 - Introduction/
    01 - Welcome.mp4
    01 - Welcome.pdf         ← same name as the video = attached to that lesson
    materials.zip            ← no matching video = module material
  02 - Basics/
    ...
```

- Each **subfolder** is a **module**; each **video** (`.mp4`, `.webm`, `.m4v`, `.mov`) is a **lesson**.
- Order follows the file names (natural sort: "2" comes before "10"). Leading numbers are hidden from titles.
- PDFs open inside the app; ZIPs and other files are downloaded.

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `COURSES_DIR` | `/courses` | Folder with the courses inside the container |
| `COURSE_NAME` | — | If set, `COURSES_DIR` is **a single course** with this name. If empty, **each subfolder** of `COURSES_DIR` becomes a course |
| `DATA_DIR` | `/data` | Where the progress database (`progress.db`) is stored |
| `APP_PASSWORD` | — | Optional password. The browser asks for username/password; any username works |
| `COMPLETE_THRESHOLD` | `0.9` | Fraction watched for a lesson to count as completed |
| `PORT` | `3000` | Server port |

## Deploying with Portainer

Portainer needs an image. Two options:

**A) Stack from a Git repository (simplest)**
1. Push this folder to a Git repository (GitHub, Gitea, etc.).
2. Portainer → *Stacks* → *Add stack* → *Repository*, point it to the repository and the `docker-compose.yml` file.
3. Adjust the course volume path and the variables in the compose file (or under *Environment variables*).
4. *Deploy*. Portainer builds the image on the server.

**B) Build on the server and use the web editor**
```bash
docker build -t aulas:latest .
```
Then, under *Stacks → Add stack → Web editor*, paste the `docker-compose.yml` without the `build: .` line.

### Volumes
- Mount the course folder at `/courses` as read-only (`:ro`).
- `/data` stores the progress. Use a named volume (as in the example compose file). If you use a host folder (bind mount), it must be writable by the container's user `1000`: `sudo chown 1000:1000 /path/to/data`.

### Multiple courses
Leave `COURSE_NAME` empty and mount the folder that contains all courses:
```yaml
volumes:
  - /srv/courses:/courses:ro   # /srv/courses/Course A, /srv/courses/Course B ...
```

## Usage
- The course page shows overall progress (completed lessons and hours watched) and progress for each module.
- The video saves its position every 5 s and when paused/closed; when you come back, it resumes where you left off.
- A lesson is marked as completed after 90% is watched (or manually with the button).
- Added new videos to the folder? Click **⟳** at the top to rescan.
- Shortcuts: space/K pause · J/L ±10s · N next · P previous · F fullscreen · M mark as completed.

## Development

Requires Node.js 24+ (runs TypeScript directly, no build step).

```bash
npm install
COURSES_DIR=/path/to/course DATA_DIR=./data npm run dev   # reloads on save
npm run typecheck                                         # type checking
```

| File | Responsibility |
|---|---|
| `src/config.ts` | Reads the environment variables |
| `src/scanner.ts` | Scans the folders and builds course → modules → lessons |
| `src/db.ts` | SQLite database (progress and video duration cache) |
| `src/server.ts` | Express server: API, media files, password |
| `public/` | Interface (plain HTML, CSS and JS) |
