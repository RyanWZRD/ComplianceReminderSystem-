# Compliance Reminder System

A simple web app to track DBS expiry dates for people on your team.

## What it does

- Shows a table of people with their DBS expiry dates
- Highlights status: **Valid**, **Expiring Soon** (within 30 days), or **Expired**
- Lets you add new people using a simple form
- Uses fake sample data — no database or login required

## How to run

1. Open `index.html` in your web browser (double-click the file, or right-click → Open with → your browser).
2. That's it — no install or server needed.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Page structure and layout |
| `styles.css` | Visual styling |
| `app.js` | Data and behaviour (fake data, form, table) |

## Customising the fake data

Edit the `people` array at the top of `app.js` to change the sample names and dates.
