import { GOOGLE_CLIENT_ID, GOOGLE_PICKER_API_KEY, DRIVE_SCOPE } from './config.js';

// ---------- DOM ----------
const el = (id) => document.getElementById(id);
const screens = {
  record: el('screen-record'),
  processing: el('screen-processing'),
  result: el('screen-result'),
  saved: el('screen-saved'),
};
const recordBtn = el('record-btn');
const recordStatus = el('record-status');
const recordTimer = el('record-timer');
const filenameInput = el('filename-input');
const textOutput = el('text-output');
const pickFolderBtn = el('pick-folder-btn');
const folderNameEl = el('folder-name');
const saveBtn = el('save-btn');
const discardBtn = el('discard-btn');
const resultError = el('result-error');
const signinBtn = el('signin-btn');
const accountBadge = el('account-badge');
const savedMessage = el('saved-message');
const savedLink = el('saved-link');
const recordAgainBtn = el('record-again-btn');

function showScreen(name) {
  Object.entries(screens).forEach(([key, node]) => {
    node.hidden = key !== name;
  });
}

// ---------- Google auth ----------
let accessToken = null;
let tokenClient = null;
let selectedFolder = null; // { id, name }

function initGoogleAuth() {
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: DRIVE_SCOPE,
    callback: (resp) => {
      if (resp.error) {
        console.error('OAuth-fel', resp);
        return;
      }
      accessToken = resp.access_token;
      accountBadge.hidden = false;
      accountBadge.textContent = 'Inloggad';
      signinBtn.hidden = true;
    },
  });
  signinBtn.hidden = false;
  signinBtn.addEventListener('click', () => requestAccessToken());
}

function requestAccessToken(promptConsent = false) {
  return new Promise((resolve) => {
    tokenClient.callback = (resp) => {
      if (resp.error) {
        console.error('OAuth-fel', resp);
        resolve(null);
        return;
      }
      accessToken = resp.access_token;
      accountBadge.hidden = false;
      accountBadge.textContent = 'Inloggad';
      signinBtn.hidden = true;
      resolve(accessToken);
    };
    tokenClient.requestAccessToken({ prompt: promptConsent ? 'consent' : '' });
  });
}

async function ensureSignedIn() {
  if (accessToken) return accessToken;
  return requestAccessToken(true);
}

// ---------- Recording ----------
let mediaRecorder = null;
let chunks = [];
let timerInterval = null;
let recordStart = null;
let isRecording = false;

recordBtn.addEventListener('click', async () => {
  if (!isRecording) {
    await startRecording();
  } else {
    stopRecording();
  }
});

async function startRecording() {
  resultError.hidden = true;
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    recordStatus.textContent = 'Kunde inte komma åt mikrofonen.';
    return;
  }
  chunks = [];
  mediaRecorder = new MediaRecorder(stream);
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  mediaRecorder.onstop = onRecordingStopped;
  mediaRecorder.start();
  isRecording = true;
  recordBtn.classList.add('is-recording');
  recordStatus.textContent = 'Spelar in — tryck för att stoppa';
  recordTimer.hidden = false;
  recordStart = Date.now();
  timerInterval = setInterval(updateTimer, 250);
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach((t) => t.stop());
  }
  isRecording = false;
  recordBtn.classList.remove('is-recording');
  clearInterval(timerInterval);
}

function updateTimer() {
  const secs = Math.floor((Date.now() - recordStart) / 1000);
  const m = String(Math.floor(secs / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  recordTimer.textContent = `${m}:${s}`;
}

async function onRecordingStopped() {
  recordStatus.textContent = 'Tryck för att spela in';
  recordTimer.hidden = true;
  if (chunks.length === 0) return;
  const webmBlob = new Blob(chunks, { type: 'audio/webm' });
  showScreen('processing');
  try {
    const wavBlob = await webmToWav(webmBlob);
    const base64 = await blobToBase64(wavBlob);
    const text = await transcribe(base64, 'audio/wav');
    textOutput.value = text.trim();
    filenameInput.value = defaultFilename();
    selectedFolder = null;
    folderNameEl.textContent = '';
    saveBtn.disabled = true;
    showScreen('result');
  } catch (err) {
    console.error(err);
    showScreen('result');
    resultError.hidden = false;
    resultError.textContent = 'Transkriberingen misslyckades: ' + err.message;
    textOutput.value = '';
  }
}

function defaultFilename() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `Transkribering ${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}${pad(now.getMinutes())}`;
}

// ---------- WAV conversion ----------
async function webmToWav(blob) {
  const arrayBuffer = await blob.arrayBuffer();
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  const wav = encodeWav(audioBuffer);
  audioCtx.close();
  return new Blob([wav], { type: 'audio/wav' });
}

function encodeWav(audioBuffer) {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const numFrames = audioBuffer.length;

  // Downmix to mono for smaller uploads / cleaner transcription.
  const mono = new Float32Array(numFrames);
  for (let ch = 0; ch < numChannels; ch++) {
    const data = audioBuffer.getChannelData(ch);
    for (let i = 0; i < numFrames; i++) mono[i] += data[i] / numChannels;
  }

  const bytesPerSample = 2;
  const blockAlign = bytesPerSample;
  const dataSize = numFrames * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    const s = Math.max(-1, Math.min(1, mono[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return buffer;
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ---------- Transcription ----------
async function transcribe(base64Audio, mimeType) {
  const res = await fetch('/api/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audio: base64Audio, mimeType }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Okänt fel');
  return data.text || '';
}

// ---------- Drive folder picker ----------
let pickerLoaded = false;

function loadPicker() {
  return new Promise((resolve) => {
    if (pickerLoaded) return resolve();
    window.gapi.load('picker', () => {
      pickerLoaded = true;
      resolve();
    });
  });
}

pickFolderBtn.addEventListener('click', async () => {
  const token = await ensureSignedIn();
  if (!token) return;
  await loadPicker();
  const view = new window.google.picker.DocsView(window.google.picker.ViewId.FOLDERS)
    .setSelectFolderEnabled(true)
    .setIncludeFolders(true);
  const picker = new window.google.picker.PickerBuilder()
    .addView(view)
    .setOAuthToken(token)
    .setDeveloperKey(GOOGLE_PICKER_API_KEY)
    .setTitle('Välj mapp för transkriberingen')
    .setCallback(pickerCallback)
    .build();
  picker.setVisible(true);
});

function pickerCallback(data) {
  if (data.action === window.google.picker.Action.PICKED) {
    const doc = data.docs[0];
    selectedFolder = { id: doc.id, name: doc.name };
    folderNameEl.textContent = doc.name;
    saveBtn.disabled = false;
  }
}

// ---------- Save to Drive ----------
saveBtn.addEventListener('click', async () => {
  if (!selectedFolder) return;
  resultError.hidden = true;
  saveBtn.disabled = true;
  saveBtn.textContent = 'Sparar…';
  try {
    const token = await ensureSignedIn();
    const filename = (filenameInput.value.trim() || defaultFilename()) + '.txt';
    const fileId = await uploadTextFile(token, filename, textOutput.value, selectedFolder.id);
    savedMessage.textContent = `${filename} sparad i ${selectedFolder.name}.`;
    savedLink.href = `https://drive.google.com/file/d/${fileId}/view`;
    savedLink.hidden = false;
    showScreen('saved');
  } catch (err) {
    console.error(err);
    resultError.hidden = false;
    resultError.textContent = 'Kunde inte spara: ' + err.message;
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Spara i Drive';
  }
});

async function uploadTextFile(token, name, text, folderId) {
  const metadata = { name, mimeType: 'text/plain', parents: [folderId] };
  const boundary = 'transkribera_boundary_' + Date.now();
  const body =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    `\r\n--${boundary}\r\n` +
    'Content-Type: text/plain; charset=UTF-8\r\n\r\n' +
    text +
    `\r\n--${boundary}--`;

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Drive-fel');
  return data.id;
}

// ---------- Discard / record again ----------
discardBtn.addEventListener('click', () => {
  textOutput.value = '';
  showScreen('record');
});

recordAgainBtn.addEventListener('click', () => {
  savedLink.hidden = true;
  showScreen('record');
});

// ---------- Boot ----------
window.addEventListener('load', () => {
  // google.accounts is injected by the GIS script; it loads async so poll briefly.
  const tryInit = () => {
    if (window.google?.accounts?.oauth2) {
      initGoogleAuth();
    } else {
      setTimeout(tryInit, 150);
    }
  };
  tryInit();
});
