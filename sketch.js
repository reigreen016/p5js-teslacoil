// --- ポリフォニック音源管理用 ---
let activeVoices = new Map();

// --- MIDI制御用変数 ---
let midiAccess = null;
let activeMidiKeys = new Set();

// PCキーボード用音階
const keyboardNotes = {
  65: 60, // A: C4
  83: 62, // S: D4
  68: 64, // D: E4
  70: 65, // F: F4
  71: 67, // G: G4
  72: 69, // H: A4
  74: 71, // J: B4
  75: 72  // K: C5
};

function setup() {
  createCanvas(windowWidth, windowHeight);

  if (navigator.requestMIDIAccess) {
    navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure);
  } else {
    console.log("Web MIDI APIはこのブラウザではサポートされていない．");
  }
}

function draw() {
  background(0, 0, 0, 40);

  // PCキーボードの押下状況を同期
  syncKeyboardNotes();

  let playingCount = activeVoices.size;
  let playing = playingCount > 0;

  let startX = width / 2;
  let startY = height / 2;

  blendMode(ADD);

  // コア（玉）の常時表示
  noStroke();
  fill(200, 220, 255);

  let coreSize;
  if (playing) {
    // 和音数に応じてコアのサイズを拡大
    coreSize = random(30, 50) + playingCount * 6;
  } else {
    // 待機時はゆっくりと明滅・伸縮
    coreSize = 40 + sin(frameCount * 0.1) * 5;
  }
  ellipse(startX, startY, coreSize);

  // 演奏中の処理
  if (playing) {
    let targetAmp = 0.5 / Math.sqrt(playingCount);
    let noteSum = 0;

    // 各オシレータの音量を更新し，平均ノート番号を算出
    for (let [note, voice] of activeVoices.entries()) {
      voice.osc.amp(targetAmp * random(0.8, 1.2), 0.05);
      noteSum += note;
    }

    // 和音全体の平均ピッチから単一の角度を決定
    let avgNote = noteSum / playingCount;
    let mappedNote = constrain(avgNote, 48, 84);
    let baseAngle = map(mappedNote, 48, 84, -PI, PI);
    baseAngle += random(-0.15, 0.15);

    // 和音数に応じて稲妻の太さを強化
    let boltLen = max(width, height) * 0.6;
    let initialThickness = 9 + playingCount * 1.5;

    // 稲妻を1本のみ放電
    generateLightning(startX, startY, baseAngle, initialThickness, boltLen, 0.45);
  }

  blendMode(BLEND);
}

// --- ボイス（単音）の生成と破棄 ---
function noteOn(note) {
  if (activeVoices.has(note)) return;

  let osc = new p5.Oscillator('sawtooth');
  let freq = midiToFreq(note);
  osc.freq(freq);
  osc.amp(0);
  osc.start();

  activeVoices.set(note, { osc: osc });
}

function noteOff(note) {
  if (!activeVoices.has(note)) return;

  let voice = activeVoices.get(note);
  voice.osc.amp(0, 0.08);
  setTimeout(() => {
    voice.osc.stop();
    voice.osc.dispose();
  }, 100);

  activeVoices.delete(note);
}

// --- PCキーボードの同時押し同期処理 ---
function syncKeyboardNotes() {
  for (let [key, note] of Object.entries(keyboardNotes)) {
    let keyCode = Number(key);
    if (keyIsDown(keyCode)) {
      if (!activeVoices.has(note)) {
        noteOn(note);
      }
    } else {
      if (activeVoices.has(note) && !activeMidiKeys.has(note)) {
        noteOff(note);
      }
    }
  }
}

// --- 周波数変換関数 ---
function midiToFreq(midiNote) {
  return 440 * Math.pow(2, (midiNote - 69) / 12);
}

// --- MIDI制御 ---
function onMIDISuccess(access) {
  midiAccess = access;
  console.log("MIDI Access Successful!");
  for (let input of midiAccess.inputs.values()) {
    input.onmidimessage = getMIDIMessage;
  }
}

function onMIDIFailure() {
  console.log("Could not access your MIDI devices.");
}

function getMIDIMessage(message) {
  let command = message.data[0];
  let note = message.data[1];
  let velocity = (message.data.length > 2) ? message.data[2] : 0;

  if (command === 144 && velocity > 0) {
    activeMidiKeys.add(note);
    noteOn(note);
    if (typeof userStartAudio === 'function') {
      userStartAudio();
    }
  } else if (command === 128 || (command === 144 && velocity === 0)) {
    activeMidiKeys.delete(note);
    noteOff(note);
  }
}

// --- 稲妻生成関数 ---
function generateLightning(x, y, angle, thickness, len, branchProb) {
  if (thickness < 1 || len < 15) return;

  push();
  strokeJoin(ROUND);

  let jitter = map(thickness, 15, 1, 0.1, 0.7);
  let currentAngle = angle + random(-jitter, jitter);

  let segmentLen = random(20, 50);
  if (segmentLen > len) segmentLen = len;

  let nextX = x + cos(currentAngle) * segmentLen;
  let nextY = y + sin(currentAngle) * segmentLen;

  // 外側の発光
  strokeWeight(thickness * 4.5);
  stroke(100, 0, 255, 25);
  line(x, y, nextX, nextY);

  // 中間の光
  strokeWeight(thickness * 2.2);
  stroke(160, 110, 255, 90);
  line(x, y, nextX, nextY);

  // 芯の白光
  strokeWeight(thickness);
  stroke(255, 255, 255, 240);
  line(x, y, nextX, nextY);

  pop();

  let remainingLen = len - segmentLen;
  generateLightning(nextX, nextY, currentAngle, thickness * 0.85, remainingLen, branchProb);

  if (random() < branchProb) {
    let branchAngle = currentAngle + random(-0.9, 0.9);
    generateLightning(nextX, nextY, branchAngle, thickness * 0.45, remainingLen * 0.6, branchProb);
  }
}

function mousePressed() {
  if (typeof userStartAudio === 'function') {
    userStartAudio();
  }
}

function keyPressed() {
  if (typeof userStartAudio === 'function') {
    userStartAudio();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
