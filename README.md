# MonGuessr

Monash University GeoGuessr clone. Guess campus locations from photos.

## Features

- **Standard Mode**: 5-round games (Easy/Medium/Hard/Impossible) like normal GeoGuessr.
- **Endless Mode**: Score is inverted and subtracts from health pool, survive as many rounds as possible.
- **Custom Mode**: Filter by difficulties and tags, in standard or endless with customisable rounds/hp and timer length.
- **Admin Panel**: Upload photos instantly to the server from your phone with difficulty, coordinates and tags.
- **Anti-cheat**: (For leaderboards coming soon) Server statefulness prevents altering points, difficulty or gamemode during the round.

## How to access Admin Panel
If you wish to host yourself, then you must build your own image catalouge through the admin panel.
Set a password with "PASS=super_secure_password" in .env then then put that password in your URL bar between the domain and /admin.html
For example, with the password above, access https://your.domain.com/super_secure_password/admin.html

## Local Setup

Rename several files to remove "SAMPLE" from the beginning. Any file with this prefix needs sensitive credentials in it which are not in the git repo.
Then simply run:
```bash
docker-compose up --build -d
```