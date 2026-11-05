const COLORS = [
  ['#1DB954', '#134E2B'],
  ['#E13300', '#6B1A00'],
  ['#509BF5', '#264E86'],
  ['#F59B23', '#7A4B12'],
  ['#E8115B', '#75082E'],
  ['#1E3264', '#0F1932'],
  ['#8D67AB', '#463355'],
  ['#A56752', '#523329'],
  ['#503750', '#281B28'],
  ['#E91429', '#750A14'],
  ['#148A08', '#0A4504'],
  ['#0D73EC', '#063976'],
  ['#E1118B', '#710845'],
  ['#B02897', '#58144B'],
  ['#477D95', '#233F4A'],
  ['#DC148C', '#6E0A46'],
  ['#1E3264', '#0F1932'],
  ['#8C1932', '#460C19'],
];

function hashStr(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function generatePlaceholderSVG(text, size = 300) {
  const idx = hashStr(text) % COLORS.length;
  const [c1, c2] = COLORS[idx];
  const initials = (text || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const icon = text.length > 3 ? 'M' : '♪';

  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:${c1}"/>
        <stop offset="100%" style="stop-color:${c2}"/>
      </linearGradient>
    </defs>
    <rect width="${size}" height="${size}" fill="url(#g)" rx="4"/>
    <text x="50%" y="45%" font-family="Arial,sans-serif" font-size="${size * 0.3}" font-weight="bold" fill="rgba(255,255,255,0.9)" text-anchor="middle" dominant-baseline="middle">${initials}</text>
    <text x="50%" y="75%" font-family="Arial,sans-serif" font-size="${size * 0.12}" fill="rgba(255,255,255,0.4)" text-anchor="middle" dominant-baseline="middle">♫</text>
  </svg>`)}`;
}

function getSongCover(song) {
  if (song.cover) return song.cover;
  return generatePlaceholderSVG(song.title || song.name || 'Song');
}

function getAlbumCover(album) {
  if (album.cover) return album.cover;
  return generatePlaceholderSVG(album.title || album.name || 'Album');
}

function getArtistPhoto(artist) {
  if (artist.cover || artist.photo) return artist.cover || artist.photo;
  return generatePlaceholderSVG(artist.name || 'Artist');
}

function getPlaylistCover(playlist) {
  if (playlist.cover) return playlist.cover;
  return generatePlaceholderSVG(playlist.title || playlist.name || 'Playlist');
}

function getUserAvatar(user) {
  if (user.avatar) return user.avatar;
  const name = user.name || user.userName || 'User';
  return generatePlaceholderSVG(name, 128);
}

export {
  generatePlaceholderSVG,
  getSongCover,
  getAlbumCover,
  getArtistPhoto,
  getPlaylistCover,
  getUserAvatar,
};
