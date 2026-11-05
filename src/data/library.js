const ALBUM_COVERS = [
  "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop&q=80",
  "https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1483412033650-1015ddeb83d1?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1571330735066-03aaa9429d89?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1484755560615-a4c64e778571?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1499417267104-5c0af16e9b0a?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1482442120256-9c03866de390?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1499417267104-5c0af16e9b0a?w=300&h=300&fit=crop&q=80",
  "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1524650359799-842906ca1c06?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=300&h=300&fit=crop",
];

const ARTIST_PHOTOS = [
  "/artists/a1.svg",   // Anirudh Ravichander
  "/artists/a2.svg",   // Yuvan Shankar Raja
  "/artists/a3.svg",   // Ilaiyaraaja
  "/artists/a4.svg",   // Kavinsky
  "/artists/a5.svg",   // The Weeknd
  "/artists/a6.svg",   // Wizkid
  "/artists/a7.svg",   // Burna Boy
  "/artists/a8.svg",   // Davido
  "/artists/a9.svg",   // Rema
  "/artists/a10.svg",  // Asake
  "/artists/a11.svg",  // Ayra Starr
  "/artists/a12.svg",  // Central Cee
  "/artists/a13.svg",  // Dave
  "/artists/a14.svg",  // Stormzy
  "/artists/a15.svg",  // Skepta
];

const LYRICS_DATA = {};

export const GENRES = [
  "Pop", "Hip-Hop", "EDM", "Tamil Hits", "Indie", "Rock",
  "R&B", "Classical", "Bollywood", "Jazz", "Chill Vibe",
  "Workout Energy", "Focus & Study", "Rainy Days", "Romantic Nights", "Retro Classics",
  "Afrobeats", "Amapiano", "UK Rap"
];

export const songs = [
   { id: "s1", title: "Ordinary Person", artistId: "a1", artistName: "Anirudh Ravichander", albumId: "al1", albumName: "Leo OST", duration: 221, cover: ALBUM_COVERS[0], mood: "uplifting", genre: "Tamil Hits" },
   { id: "s2", title: "Arabic Kuthu", artistId: "a1", artistName: "Anirudh Ravichander", albumId: "al2", albumName: "Beast OST", duration: 204, cover: ALBUM_COVERS[1], mood: "energy", genre: "Tamil Hits" },
   { id: "s3", title: "Lokiverse 2.0", artistId: "a1", artistName: "Anirudh Ravichander", albumId: "al1", albumName: "Leo OST", duration: 186, cover: ALBUM_COVERS[2], mood: "epic", genre: "Tamil Hits" },
   { id: "s4", title: "Bloody Sweet", artistId: "a1", artistName: "Anirudh Ravichander", albumId: "al1", albumName: "Leo OST", duration: 198, cover: ALBUM_COVERS[3], mood: "intense", genre: "Tamil Hits" },
   { id: "s5", title: "Naa Ready", artistId: "a1", artistName: "Anirudh Ravichander", albumId: "al1", albumName: "Leo OST", duration: 215, cover: ALBUM_COVERS[4], mood: "uplifting", genre: "Tamil Hits" },
   { id: "s6", title: "Badass", artistId: "a1", artistName: "Anirudh Ravichander", albumId: "al1", albumName: "Leo OST", duration: 174, cover: ALBUM_COVERS[5], mood: "epic", genre: "Tamil Hits" },
   { id: "s7", title: "Hukum", artistId: "a1", artistName: "Anirudh Ravichander", albumId: "al3", albumName: "Jailer OST", duration: 192, cover: ALBUM_COVERS[6], mood: "energy", genre: "Tamil Hits" },
   { id: "s8", title: "Thunder Song", artistId: "a2", artistName: "Yuvan Shankar Raja", albumId: "al4", albumName: "Vetri Vizha", duration: 240, cover: ALBUM_COVERS[7], mood: "epic", genre: "Tamil Hits" },
   { id: "s9", title: "Kanja Poovu Kannala", artistId: "a2", artistName: "Yuvan Shankar Raja", albumId: "al4", albumName: "Vetri Vizha", duration: 218, cover: ALBUM_COVERS[8], mood: "romantic", genre: "Tamil Hits" },
   { id: "s10", title: "Vantha Edam", artistId: "a3", artistName: "Ilaiyaraaja", albumId: "al5", albumName: "Thalapathi", duration: 305, cover: ALBUM_COVERS[9], mood: "uplifting", genre: "Classical" },
   { id: "s11", title: "Nightcall", artistId: "a4", artistName: "Kavinsky", albumId: "al6", albumName: "OutRun", duration: 184, cover: ALBUM_COVERS[0], mood: "chill", genre: "EDM" },
   { id: "s12", title: "Blinding Lights", artistId: "a5", artistName: "The Weeknd", albumId: "al7", albumName: "After Hours", duration: 200, cover: ALBUM_COVERS[1], mood: "energy", genre: "Pop" },
   { id: "s13", title: "Starboy", artistId: "a5", artistName: "The Weeknd", albumId: "al8", albumName: "Starboy", duration: 230, cover: ALBUM_COVERS[2], mood: "chill", genre: "Pop" },
   { id: "s14", title: "Shape of You", artistId: "a3", artistName: "Ilaiyaraaja", albumId: "al5", albumName: "Thalapathi", duration: 233, cover: ALBUM_COVERS[3], mood: "romantic", genre: "Pop" },
   { id: "s15", title: "Meyaadha Maan", artistId: "a2", artistName: "Yuvan Shankar Raja", albumId: "al4", albumName: "Vetri Vizha", duration: 260, cover: ALBUM_COVERS[4], mood: "romantic", genre: "Tamil Hits" },
   { id: "s16", title: "Peace of Mind", artistId: "a4", artistName: "Kavinsky", albumId: "al6", albumName: "OutRun", duration: 270, cover: ALBUM_COVERS[5], mood: "chill", genre: "Chill Vibe" },
   { id: "s17", title: "Midnight Run", artistId: "a4", artistName: "Kavinsky", albumId: "al6", albumName: "OutRun", duration: 198, cover: ALBUM_COVERS[6], mood: "energy", genre: "EDM" },
   { id: "s18", title: "Perfect Strangers", artistId: "a5", artistName: "The Weeknd", albumId: "al7", albumName: "After Hours", duration: 245, cover: ALBUM_COVERS[7], mood: "chill", genre: "Pop" },
   { id: "s19", title: "Save Your Tears", artistId: "a5", artistName: "The Weeknd", albumId: "al7", albumName: "After Hours", duration: 215, cover: ALBUM_COVERS[8], mood: "romantic", genre: "Pop" },
   { id: "s20", title: "Raasathi", artistId: "a3", artistName: "Ilaiyaraaja", albumId: "al5", albumName: "Thalapathi", duration: 288, cover: ALBUM_COVERS[9], mood: "romantic", genre: "Classical" },
   // ---- Nigerian Artists ----
   { id: "s21", title: "Essence (feat. Tems)", artistId: "a6", artistName: "Wizkid", albumId: "al9", albumName: "Made in Lagos", duration: 248, cover: ALBUM_COVERS[10], mood: "chill", genre: "Afrobeats" },
   { id: "s22", title: "Ojuelegba", artistId: "a6", artistName: "Wizkid", albumId: "al10", albumName: "Ayo", duration: 218, cover: ALBUM_COVERS[11], mood: "uplifting", genre: "Afrobeats" },
   { id: "s23", title: "Come Closer (feat. Drake)", artistId: "a6", artistName: "Wizkid", albumId: "al10", albumName: "Ayo", duration: 211, cover: ALBUM_COVERS[12], mood: "energy", genre: "Afrobeats" },
   { id: "s24", title: "Joro", artistId: "a6", artistName: "Wizkid", albumId: "al9", albumName: "Made in Lagos", duration: 201, cover: ALBUM_COVERS[1], mood: "romantic", genre: "Afrobeats" },
   { id: "s25", title: "Last Last", artistId: "a7", artistName: "Burna Boy", albumId: "al11", albumName: "Love, Damini", duration: 172, cover: ALBUM_COVERS[13], mood: "heavy", genre: "Afrobeats" },
   { id: "s26", title: "On the Low", artistId: "a7", artistName: "Burna Boy", albumId: "al12", albumName: "African Giant", duration: 178, cover: ALBUM_COVERS[14], mood: "chill", genre: "Afrobeats" },
   { id: "s27", title: "Ye", artistId: "a7", artistName: "Burna Boy", albumId: "al12", albumName: "African Giant", duration: 213, cover: ALBUM_COVERS[6], mood: "energy", genre: "Afrobeats" },
   { id: "s28", title: "City Boys", artistId: "a7", artistName: "Burna Boy", albumId: "al13", albumName: "I Told Them...", duration: 203, cover: ALBUM_COVERS[15], mood: "energy", genre: "Afrobeats" },
   { id: "s29", title: "Kilometre", artistId: "a7", artistName: "Burna Boy", albumId: "al14", albumName: "Twice as Tall", duration: 175, cover: ALBUM_COVERS[16], mood: "workout", genre: "Afrobeats" },
   { id: "s30", title: "Fall", artistId: "a8", artistName: "Davido", albumId: "al15", albumName: "A Good Time", duration: 180, cover: ALBUM_COVERS[17], mood: "uplifting", genre: "Afrobeats" },
   { id: "s31", title: "If", artistId: "a8", artistName: "Davido", albumId: "al16", albumName: "A Good Time (Single)", duration: 201, cover: ALBUM_COVERS[2], mood: "romantic", genre: "Afrobeats" },
   { id: "s32", title: "Unavailable (feat. Musa Keys)", artistId: "a8", artistName: "Davido", albumId: "al15", albumName: "A Good Time", duration: 193, cover: ALBUM_COVERS[3], mood: "energy", genre: "Amapiano" },
   { id: "s33", title: "Calm Down (feat. Selena Gomez)", artistId: "a9", artistName: "Rema", albumId: "al17", albumName: "Rave & Roses", duration: 239, cover: ALBUM_COVERS[18], mood: "chill", genre: "Afrobeats" },
   { id: "s34", title: "Dumebi", artistId: "a9", artistName: "Rema", albumId: "al17", albumName: "Rave & Roses", duration: 195, cover: ALBUM_COVERS[19], mood: "energy", genre: "Afrobeats" },
   { id: "s35", title: "Lonely at the Top", artistId: "a10", artistName: "Asake", albumId: "al18", albumName: "Work of Art", duration: 170, cover: ALBUM_COVERS[0], mood: "heavy", genre: "Amapiano" },
   { id: "s36", title: "Terminator", artistId: "a10", artistName: "Asake", albumId: "al18", albumName: "Work of Art", duration: 165, cover: ALBUM_COVERS[1], mood: "energy", genre: "Amapiano" },
   { id: "s37", title: "Rush", artistId: "a11", artistName: "Ayra Starr", albumId: "al19", albumName: "19 & Dangerous", duration: 204, cover: ALBUM_COVERS[2], mood: "energy", genre: "Afrobeats" },
   { id: "s38", title: "Bloody Samaritan", artistId: "a11", artistName: "Ayra Starr", albumId: "al19", albumName: "19 & Dangerous", duration: 187, cover: ALBUM_COVERS[3], mood: "heavy", genre: "Afrobeats" },
   // ---- UK Artists ----
   { id: "s39", title: "Sprinter (feat. Dave)", artistId: "a12", artistName: "Central Cee", albumId: "al20", albumName: "Sprinter (Single)", duration: 229, cover: ALBUM_COVERS[4], mood: "energy", genre: "UK Rap" },
   { id: "s40", title: "Doja", artistId: "a12", artistName: "Central Cee", albumId: "al21", albumName: "23", duration: 200, cover: ALBUM_COVERS[5], mood: "chill", genre: "UK Rap" },
   { id: "s41", title: "Obsessed With You", artistId: "a12", artistName: "Central Cee", albumId: "al21", albumName: "23", duration: 168, cover: ALBUM_COVERS[6], mood: "romantic", genre: "UK Rap" },
   { id: "s42", title: "Starlight", artistId: "a13", artistName: "Dave", albumId: "al22", albumName: "We're All Alone in This Together", duration: 211, cover: ALBUM_COVERS[7], mood: "uplifting", genre: "UK Rap" },
   { id: "s43", title: "Location (feat. Burna Boy)", artistId: "a13", artistName: "Dave", albumId: "al23", albumName: "Psychodrama", duration: 236, cover: ALBUM_COVERS[8], mood: "chill", genre: "UK Rap" },
   { id: "s44", title: "Clash (feat. Stormzy)", artistId: "a13", artistName: "Dave", albumId: "al22", albumName: "We're All Alone in This Together", duration: 251, cover: ALBUM_COVERS[9], mood: "energy", genre: "UK Rap" },
   { id: "s45", title: "Vossi Bop", artistId: "a14", artistName: "Stormzy", albumId: "al24", albumName: "Heavy Is the Head", duration: 196, cover: ALBUM_COVERS[10], mood: "energy", genre: "UK Rap" },
   { id: "s46", title: "Big For Your Boots", artistId: "a14", artistName: "Stormzy", albumId: "al25", albumName: "Gang Signs & Prayer", duration: 208, cover: ALBUM_COVERS[11], mood: "heavy", genre: "UK Rap" },
   { id: "s47", title: "Shutdown", artistId: "a15", artistName: "Skepta", albumId: "al26", albumName: "Konnichiwa", duration: 189, cover: ALBUM_COVERS[12], mood: "energy", genre: "UK Rap" },
   { id: "s48", title: "Praise the Lord (Da Shine)", artistId: "a15", artistName: "Skepta", albumId: "al26", albumName: "Konnichiwa", duration: 205, cover: ALBUM_COVERS[13], mood: "chill", genre: "UK Rap" },
   { id: "s49", title: "Who Told You (feat. Drake)", artistId: "a16", artistName: "J Hus", albumId: "al27", albumName: "Beautiful and Brutal Yard", duration: 204, cover: ALBUM_COVERS[14], mood: "energy", genre: "UK Rap" },
   { id: "s50", title: "Sability", artistId: "a11", artistName: "Ayra Starr", albumId: "al19", albumName: "19 & Dangerous", duration: 193, cover: ALBUM_COVERS[15], mood: "energy", genre: "Afrobeats" },
];

export const artists = [
  { id: "a1", name: "Anirudh Ravichander", listeners: 0, photo: ARTIST_PHOTOS[0], genres: ["Tamil Hits", "Pop"], verified: true },
  { id: "a2", name: "Yuvan Shankar Raja", listeners: 0, photo: ARTIST_PHOTOS[1], genres: ["Tamil Hits", "Rock"], verified: true },
  { id: "a3", name: "Ilaiyaraaja", listeners: 0, photo: ARTIST_PHOTOS[2], genres: ["Classical", "Tamil Hits"], verified: true },
  { id: "a4", name: "Kavinsky", listeners: 0, photo: ARTIST_PHOTOS[3], genres: ["EDM", "Chill Vibe"], verified: true },
  { id: "a5", name: "The Weeknd", listeners: 0, photo: ARTIST_PHOTOS[4], genres: ["Pop", "R&B"], verified: true },
  { id: "a6", name: "Wizkid", listeners: 0, photo: ARTIST_PHOTOS[5], genres: ["Afrobeats", "R&B"], verified: true },
  { id: "a7", name: "Burna Boy", listeners: 0, photo: ARTIST_PHOTOS[6], genres: ["Afrobeats", "Reggae", "Dancehall"], verified: true },
  { id: "a8", name: "Davido", listeners: 0, photo: ARTIST_PHOTOS[7], genres: ["Afrobeats", "Amapiano"], verified: true },
  { id: "a9", name: "Rema", listeners: 0, photo: ARTIST_PHOTOS[8], genres: ["Afrobeats", "R&B"], verified: true },
  { id: "a10", name: "Asake", listeners: 0, photo: ARTIST_PHOTOS[9], genres: ["Amapiano", "Afrobeats"], verified: true },
  { id: "a11", name: "Ayra Starr", listeners: 0, photo: ARTIST_PHOTOS[10], genres: ["Afrobeats", "R&B"], verified: true },
  { id: "a12", name: "Central Cee", listeners: 0, photo: ARTIST_PHOTOS[11], genres: ["UK Rap", "Drill"], verified: true },
  { id: "a13", name: "Dave", listeners: 0, photo: ARTIST_PHOTOS[12], genres: ["UK Rap", "R&B"], verified: true },
  { id: "a14", name: "Stormzy", listeners: 0, photo: ARTIST_PHOTOS[13], genres: ["UK Rap", "Grime"], verified: true },
  { id: "a15", name: "Skepta", listeners: 0, photo: ARTIST_PHOTOS[14], genres: ["UK Rap", "Grime"], verified: true },
  { id: "a16", name: "J Hus", listeners: 0, photo: "/artists/a16.svg", genres: ["UK Rap", "Afroswing"], verified: true },
];

export const albums = [
  { id: "al1", title: "Leo (Original Motion Picture Soundtrack)", artistId: "a1", artistName: "Anirudh Ravichander", year: 2023, cover: ALBUM_COVERS[0], songIds: ["s1", "s3", "s4", "s5", "s6"], totalSongs: 8, totalDuration: "28 mins" },
  { id: "al2", title: "Beast OST", artistId: "a1", artistName: "Anirudh Ravichander", year: 2022, cover: ALBUM_COVERS[1], songIds: ["s2"], totalSongs: 6, totalDuration: "24 mins" },
  { id: "al3", title: "Jailer OST", artistId: "a1", artistName: "Anirudh Ravichander", year: 2023, cover: ALBUM_COVERS[6], songIds: ["s7"], totalSongs: 7, totalDuration: "26 mins" },
  { id: "al4", title: "Vetri Vizha", artistId: "a2", artistName: "Yuvan Shankar Raja", year: 2022, cover: ALBUM_COVERS[7], songIds: ["s8", "s9", "s15"], totalSongs: 5, totalDuration: "22 mins" },
  { id: "al5", title: "Thalapathi", artistId: "a3", artistName: "Ilaiyaraaja", year: 2021, cover: ALBUM_COVERS[9], songIds: ["s10", "s14", "s20"], totalSongs: 6, totalDuration: "30 mins" },
  { id: "al6", title: "OutRun", artistId: "a4", artistName: "Kavinsky", year: 2022, cover: ALBUM_COVERS[5], songIds: ["s11", "s16", "s17"], totalSongs: 4, totalDuration: "18 mins" },
  { id: "al7", title: "After Hours", artistId: "a5", artistName: "The Weeknd", year: 2023, cover: ALBUM_COVERS[1], songIds: ["s12", "s18", "s19"], totalSongs: 8, totalDuration: "32 mins" },
  { id: "al8", title: "Starboy", artistId: "a5", artistName: "The Weeknd", year: 2022, cover: ALBUM_COVERS[2], songIds: ["s13"], totalSongs: 6, totalDuration: "24 mins" },
  { id: "al9", title: "Made in Lagos", artistId: "a6", artistName: "Wizkid", year: 2020, cover: ALBUM_COVERS[10], songIds: ["s21", "s24"], totalSongs: 14, totalDuration: "50 mins" },
  { id: "al10", title: "Ayo (Deluxe)", artistId: "a6", artistName: "Wizkid", year: 2015, cover: ALBUM_COVERS[11], songIds: ["s22", "s23"], totalSongs: 16, totalDuration: "58 mins" },
  { id: "al11", title: "Love, Damini", artistId: "a7", artistName: "Burna Boy", year: 2022, cover: ALBUM_COVERS[13], songIds: ["s25"], totalSongs: 19, totalDuration: "70 mins" },
  { id: "al12", title: "African Giant", artistId: "a7", artistName: "Burna Boy", year: 2019, cover: ALBUM_COVERS[14], songIds: ["s26", "s27"], totalSongs: 15, totalDuration: "55 mins" },
  { id: "al13", title: "I Told Them...", artistId: "a7", artistName: "Burna Boy", year: 2023, cover: ALBUM_COVERS[15], songIds: ["s28"], totalSongs: 12, totalDuration: "45 mins" },
  { id: "al14", title: "Twice as Tall", artistId: "a7", artistName: "Burna Boy", year: 2020, cover: ALBUM_COVERS[16], songIds: ["s29"], totalSongs: 16, totalDuration: "60 mins" },
  { id: "al15", title: "A Good Time", artistId: "a8", artistName: "Davido", year: 2019, cover: ALBUM_COVERS[17], songIds: ["s30", "s32"], totalSongs: 17, totalDuration: "62 mins" },
  { id: "al16", title: "A Good Time (If)", artistId: "a8", artistName: "Davido", year: 2019, cover: ALBUM_COVERS[2], songIds: ["s31"], totalSongs: 1, totalDuration: "3 mins" },
  { id: "al17", title: "Rave & Roses", artistId: "a9", artistName: "Rema", year: 2022, cover: ALBUM_COVERS[18], songIds: ["s33", "s34"], totalSongs: 17, totalDuration: "60 mins" },
  { id: "al18", title: "Work of Art", artistId: "a10", artistName: "Asake", year: 2023, cover: ALBUM_COVERS[0], songIds: ["s35", "s36"], totalSongs: 14, totalDuration: "45 mins" },
  { id: "al19", title: "19 & Dangerous", artistId: "a11", artistName: "Ayra Starr", year: 2021, cover: ALBUM_COVERS[2], songIds: ["s37", "s38", "s50"], totalSongs: 10, totalDuration: "35 mins" },
  { id: "al20", title: "Sprinter", artistId: "a12", artistName: "Central Cee", year: 2023, cover: ALBUM_COVERS[4], songIds: ["s39"], totalSongs: 1, totalDuration: "4 mins" },
  { id: "al21", title: "23", artistId: "a12", artistName: "Central Cee", year: 2022, cover: ALBUM_COVERS[5], songIds: ["s40", "s41"], totalSongs: 8, totalDuration: "26 mins" },
  { id: "al22", title: "We're All Alone in This Together", artistId: "a13", artistName: "Dave", year: 2021, cover: ALBUM_COVERS[7], songIds: ["s42", "s44"], totalSongs: 12, totalDuration: "44 mins" },
  { id: "al23", title: "Psychodrama", artistId: "a13", artistName: "Dave", year: 2019, cover: ALBUM_COVERS[8], songIds: ["s43"], totalSongs: 11, totalDuration: "42 mins" },
  { id: "al24", title: "Heavy Is the Head", artistId: "a14", artistName: "Stormzy", year: 2019, cover: ALBUM_COVERS[10], songIds: ["s45"], totalSongs: 15, totalDuration: "50 mins" },
  { id: "al25", title: "Gang Signs & Prayer", artistId: "a14", artistName: "Stormzy", year: 2017, cover: ALBUM_COVERS[11], songIds: ["s46"], totalSongs: 16, totalDuration: "52 mins" },
  { id: "al26", title: "Konnichiwa", artistId: "a15", artistName: "Skepta", year: 2016, cover: ALBUM_COVERS[12], songIds: ["s47", "s48"], totalSongs: 13, totalDuration: "45 mins" },
  { id: "al27", title: "Beautiful and Brutal Yard", artistId: "a16", artistName: "J Hus", year: 2023, cover: ALBUM_COVERS[14], songIds: ["s49"], totalSongs: 15, totalDuration: "52 mins" },
];

export const playlists = [
  { id: "pl1", title: "Liked Songs", description: "Your favorite tracks", songIds: ["s1", "s3", "s8", "s11", "s12"], cover: null, isLiked: true, public: false },
  { id: "pl2", title: "Vibe's Songs", description: "A collection of vibes", songIds: ["s2", "s9", "s15"], cover: ALBUM_COVERS[8], public: true },
  { id: "pl3", title: "Yuvan Hits", description: "Best of Yuvan", songIds: ["s8", "s9", "s15"], cover: ALBUM_COVERS[7], public: true },
  { id: "pl4", title: "Travel List", description: "Music for the road", songIds: ["s11", "s16", "s17"], cover: ALBUM_COVERS[5], public: true },
  { id: "pl5", title: "Sad Songs", description: "For the moody moments", songIds: ["s19", "s13", "s16"], cover: ALBUM_COVERS[6], public: false },
  { id: "pl6", title: "Late Night Mix", description: "Late night vibes", songIds: ["s11", "s16", "s13", "s9"], cover: ALBUM_COVERS[3], public: true },
  { id: "pl7", title: "Acoustic Chill", description: "Relax and unwind", songIds: ["s14", "s20", "s16"], cover: ALBUM_COVERS[4], public: true },
  { id: "pl8", title: "Electronic Drive", description: "High energy beats", songIds: ["s17", "s2", "s7"], cover: ALBUM_COVERS[7], public: true },
  { id: "pl9", title: "Afrobeats Gold", description: "Best of Nigerian Afrobeats", songIds: ["s21", "s25", "s30", "s33", "s37"], cover: ALBUM_COVERS[10], public: true },
  { id: "pl10", title: "UK Rap Heat", description: "Top UK artists", songIds: ["s39", "s42", "s45", "s47", "s49"], cover: ALBUM_COVERS[4], public: true },
  { id: "pl11", title: "Burna Boy Essentials", description: "Burna Boy greatest hits", songIds: ["s25", "s26", "s27", "s28", "s29"], cover: ALBUM_COVERS[13], public: true },
  { id: "pl12", title: "Naija Party", description: "Dance hits from Nigeria", songIds: ["s32", "s35", "s36", "s30", "s34"], cover: ALBUM_COVERS[17], public: true },
  { id: "pl13", title: "London Drill", description: "UK drill & rap", songIds: ["s39", "s40", "s47", "s45", "s48"], cover: ALBUM_COVERS[5], public: true },
  { id: "pl14", title: "Wizkid Vibes", description: "Sweet sounds from Starboy", songIds: ["s21", "s22", "s23", "s24"], cover: ALBUM_COVERS[11], public: true },
];

export const getLyrics = (songId) => LYRICS_DATA[songId] || null;

export const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const getAlbum = (id) => albums.find(a => a.id === id);
export const getArtist = (id) => artists.find(a => a.id === id);
export const getSong = (id) => songs.find(s => s.id === id);
export const getAlbumSongs = (albumId) => songs.filter(s => s.albumId === albumId);
export const getArtistSongs = (artistId) => songs.filter(s => s.artistId === artistId);
export const getArtistAlbums = (artistId) => albums.filter(a => a.artistId === artistId);
export const getPlaylist = (id) => playlists.find(p => p.id === id);
export const getPlaylistSongs = (playlistId) => {
  const pl = playlists.find(p => p.id === playlistId);
  if (!pl) return [];
  return pl.songIds.map(sid => songs.find(s => s.id === sid)).filter(Boolean);
};

export function getRecommendations(currentTrack, allSongs, recentlyPlayed = [], preferredGenres = []) {
  if (!currentTrack) {
    if (preferredGenres.length === 0) return allSongs.slice(0, 5);
    const scored = allSongs.map(s => ({
      ...s,
      score: preferredGenres.includes(s.genre) ? 1 : 0,
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 8);
  }
  const scored = allSongs
    .filter(s => s.id !== currentTrack.id)
    .map(s => {
      let score = 0;
      if (s.genre === currentTrack.genre) score += 3;
      if (s.mood === currentTrack.mood) score += 2;
      if (s.artistId === currentTrack.artistId) score += 1;
      if (preferredGenres.includes(s.genre)) score += 2;
      if (recentlyPlayed.includes(s.id)) score -= 1;
      return { ...s, score };
    });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 8);
}

export function getMoodPlaylist(mood, allSongs) {
  const moodMap = {
    energetic: ['energy', 'epic', 'intense'],
    chill: ['chill', 'romantic'],
    focus: ['chill', 'uplifting'],
    workout: ['energy', 'epic', 'intense'],
    romantic: ['romantic', 'chill'],
  };
  const targetMoods = moodMap[mood] || [mood];
  return allSongs.filter(s => targetMoods.includes(s.mood));
}
