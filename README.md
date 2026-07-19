# Wedding seating finder

A mobile-first, static seating finder for GitHub Pages. No build step or backend is required.

## Edit the guest list

Update `guests.csv`. Keep these four headers:

```csv
first_name,last_name,aliases,table
Charlotte,Li,"Charlie|李夏洛",2
```

- Separate multiple aliases with `|`.
- Quote a field if it contains a comma.
- Search is case- and accent-insensitive and tolerates small spelling mistakes.

Because the CSV is shipped with the public site, do not include private guest details beyond what you are comfortable publishing.

## Preview locally

From this folder, run:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000`. Opening `index.html` directly will not load the CSV in most browsers.

## Publish with GitHub Pages

Push this folder to a repository, then in **Settings → Pages** choose **Deploy from a branch** and select the branch/folder containing these files.

## Customize

- Couple initials, date, and venue: `index.html`
- Colours and layout: the variables at the top of `styles.css`
- Wording/translations: `translations` at the top of `script.js`
- Later, replace the table-number area in `index.html` with a pet portrait image URL stored in a new CSV column and populated in `renderCard()`.

The envelope uses the free **Allura** and **Cormorant Garamond** families from Google Fonts. If you want the page to work fully offline, download and self-host those font files or replace the font links in `index.html`.
