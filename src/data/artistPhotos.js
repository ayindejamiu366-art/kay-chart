// Offline/bundled artist portraits. Stylized local SVGs served from /artists/*
// so the app never depends on an external CDN (which is blocked offline).
// Keyed by normalized artist name.
const MAP = {
  'anirudh ravichander': '/artists/a1.svg',
  'yuvan shankar raja': '/artists/a2.svg',
  'ilaiyaraaja': '/artists/a3.svg',
  'kavinsky': '/artists/a4.svg',
  'the weeknd': '/artists/a5.svg',
  'wizkid': '/artists/a6.svg',
  'burna boy': '/artists/a7.svg',
  'davido': '/artists/a8.svg',
  'rema': '/artists/a9.svg',
  'asake': '/artists/a10.svg',
  'ayra starr': '/artists/a11.svg',
  'central cee': '/artists/a12.svg',
  'dave': '/artists/a13.svg',
  'stormzy': '/artists/a14.svg',
  'skepta': '/artists/a15.svg',
  'j hus': '/artists/a16.svg',
};

export function getBundledArtistPhoto(name) {
  if (!name) return null;
  return MAP[name.trim().toLowerCase()] || null;
}
