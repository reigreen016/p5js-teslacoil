let osc;

// --- MIDI制御用変数 ---
let midiAccess = null;
let activeNotes = new Set();
let lastMidiNote = -1;

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
  
  osc = new p5.Oscillator('sawtooth');
  osc.amp(0); 
  osc.start();

  if (navigator.requestMIDIAccess) {
    navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure);
  } else {
    console.log("Web MIDI APIはこのブラウザではサポートされていない．");
  }
}

function draw() {
  background(0, 0, 0, 40); 

  let playing = false;
  let currentNote = 0;

  if (activeNotes.size > 0) {
    playing = true;
    currentNote = lastMidiNote;
  } else {
    let keys = [75, 74, 72, 71, 70, 68, 83, 65]; 
    for (let k of keys) {
      if (keyIsDown(k)) {
        currentNote = keyboardNotes[k];
        playing = true;
        break; 
      }
    }
  }

  let startX = width / 2;
  let startY = height / 2;

  blendMode(ADD);

  // コア（玉）の常時表示
  noStroke();
  fill(200, 220, 255);
  
  let coreSize;
  if (playing) {
    coreSize = random(30, 60); 
  } else {
    // 待機時はゆっくりと明滅・伸縮する
    coreSize = 40 + sin(frameCount * 0.1) * 5; 
  }
  ellipse(startX, startY, coreSize);

  // 演奏中の処理
  if (playing) {
    let frequencyVal = midiToFreq(currentNote);
    osc.freq(frequencyVal);
    osc.amp(random(0.4, 0.6), 0.05);

    // 360度にマッピング (-PI から PI)
    let mappedNote = constrain(currentNote, 48, 84);
    let baseAngle = map(mappedNote, 48, 84, -PI, PI);
    baseAngle += random(-0.2, 0.2);

    let boltLen = max(width, height) * 0.6;
    generateLightning(startX, startY, baseAngle, 10, boltLen, 0.5);
  } else {
    osc.amp(0, 0.1);
  }

  blendMode(BLEND);
}

// --- MIDI制御関数 ---
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
    activeNotes.add(note);
    lastMidiNote = note;
    userStartAudio(); 
  } else if (command === 128 || (command === 144 && velocity === 0)) {
    activeNotes.delete(note);
    if (activeNotes.size > 0 && note === lastMidiNote) {
      let items = Array.from(activeNotes);
      lastMidiNote = items[items.length - 1];
    }
  }
}

// --- 稲妻生成関数 ---
function generateLightning(x, y, angle, thickness, len, branchProb) {
  if (thickness < 1 || len < 10) return;

  push();
  strokeJoin(ROUND);

  let jitter = map(thickness, 10, 1, 0.1, 0.8); 
  let currentAngle = angle + random(-jitter, jitter);
  
  let segmentLen = random(20, 60);
  if (segmentLen > len) segmentLen = len;

  let nextX = x + cos(currentAngle) * segmentLen;
  let nextY = y + sin(currentAngle) * segmentLen;

  strokeWeight(thickness * 5);
  stroke(100, 0, 255, 30); 
  line(x, y, nextX, nextY);

  strokeWeight(thickness * 2.5);
  stroke(150, 100, 255, 100); 
  line(x, y, nextX, nextY);

  strokeWeight(thickness);
  stroke(255, 255, 255, 255); 
  line(x, y, nextX, nextY);

  pop();
  
  let remainingLen = len - segmentLen;
  
  generateLightning(nextX, nextY, currentAngle, thickness * 0.85, remainingLen, branchProb);

  if (random() < branchProb) {
    let branchAngle = currentAngle + random(-1.0, 1.0);
    generateLightning(nextX, nextY, branchAngle, thickness * 0.4, remainingLen * 0.6, branchProb);
  }
}

function mousePressed() {
  userStartAudio();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}