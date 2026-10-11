# Ranges 8-max

Petite app web (iPhone) qui affiche, pour une position à une table de 8 joueurs, la range d'open (vert) et la range de 3bet (rouge).

- `docs/` : le site publié sur GitHub Pages (https://d4ta314.github.io/ranges/).
- `template.html` : la page, avec `__DATA__` à la place des données.
- `ranges_8max.json` : les ranges extraites du PDF `Ranges_avec_legende.pdf`.
- `build_site.py` : régénère `docs/` (page complète, manifest, service worker, icônes).
- `index.html` : même page au format artifact Claude.

Pour modifier l'app : éditer `template.html` ou `ranges_8max.json`, lancer `python3 build_site.py`, puis commit et push. Le site se met à jour en une minute environ.
