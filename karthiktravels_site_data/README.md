# Karthik Travels Scrape Archive

Source: https://karthiktravels.in/

This folder stores the public website content collected for the redesign step.

## Files

- `summary.json` - combined archive index with page metadata, contact details, package routes, image references, and notes.
- `packages.json` - deduplicated tour package routes from the source website.
- `images.json` - downloaded image inventory with original URLs and local file paths.
- `contact.json` - extracted phone, email, and address details.
- `pages/` - saved source HTML and text copies.
- `images/` - downloaded source website images.

## Scrape Notes

- 10 pages were saved.
- 55 unique images were downloaded.
- 34 unique tour package route entries were extracted.
- No prices were found on the source website; package entries include `price: null`.
- `contact.php` returned a `409 Conflict` to scripted fetches, but the same contact information was available in the footer of the other pages.
