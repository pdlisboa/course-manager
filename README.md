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

The `docker-compose.yml` reads everything from the stack's environment variables, so you don't need to edit it:

| Stack variable | Default | Description |
|---|---|---|
| `COURSES_PATH` | — (required) | Course folder **on the Docker host**, e.g. `/mnt/hd/courses`. Mounted read-only at `/courses` |
| `COURSE_NAME` | — | Single course name; empty = each subfolder of `COURSES_PATH` is a course |
| `APP_PASSWORD` | — | Optional password |
| `COMPLETE_THRESHOLD` | `0.9` | Fraction watched to complete a lesson |
| `HOST_PORT` | `3000` | Port exposed on the host |

1. Portainer → *Stacks* → *Add stack* → *Repository*, point it to this repository and the `docker-compose.yml` file.
2. Under *Environment variables*, add `COURSES_PATH` (and any of the others you need).
3. *Deploy*. Portainer builds the image on the server.

Progress is stored in the named volume `aulas-data` (mounted at `/data`), so it survives redeploys.

### Single course vs. multiple courses
- `COURSES_PATH=/mnt/hd/courses/My Course` + `COURSE_NAME=My Course` → one course whose subfolders are modules.
- `COURSES_PATH=/mnt/hd/courses` + empty `COURSE_NAME` → `/mnt/hd/courses/Course A`, `/mnt/hd/courses/Course B`… each becomes a course.

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
