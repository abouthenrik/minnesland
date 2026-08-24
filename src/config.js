// Fyll i dessa två värden efter att du skapat dem i Google Cloud Console
// (se README.md, steg 1). Ingen av dem är hemlig — de skyddas genom att
// bara vissa domäner ("authorized origins" / referrers) får använda dem.

export const GOOGLE_CLIENT_ID = '760720412767-s0q1afotebo8k42eaf07i06lbrk9175s.apps.googleusercontent.com';
export const GOOGLE_PICKER_API_KEY = 'AIzaSyCfZZwTc8os2ryc8HC_6T7_tAwmLQ-Itiw';

// Drive-scope: fullständig åtkomst, så att mappväljaren kan visa och välja
// bland alla dina befintliga mappar. Om du senare vill snäva åt behörigheten
// går det att byta till 'https://www.googleapis.com/auth/drive.file', men då
// kan appen bara se mappar/filer den själv skapat.
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';
