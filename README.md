# henriktranskribera

Spela in tal i webbläsaren → Gemini transkriberar → du väljer mapp i Google
Drive → sparas som .txt. Byggd med Vite (statisk frontend) + en Cloudflare
Pages Function som proxar Gemini-anropet så att API-nyckeln aldrig syns i
webbläsaren.

## 1. Google Cloud Console (måste göras manuellt, en gång)

1. Gå till https://console.cloud.google.com och skapa ett projekt (eller
   återanvänd ett befintligt).
2. Under **APIs & Services → Library**, aktivera:
   - **Google Drive API**
   - **Google Picker API**
3. Under **APIs & Services → Credentials**:
   - Skapa en **OAuth 2.0 Client ID** av typen *Web application*.
     - Lägg till **Authorized JavaScript origins**:
       - `http://localhost:5173` (för lokal utveckling)
       - `https://transkribera.swedishdad.com` (eller den domän du väljer)
     - Kopiera Client ID → klistra in i `src/config.js` som `GOOGLE_CLIENT_ID`.
   - Skapa en **API key** (för Picker).
     - Begränsa den till Picker API, och till dina domäner (HTTP referrers).
     - Kopiera nyckeln → klistra in i `src/config.js` som `GOOGLE_PICKER_API_KEY`.
   - Om projektet är i **Testing**-läge (inte publicerat): lägg till dig
     själv som **Test user** under OAuth consent screen, annars nekas
     inloggningen.

Ingen av dessa två uppgifter är hemlig i egentlig mening — de är avsedda att
synas i klientkod, och skyddas via origin/referrer-begränsningarna ovan.

## 2. Gemini API-nyckel

Återanvänd din befintliga Gemini-nyckel (samma du använder i dina andra
appar). Den ska **inte** in i `src/config.js` — den sätts som hemlighet i
Cloudflare Pages (steg 4).

## 3. Lokal utveckling

```bash
npm install
npm run dev
```

Frontend körs på `http://localhost:5173`. `/api/transcribe`-anropet fungerar
inte i ren `vite dev` (det är en Cloudflare Function) — testa den delen med
Wrangler om du vill köra allt lokalt:

```bash
npm install -g wrangler   # om den inte redan finns
npm run build
wrangler pages dev dist --binding GEMINI_API_KEY=din_nyckel
```

## 4. Cloudflare Pages

1. Pusha repot till GitHub (se nedan).
2. I Cloudflare-dashboarden: **Workers & Pages → Create → Pages → Connect to
   Git**, välj repot.
3. Build settings:
   - Build command: `npm run build`
   - Build output directory: `dist`
4. Under **Settings → Environment variables**, lägg till:
   - `GEMINI_API_KEY` (Encrypt/secret) — din Gemini-nyckel
   - `GEMINI_MODEL` (valfri) — t.ex. `gemini-3.6-flash` (default om ej satt)
5. Under **Custom domains**, lägg till t.ex. `transkribera.swedishdad.com`.

## 5. Pusha till GitHub

Repot är redan git-initierat med en första commit. Skapa ett tomt repo på
GitHub och kör:

```bash
git remote add origin git@github.com:<ditt-användarnamn>/henriktranskribera.git
git branch -M main
git push -u origin main
```

## Om formatvalet

Appen spelar in via `MediaRecorder` (webm/opus) men konverterar till WAV i
webbläsaren innan den skickas till Gemini, eftersom Gemini inte tar emot
webm — bara wav/mp3/aiff/aac/ogg/flac. Ingen ljuddata lämnar webbläsaren
okomprimerad längre än nödvändigt; WAV-filen skickas direkt vidare till
Cloudflare-funktionen och sparas inte.

## Behörighet i Drive

`config.js` är satt till full Drive-åtkomst
(`https://www.googleapis.com/auth/drive`) så att mappväljaren kan visa alla
dina befintliga mappar. Vill du snäva åt det senare går det att byta till
`drive.file`, men då kan appen bara se mappar/filer den själv skapat — inte
bläddra i hela din Drive.
