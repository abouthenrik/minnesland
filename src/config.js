// Fyll i dessa två värden efter att du skapat dem i Google Cloud Console
// (se README.md, steg 1). Ingen av dem är hemlig — de skyddas genom att
// bara vissa domäner ("authorized origins" / referrers) får använda dem.

export const GOOGLE_CLIENT_ID = 'DIN_OAUTH_CLIENT_ID.apps.googleusercontent.com';
export const GOOGLE_PICKER_API_KEY = 'DIN_PICKER_API_NYCKEL';

// Drive-scope: fullständig åtkomst, så att mappväljaren kan visa och välja
// bland alla dina befintliga mappar. Om du senare vill snäva åt behörigheten
// går det att byta till 'https://www.googleapis.com/auth/drive.file', men då
// kan appen bara se mappar/filer den själv skapat.
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';
