# JUST THE COMMANDS

## Windows (PowerShell)

```
cd "C:\Users\YourName\Desktop\card-show-finder\scraper"
copy .env.example .env
notepad .env   # ← paste your keys and save, then close

cd ".."        # back to project root
type .env | foreach { if ($_ -match "=") { $k,$v=$_ -split "="; setx $k $v } }

npm install
npm run scraper:inspect:stats
npm run scraper:csv
```

---

## Mac (Terminal)

```
cd ~/Desktop/card-show-finder/scraper
cp .env.example .env
open -e .env   # ← paste your keys, save, close

cd ..          # back to project root
export $(grep -v '^#' .env | xargs)

npm install
npm run scraper:inspect:stats
npm run scraper:csv
```
