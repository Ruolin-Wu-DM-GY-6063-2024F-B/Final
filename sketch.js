const vert = `
  // Geometry vertex position provided by p5.js.
  attribute vec3 aPosition;
  attribute vec2 aTexCoord;

  uniform mat4 uModelViewMatrix;
  uniform mat4 uProjectionMatrix;

  varying vec2 vTexCoord;
  varying vec3 vVertexPos;

  void main() {
    vTexCoord = aTexCoord;
    vVertexPos = aPosition;
    gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0);
  }
`;

const frag = `
  precision mediump float;

  uniform float uTime;
  uniform vec2 uResolution;
  uniform vec3 uColor;
  uniform float uOctaves;
  uniform float uRotation;
  uniform float uMixAmount;
  uniform vec3 uBaseColor1;
  uniform vec3 uBaseColor2;

  varying vec2 vTexCoord;
  varying vec3 vVertexPos;

  // Simple random function based on input vector
  float random(in vec2 _st) {
    return fract(sin(dot(_st.xy, vec2(12.9898,78.233))) * 43758.5453123);
  }

  // Noise function based on random
  float noise(in vec2 _st) {
    vec2 i = floor(_st);
    vec2 f = fract(_st);

    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));

    vec2 u = f * f * (3.0 - 2.0 * f);

    return mix(a, b, u.x) +
           (c - a) * u.y * (1.0 - u.x) +
           (d - b) * u.x * u.y;
  }

  // Fractal Brownian Motion
  float fbm(in vec2 _st) {
    float value = 0.0;
    float scale = 0.5;
    vec2 shift = vec2(100.0);
    mat2 rot = mat2(cos(uRotation), sin(uRotation),
                    -sin(uRotation), cos(uRotation));
    for (int i = 0; i < 10; i++) { // Maximum 10 iterations
      if (float(i) >= uOctaves) break;
      value += scale * noise(_st);
      _st = rot * _st * 2.0 + shift;
      scale *= 0.5;
    }
    return value;
  }

  void main() {
    // Transform vertex position to UV coordinates
    vec2 st = vVertexPos.xy * 2.0 + vec2(vVertexPos.z + 1.0) * 2.0;
    st += vec2(uTime * 0.1);

    // Calculate fbm-based displacements
    vec2 q = vec2(0.0);
    q.x = fbm(st);
    q.y = fbm(st + vec2(1.0));

    vec2 r = vec2(0.0);
    r.x = fbm(st + 1.0 * q + vec2(1.7, 9.2) + 0.15 * uTime);
    r.y = fbm(st + 1.0 * q + vec2(8.3, 2.8) + 0.226 * uTime);

    float f = fbm(st + r);

    // Mix base colors based on fbm value
    vec3 baseColor = mix(
      uBaseColor1,
      uBaseColor2,
      clamp((f * f) * 4.0, 0.0, 1.0)
    );

    // Mix with user-selected primary color
    vec3 color = mix(baseColor, uColor, uMixAmount);

    // Final color with nonlinear adjustments
    gl_FragColor = vec4((f * f * f + 0.6 * f * f + 0.5 * f) * color, 1.0);
  }
`;

let primaryColorPicker, baseColor1Picker, baseColor2Picker;
let mixSlider;

let cumulation = 0;
let potValue = 0; 
let octaveCount = 0; 
let cubeSize = 300;
let crashOccurred = false;
let rotationAngle = 0;

let circlePattern = [];

const forceThreshold = 300;

let port;
let reader;
let isConnected = false;
let crashImage; 
// ======================== Setup ====================================

function setup() {
  setAttributes('alpha', true);
  crashImage = loadImage('./image/Crash.jpg');
  let controlsContainer = createDiv('');
  controlsContainer.id('controls-container');
  controlsContainer.parent(document.body);
  controlsContainer.style('position', 'absolute');
  controlsContainer.style('top', '10px');
  controlsContainer.style('left', '10px');
  controlsContainer.style('z-index', '10'); 
  controlsContainer.style('background', 'rgba(255, 255, 255, 0.1)');
  controlsContainer.style('padding', '5px');
  controlsContainer.style('border-radius', '5px');
  controlsContainer.style('font-family', 'Arial, sans-serif');

  connectButton = createButton("Connect To Serial");
  connectButton.id('connectButton'); 
  connectButton.parent('controls-container');
  connectButton.mousePressed(connectSerial);
  connectButton.style('display', 'block');
  connectButton.style('margin-bottom', '5px');

  createControls();

  for (let i = 0; i < 50; i++) {
    circlePattern.push({
      x: random(-width / 2, width / 2),
      y: random(-height / 2, height / 2),
      size: random(1, 500)
    });
  }

  createCanvas(windowWidth, windowHeight, WEBGL).style('z-index', '1'); 
  noStroke();

  myShader = createShader(vert, frag);
}

// ========================== Draw ================================

function draw() {
  
  clear();
  if (crashOccurred) {
    resetCanvas();
    crashOccurred = false;
  }

  shader(myShader);

  myShader.setUniform("uTime", millis() / 1000.0);
  myShader.setUniform("uResolution", [width, height]);

  let primaryColor = primaryColorPicker.color();
  let primaryColorArray = [
    red(primaryColor) / 255.0,
    green(primaryColor) / 255.0,
    blue(primaryColor) / 255.0
  ];

  let baseColor1 = baseColor1Picker.color();
  let baseColor1Array = [
    red(baseColor1) / 255.0,
    green(baseColor1) / 255.0,
    blue(baseColor1) / 255.0
  ];

  let baseColor2 = baseColor2Picker.color();
  let baseColor2Array = [
    red(baseColor2) / 255.0,
    green(baseColor2) / 255.0,
    blue(baseColor2) / 255.0
  ];

  let mixAmount = mixSlider.value();

  myShader.setUniform("uColor", primaryColorArray);
  myShader.setUniform("uOctaves", octaveCount);
  myShader.setUniform("uRotation", rotationAngle);
  myShader.setUniform("uMixAmount", mixAmount);
  myShader.setUniform("uBaseColor1", baseColor1Array);
  myShader.setUniform("uBaseColor2", baseColor2Array);

  orbitControl();

  box(cubeSize, cubeSize, cubeSize);

  drawCirclePattern();
}

// ======================== Connect Serial =========================

async function connectSerial() {
  try {
    port = await navigator.serial.requestPort();
    await port.open({ baudRate: 9600 });

    const decoder = new TextDecoderStream();
    const inputDone = port.readable.pipeTo(decoder.writable);
    const inputStream = decoder.readable;
    reader = inputStream.getReader();

    readLoop();

    isConnected = true;
    connectButton.hide();
    console.log("Serial port connected.");
  } catch (error) {
    console.error("There was an error opening the serial port:", error);
  }
}

async function readLoop() {
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        // Allow the serial port to be closed later.
        reader.releaseLock();
        break;
      }
      if (value) {
        handleSerialData(value);
      }
    }
  } catch (error) {
    console.error("Read loop error:", error);
  }
}

function handleSerialData(data) {
  const lines = data.split("\n"); 
  lines.forEach((line) => {
    line = line.trim(); 
    if (!line) return; 

    if (line.charAt(0) !== "{") {
      console.log("Error: Invalid data format -", line);
      return;
    }

    try {
      const jsonData = JSON.parse(line); // Parse JSON data

      if (jsonData.forceValue !== undefined) {
        const forceValue = jsonData.forceValue;
        console.log("Force Value:", forceValue);
      
        if (forceValue <= 200) {
          rotationAngle = 0;
          octaveCount = 0; 
        } else {
         
          rotationAngle = map(forceValue, 200, 1000, 0, TWO_PI);
          octaveCount = map(forceValue, 200, 1000, 0, 3);
        }

        console.log("Rotation Angle:", rotationAngle);
      }

      if (jsonData.potValue !== undefined) {
        potValue = jsonData.potValue;
        console.log("Pot Value:", potValue);

        cubeSize = map(potValue, 0, 4000, 0, 1000);
        cubeSize = constrain(cubeSize, 0, 1000);

        const newRadius = map(potValue, 0, 4000, 2, 500);
        for (let i = 0; i < circlePattern.length; i++) {
          circlePattern[i].size =
            (circlePattern[i].x + circlePattern[i].y) % 100 === 0
              ? newRadius
              : newRadius / 2;
        }
      }

      if (jsonData.cumulation !== undefined) {
        cumulation = jsonData.cumulation;
        console.log("Cumulation:", cumulation);

        octaveCount = map(cumulation, 0, 10000, 0, 10000);
        octaveCount = constrain(octaveCount, 0, 10000);

        if (cumulation > 100000) {
          resetCanvas();
        }
      }
    } catch (error) {
      console.log("Error parsing JSON:", error.message, line);
    }
  });
}

// ===================== Circle Pattern =============================

function drawCirclePattern() {
  push();
  translate(-width / 2, -height / 2);

  for (let i = 0; i < circlePattern.length; i++) {
    let c = circlePattern[i];
    fill(233, 212, 0, 150);
    noStroke();
    ellipse(c.x, c.y, c.size);
  }

  pop(); 
}

// ======================= Window Resize ============================
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// ======================= Controls =================================
function createControls() {
  // Primary Color Picker
  createSpan('Primary Color:').parent('controls-container');
  primaryColorPicker = createColorPicker('#1A9999').parent('controls-container');
  primaryColorPicker.style('display', 'block');
  primaryColorPicker.style('margin-bottom', '5px');

  // Base Color 1 Picker
  createSpan('Base Color 1:').parent('controls-container');
  baseColor1Picker = createColorPicker('#1A9999').parent('controls-container');
  baseColor1Picker.style('display', 'block');
  baseColor1Picker.style('margin-bottom', '5px');

  // Base Color 2 Picker
  createSpan('Base Color 2:').parent('controls-container');
  baseColor2Picker = createColorPicker('#999966').parent('controls-container');
  baseColor2Picker.style('display', 'block');
  baseColor2Picker.style('margin-bottom', '5px');

  // Color Mix Amount Slider
  createSpan('Color Mix Amount:').parent('controls-container');
  mixSlider = createSlider(0, 1, 0.5, 0.01).parent('controls-container');
  mixSlider.style('width', '100%');
  mixSlider.style('margin-bottom', '5px');

}

// ======================== Crash Handling =========================

function resetCanvas() {

  let canvasElements = document.querySelectorAll('canvas');
  canvasElements.forEach((canvas) => canvas.remove());

  console.log("Cumulation exceeded 10,000! Displaying crash image.");

  const crashDiv = document.createElement('div');
  crashDiv.id = 'crash-screen';
  crashDiv.style.position = 'fixed';
  crashDiv.style.top = '0';
  crashDiv.style.left = '0';
  crashDiv.style.width = '100%';
  crashDiv.style.height = '100%';
  crashDiv.style.backgroundImage = 'url("./7/Crash.jpg")';
  crashDiv.style.backgroundSize = 'cover';
  crashDiv.style.backgroundPosition = 'center';
  crashDiv.style.zIndex = '100000'; 
  document.body.appendChild(crashDiv);
}
