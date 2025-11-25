// src/mockData.js

// Fake "now playing" movies – posters are just public image URLs
export const mockNowPlaying = [
  {
    id: 1,
    title: "Dune: Part Two",
    posterUrl:
      "https://image.tmdb.org/t/p/w500/8b8R8l88Qje9dn9OE8PY05Nxl1X.jpg",
  },
  {
    id: 2,
    title: "Inside Out 2",
    posterUrl:
      "https://image.tmdb.org/t/p/w500/vpnVM9B6NMmQpWeZvzLvDESb2QY.jpg",
  },
  {
    id: 3,
    title: "Deadpool & Wolverine",
    posterUrl:
      "https://image.tmdb.org/t/p/w500/5fYFZ8ihJJsY9Gkdj1fEHYJZkh7.jpg",
  },
  {
    id: 4,
    title: "Despicable Me 4",
    posterUrl:
      "https://image.tmdb.org/t/p/w500/tnRcr1v2h3hD9hvPWxL1j6uWHzl.jpg",
  },
];

// Fake showtimes
export const mockShowtimes = [
  {
    id: 1,
    film: "Dune: Part Two",
    cinema: "Odeon Leeds",
    time: "19:30",
    price: "£12.99",
    bookingUrl: "https://www.odeon.co.uk/",
  },
  {
    id: 2,
    film: "Dune: Part Two",
    cinema: "Vue Kirkstall",
    time: "20:00",
    price: "£10.50",
    bookingUrl: "https://www.myvue.com/",
  },
  {
    id: 3,
    film: "Inside Out 2",
    cinema: "Cineworld York",
    time: "18:45",
    price: "£11.25",
    bookingUrl: "https://www.cineworld.co.uk/",
  },
];
