const frames = [
  { file: "Screenshot 2026-04-19 at 8.35.20\u202fPM.png", label: "8:35:20 PM" },
  { file: "Screenshot 2026-04-19 at 8.35.40\u202fPM.png", label: "8:35:40 PM" },
  { file: "Screenshot 2026-04-19 at 8.35.56\u202fPM.png", label: "8:35:56 PM" },
  { file: "Screenshot 2026-04-19 at 8.36.27\u202fPM.png", label: "8:36:27 PM" },
  { file: "Screenshot 2026-04-19 at 8.36.43\u202fPM.png", label: "8:36:43 PM" },
  { file: "Screenshot 2026-04-19 at 8.36.57\u202fPM.png", label: "8:36:57 PM" },
  { file: "Screenshot 2026-04-19 at 8.37.15\u202fPM.png", label: "8:37:15 PM" },
  { file: "Screenshot 2026-04-19 at 8.37.39\u202fPM.png", label: "8:37:39 PM" },
  { file: "Screenshot 2026-04-19 at 8.38.10\u202fPM.png", label: "8:38:10 PM" },
  { file: "Screenshot 2026-04-19 at 8.38.31\u202fPM.png", label: "8:38:31 PM" },
  { file: "Screenshot 2026-04-19 at 8.38.54\u202fPM.png", label: "8:38:54 PM" },
  { file: "Screenshot 2026-04-19 at 8.39.24\u202fPM.png", label: "8:39:24 PM" },
];

const imageA = document.querySelector("#imageA");
const imageB = document.querySelector("#imageB");
const frameLabel = document.querySelector("#frameLabel");
const timeLabel = document.querySelector("#timeLabel");
const scrubber = document.querySelector("#scrubber");
const speedControl = document.querySelector("#speedControl");
const playButton = document.querySelector("#playButton");
const prevButton = document.querySelector("#prevButton");
const nextButton = document.querySelector("#nextButton");
const thumbnailStrip = document.querySelector("#thumbnailStrip");
const manifestList = document.querySelector("#manifestList");
const viewportState = document.querySelector("#viewportState");
const framePercent = document.querySelector("#framePercent");
const sequenceValue = document.querySelector("#sequenceValue");
const holdValue = document.querySelector("#holdValue");
const modeValue = document.querySelector("#modeValue");
const pixelStream = document.querySelector("#pixelStream");

let activeIndex = 0;
let visibleLayer = imageA;
let hiddenLayer = imageB;
let isPlaying = true;
let timerId = 0;
let frameDelay = Number(speedControl.value);

function imageUrl(file) {
  return encodeURI(file);
}

function preloadFrames() {
  frames.forEach((frame) => {
    const image = new Image();
    image.src = imageUrl(frame.file);
  });
}

function createThumbnails() {
  frames.forEach((frame, index) => {
    const button = document.createElement("button");
    button.className = "thumb-button";
    button.type = "button";
    button.setAttribute("aria-label", `Show frame ${index + 1}, ${frame.label}`);

    const image = document.createElement("img");
    image.src = imageUrl(frame.file);
    image.alt = "";
    image.loading = index < 4 ? "eager" : "lazy";

    button.append(image);
    button.addEventListener("click", () => {
      pause();
      showFrame(index);
    });
    thumbnailStrip.append(button);
  });
}

function createManifest() {
  frames.forEach((frame, index) => {
    const item = document.createElement("li");
    item.className = "manifest-item";
    item.tabIndex = 0;
    item.setAttribute("role", "button");
    item.setAttribute("aria-label", `Show frame ${index + 1}, ${frame.label}`);

    const indexNode = document.createElement("span");
    indexNode.className = "manifest-index";
    indexNode.textContent = `F-${String(index + 1).padStart(2, "0")}`;

    const labelNode = document.createElement("span");
    labelNode.textContent = frame.label.replace(" PM", "");

    const markerNode = document.createElement("span");
    markerNode.className = "manifest-node";

    item.append(indexNode, labelNode, markerNode);
    item.addEventListener("click", () => {
      pause();
      showFrame(index);
    });
    item.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        pause();
        showFrame(index);
      }
    });
    manifestList.append(item);
  });
}

function createPixelStream() {
  const states = ["blue", "", "green", "", "orange", "", "red", ""];

  for (let index = 0; index < 108; index += 1) {
    const cell = document.createElement("span");
    cell.className = `stream-cell ${states[index % states.length]}`.trim();
    pixelStream.append(cell);
  }
}

function updatePixelStream() {
  const cells = pixelStream.querySelectorAll(".stream-cell");
  cells.forEach((cell, index) => {
    const phase = (index + activeIndex) % 16;
    cell.className = "stream-cell";
    if (phase === 0 || phase === 5) {
      cell.classList.add("green");
    } else if (phase === 2 || phase === 9) {
      cell.classList.add("blue");
    } else if (phase === 7) {
      cell.classList.add("orange");
    } else if (phase === 13) {
      cell.classList.add("red");
    }
  });
}

function updateControls() {
  const displayIndex = String(activeIndex + 1).padStart(2, "0");
  const percent = Math.round((activeIndex / (frames.length - 1)) * 100);

  if (frameLabel) {
    frameLabel.textContent = `FRAME ${displayIndex}`;
  }
  if (timeLabel) {
    timeLabel.textContent = frames[activeIndex].label.replace(" PM", "");
  }
  scrubber.value = String(activeIndex);
  framePercent.textContent = `${String(percent).padStart(3, "0")}%`;
  sequenceValue.textContent = `${displayIndex} / ${frames.length}`;
  holdValue.textContent = `${String(frameDelay).padStart(4, "0")} MS`;
  modeValue.textContent = isPlaying ? "AUTO" : "HOLD";
  viewportState.textContent = isPlaying ? "AUTO RUN" : "MANUAL HOLD";

  document.querySelectorAll(".thumb-button").forEach((button, index) => {
    button.classList.toggle("is-active", index === activeIndex);
    button.setAttribute("aria-current", index === activeIndex ? "true" : "false");
  });

  document.querySelectorAll(".manifest-item").forEach((item, index) => {
    item.classList.toggle("is-active", index === activeIndex);
    item.setAttribute("aria-current", index === activeIndex ? "true" : "false");
  });

  updatePixelStream();
}

function swapLayers(nextSrc) {
  hiddenLayer.src = nextSrc;
  hiddenLayer.classList.add("is-visible");
  visibleLayer.classList.remove("is-visible");

  [visibleLayer, hiddenLayer] = [hiddenLayer, visibleLayer];
}

function showFrame(index) {
  const nextIndex = (index + frames.length) % frames.length;
  if (nextIndex === activeIndex && visibleLayer.src) {
    updateControls();
    return;
  }

  activeIndex = nextIndex;
  swapLayers(imageUrl(frames[activeIndex].file));
  updateControls();
}

function scheduleNext() {
  window.clearTimeout(timerId);
  if (!isPlaying) {
    return;
  }
  timerId = window.setTimeout(() => {
    showFrame(activeIndex + 1);
    scheduleNext();
  }, frameDelay);
}

function play() {
  isPlaying = true;
  playButton.classList.remove("is-paused");
  playButton.setAttribute("aria-label", "Pause animation");
  updateControls();
  scheduleNext();
}

function pause() {
  isPlaying = false;
  playButton.classList.add("is-paused");
  playButton.setAttribute("aria-label", "Play animation");
  window.clearTimeout(timerId);
  updateControls();
}

function togglePlayback() {
  if (isPlaying) {
    pause();
  } else {
    play();
  }
}

function setupEvents() {
  playButton.addEventListener("click", togglePlayback);
  prevButton.addEventListener("click", () => {
    pause();
    showFrame(activeIndex - 1);
  });
  nextButton.addEventListener("click", () => {
    pause();
    showFrame(activeIndex + 1);
  });
  scrubber.addEventListener("input", (event) => {
    pause();
    showFrame(Number(event.target.value));
  });
  speedControl.addEventListener("input", (event) => {
    frameDelay = Number(event.target.value);
    updateControls();
    scheduleNext();
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === " ") {
      event.preventDefault();
      togglePlayback();
    }
    if (event.key === "ArrowLeft") {
      pause();
      showFrame(activeIndex - 1);
    }
    if (event.key === "ArrowRight") {
      pause();
      showFrame(activeIndex + 1);
    }
  });
}

function init() {
  preloadFrames();
  createManifest();
  createPixelStream();
  createThumbnails();
  imageA.src = imageUrl(frames[0].file);
  imageB.src = imageUrl(frames[1].file);
  updateControls();
  setupEvents();
  scheduleNext();
}

init();
