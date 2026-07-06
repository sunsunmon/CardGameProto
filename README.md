# Battle Deck

Battle Deck adalah prototype game kartu digital berbasis HTML, CSS, dan JavaScript. Project ini masih dalam tahap eksplorasi mekanik, balancing kartu, UI, campaign, sound effect, dan feel combat.

Prototype ini dibuat oleh Sunsunmon.

## Status Project

Project ini masih prototype. Beberapa bagian seperti angka kartu, efek ability, deck AI, stage campaign, sound, animasi, dan layout mobile masih dapat berubah mengikuti proses testing.

## Fitur Utama

- Versus AI dengan pilihan Quick Match dan Campaign.
- Campaign bertahap dengan stage yang semakin sulit.
- Deck Builder untuk menyusun dan memilih deck aktif.
- Collection untuk melihat semua kartu.
- Guide untuk membaca rule dan mekanik permainan.
- Tutorial Guide dengan arahan step-by-step.
- Sistem creature, spell, trap, passive ability, discard pile, dan card detail viewer.
- Sound effect dan background music opsional.

## Cara Menjalankan Lokal

Karena project ini static web, cukup buka file `index.html` di browser.

Untuk hasil yang lebih stabil, jalankan dengan local server:

```bash
python -m http.server 8000
```

Lalu buka:

```text
http://localhost:8000
```

## Hosting di GitHub Pages

1. Buat repository baru di GitHub.
2. Upload semua file project ke repository tersebut.
3. Pastikan `index.html` berada di root repository.
4. Buka menu `Settings`.
5. Masuk ke `Pages`.
6. Pada bagian `Build and deployment`, pilih:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/root`
7. Simpan pengaturan.
8. Tunggu beberapa saat sampai GitHub memberikan link website.

## Struktur Folder

```text
.
├── index.html
├── css/
│   ├── base.css
│   └── deck-builder.css
├── js/
│   ├── core/
│   ├── data/
│   ├── features/
│   ├── systems/
│   └── ui/
└── assets/
    ├── campaign/
    ├── sounds/
    └── ...
```

## Catatan Asset

Folder `assets` dapat berisi gambar kartu, background campaign, dan audio. Jika ukuran asset terlalu besar, pastikan semua file tetap berada di path yang sama seperti yang dipanggil oleh script.

Contoh:

```text
assets/sounds/draw.mp3
assets/sounds/play_card.mp3
assets/campaign/bg_stage1.png
```

Jika asset belum tersedia, game tetap diusahakan tidak error, tetapi beberapa visual atau suara mungkin tidak muncul.

## Catatan Development

Project ini dibuat modular supaya lebih mudah dikembangkan:

- `js/core/` berisi logic utama game.
- `js/features/` berisi fitur tambahan gameplay dan overlay.
- `js/systems/` berisi sistem pendukung seperti deck storage.
- `js/ui/` berisi UI seperti deck builder.
- `css/` berisi styling utama dan styling fitur.

## Disclaimer

Battle Deck adalah prototype non-final. Game ini dibuat untuk testing mekanik dan pengembangan visual. Semua balancing, nama kartu, efek, UI, dan konten campaign masih dapat berubah.
