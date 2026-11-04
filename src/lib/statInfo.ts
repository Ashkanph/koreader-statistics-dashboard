// Explanations shown in the "?" panel of stat tiles, shared by the dashboard and the book page.

export const READ_BOOKS_INFO =
  "In this app, a book counts as fully read when 95% of pages have reading time recorded. KOReader keeps its own “finished” status in each book's metadata file, which isn't part of this database."

export const PAGES_INFO =
  'Page counts come from KOReader, not from the printed book. They depend on your screen size, font, font size, margins and the file format, so the same book can have a different number of pages on another device or after you change the font.'

export const HIGHLIGHTS_INFO =
  "The statistics database only stores how many highlights each book had the last time KOReader saved its statistics. The highlights themselves are kept in each book's metadata file, which this app doesn't have access to."

export const NOTES_INFO =
  "The statistics database only stores how many notes each book had the last time KOReader saved its statistics. The notes themselves are kept in each book's metadata file, which this app doesn't have access to."
