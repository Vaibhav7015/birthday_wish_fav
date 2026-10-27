# Birthday Surprise Website

A complete Express.js and vanilla JavaScript birthday experience with persistent local message and photo metadata.

## Requirements

- Node.js 18 or newer
- npm
- A GitHub account
- A Netlify account

## Local setup

```bash
npm install
npm start
```

Open `http://localhost:3000`.

For development with automatic restarts:

```bash
npm run dev
```

## Netlify deployment

This project has a Netlify-friendly serverless API in `netlify/functions/server.js` and a `netlify.toml` configuration file.

1. Push the project to a GitHub repository.
2. Log in to Netlify and click "Add new site" → "Import an existing project".
3. Choose GitHub and authenticate with your GitHub account.
4. Select the repository and keep the defaults.
5. Netlify will use the project root and deploy the `public` folder with the functions under `netlify/functions`.
6. Set the environment variable `MESSAGE_ADMIN_TOKEN` in Netlify if you want the admin-protected updates and deletions.

If you want the local Node server behavior as well, continue using `npm start` and the Express app in `server.js`.

## Personalization

- Name, letter heading, and letter body: edit `data/message.json` or call `PUT /api/message`.
- Add music at `public/audio/birthday.mp3`. The player remains usable and reports a friendly message if the file is missing.
- Add gallery photos through the website upload form. No random external photos are used.
- Set `PORT` and optional `MESSAGE_ADMIN_TOKEN` in `.env` using `.env.example` as a guide.

## Persistence

Uploaded files persist in `uploads/`, while photo and message metadata persist in `data/photos.json` and `data/message.json`. Deployment requires persistent disk storage if files must survive container or host restarts.

## API

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Service health |
| GET | `/api/message` | Current birthday message |
| PUT | `/api/message` | Update name and message |
| GET | `/api/photos` | Photo metadata |
| POST | `/api/photos` | Upload one JPG, JPEG, PNG, or WebP photo |
| DELETE | `/api/photos/:id` | Delete one photo |

Photo uploads are limited to 5 MB. When `MESSAGE_ADMIN_TOKEN` is configured, message updates and photo deletion require an `x-admin-token` header matching that token.

## Features

Animated welcome and surprise reveal, clickable balloons, photo preview/upload/gallery/lightbox/delete, typed birthday letter, cake candles and wish controls, gift reveal, confetti particles, music controls, replay/full-screen controls, reduced-motion support, and responsive layouts.

## Remaining limitations

- There is no account system or session-based authorization. The optional shared token is suitable for a small private deployment, not a public multi-user app.
- A default MP3 is not bundled; supply properly licensed audio yourself.
- This implementation does not add a server-hosted countdown or wishes wall.
