function captureVisibleTab() {
  return new Promise((resolve) => {
    chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
      resolve(dataUrl);
    });
  });
}

let pickedColors = [];
const MAX_PICKED_COLORS = 6;

function createColorPickerModal(imageDataUrl) {
  const modal = document.createElement("div");
  modal.id = "colorPickerModal";
  modal.innerHTML = `
    <div class="modal-content">
      <h3>Pick Colors</h3>
      <p class="picker-instruction">Click on the image below to pick colors (max 6)</p>
      <div class="image-container">
        <img id="screenshotImage" src="${imageDataUrl}" alt="Screenshot">
      </div>
      <div id="pickedColorsContainer"></div>
      <div id="colorPreview"></div>
      <button id="finishPicking">Finish Picking</button>
      <button id="closeModal">Close</button>
    </div>
  `;
  document.body.appendChild(modal);

  const img = modal.querySelector("#screenshotImage");
  const colorPreview = modal.querySelector("#colorPreview");
  const pickedColorsContainer = modal.querySelector("#pickedColorsContainer");
  const finishPickingButton = modal.querySelector("#finishPicking");
  const closeButton = modal.querySelector("#closeModal");

  updatePickedColorsDisplay();

  img.addEventListener("click", (e) => {
    const rect = img.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
      const color = getColorFromImage(e, img);
      if (pickedColors.length < MAX_PICKED_COLORS) {
        pickedColors.push(color);
        updatePickedColorsDisplay();
      }
      colorPreview.style.backgroundColor = `rgb(${color.r}, ${color.g}, ${color.b})`;
    }
  });

  finishPickingButton.addEventListener("click", () => {
    displayColors(pickedColors.map((color) => [color.r, color.g, color.b]));
    savePalette(pickedColors.map((color) => [color.r, color.g, color.b]));
    document.body.removeChild(modal);
    pickedColors = [];
  });

  closeButton.addEventListener("click", () => {
    document.body.removeChild(modal);
    pickedColors = [];
  });
}

function updatePickedColorsDisplay() {
  const container = document.querySelector("#pickedColorsContainer");
  container.innerHTML = "";

  pickedColors.forEach((color, index) => {
    const colorBox = document.createElement("div");
    colorBox.className = "picked-color-box";
    colorBox.style.backgroundColor = `rgb(${color.r}, ${color.g}, ${color.b})`;
    colorBox.addEventListener("click", () => removePickedColor(index));
    container.appendChild(colorBox);
  });

  for (let i = pickedColors.length; i < MAX_PICKED_COLORS; i++) {
    const emptyBox = document.createElement("div");
    emptyBox.className = "picked-color-box empty";
    emptyBox.textContent = "+";
    container.appendChild(emptyBox);
  }
}

function removePickedColor(index) {
  pickedColors.splice(index, 1);
  updatePickedColorsDisplay();
}

function getColorFromImage(event, img) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0, img.width, img.height);

  const rect = img.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const imageData = ctx.getImageData(x, y, 1, 1);

  return {
    r: imageData.data[0],
    g: imageData.data[1],
    b: imageData.data[2],
  };
}

function showScrollNudge() {
  const scrollNudge = document.createElement("div");
  scrollNudge.id = "scrollNudge";
  scrollNudge.innerHTML = "More features below ↓";
  document.body.appendChild(scrollNudge);

  setTimeout(() => {
    scrollNudge.classList.add("show");
  }, 300);

  setTimeout(() => {
    scrollNudge.classList.remove("show");
    setTimeout(() => {
      document.body.removeChild(scrollNudge);
    }, 300);
  }, 3000);
}

function keepPopupOpen() {
  chrome.action.setPopup({ popup: "popup.html" });
}

let extractedPalettes = [];

function getPageColors() {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    chrome.tabs.captureVisibleTab(null, { format: "png" }, function (dataUrl) {
      if (chrome.runtime.lastError) {
        displayError(chrome.runtime.lastError.message);
      } else {
        const img = new Image();
        img.onload = function () {
          const colorThief = new ColorThief();
          const colors = colorThief.getPalette(img, 6);
          displayColors(colors);
          savePalette(colors);
        };
        img.onerror = function () {
          displayError("Failed to load image data");
        };
        img.src = dataUrl;
      }
    });
  });
}


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "colorPicked") {
    const color = request.color;
    const colors = [[color.r, color.g, color.b]];
    displayColors(colors);
    savePalette(colors);
    resetUIAfterColorPick();
  }
});

function rgbToHex(r, g, b) {
  return (
    "#" +
    ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()
  );
}


function copyToClipboard(text, colorBox, colors) {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      const feedbackElement = document.createElement("div");
      feedbackElement.className = "copy-feedback";
      feedbackElement.textContent = "Copied!";
      colorBox.appendChild(feedbackElement);
      setTimeout(() => colorBox.removeChild(feedbackElement), 1500);
      createConfetti(colors);
    })
    .catch((err) => {
      console.error("Failed to copy: ", err);
    });
}

function displayError(message) {
  const palette = document.getElementById("palette");
  palette.innerHTML = `
          <div class="error-message">
              <p>Error: ${formatErrorMessage(message)}</p>
              <p class="error-hint">Please try again in a few moments.</p>
          </div>
      `;
  palette.classList.remove("grid");
}


function formatErrorMessage(message) {
  if (message.includes("MAX_CAPTURE_VISIBLE_TAB_CALLS")) {
    return "Too many requests. Please wait a moment before trying again.";
  }
  return message;
}

function createConfetti(colors) {
  const confettiContainer = document.createElement("div");
  confettiContainer.style.position = "fixed";
  confettiContainer.style.top = "0";
  confettiContainer.style.left = "0";
  confettiContainer.style.width = "100%";
  confettiContainer.style.height = "100%";
  confettiContainer.style.pointerEvents = "none";
  document.body.appendChild(confettiContainer);

  const confettiCount = 50;
  const gravity = 0.5;
  const terminalVelocity = 5;
  const drag = 0.075;
  const confettis = [];

  for (let i = 0; i < confettiCount; i++) {
    const color = colors[Math.floor(Math.random() * colors.length)];
    const confetti = {
      color: `rgb(${color[0]}, ${color[1]}, ${color[2]})`,
      dimensions: {
        x: Math.random() * 10 + 5,
        y: Math.random() * 10 + 5,
      },
      position: {
        x: Math.random() * window.innerWidth,
        y: -20,
      },
      rotation: Math.random() * 360,
      scale: {
        x: 1,
        y: 1,
      },
      velocity: {
        x: Math.random() * 6 - 3,
        y: Math.random() * -15 - 15,
      },
    };
    confettis.push(confetti);
  }

  function updateConfetti() {
    confettiContainer.innerHTML = "";
    confettis.forEach((confetti, index) => {
      confetti.velocity.x +=
        Math.random() > 0.5 ? Math.random() : -Math.random();
      confetti.velocity.y += gravity;
      confetti.velocity.x *= drag;
      confetti.velocity.y = Math.min(confetti.velocity.y, terminalVelocity);
      confetti.position.x += confetti.velocity.x;
      confetti.position.y += confetti.velocity.y;
      confetti.scale.y = Math.cos(
        (confetti.position.y + confetti.rotation) * 0.1
      );

      const confettiElement = document.createElement("div");
      confettiElement.style.position = "absolute";
      confettiElement.style.width = `${confetti.dimensions.x}px`;
      confettiElement.style.height = `${confetti.dimensions.y}px`;
      confettiElement.style.backgroundColor = confetti.color;
      confettiElement.style.transform = `translate3d(${confetti.position.x}px, ${confetti.position.y}px, 0) rotate(${confetti.rotation}deg) scale(${confetti.scale.x}, ${confetti.scale.y})`;
      confettiContainer.appendChild(confettiElement);

      if (confetti.position.y >= window.innerHeight) {
        confettis.splice(index, 1);
      }
    });

    if (confettis.length > 0) {
      requestAnimationFrame(updateConfetti);
    } else {
      document.body.removeChild(confettiContainer);
    }
  }

  requestAnimationFrame(updateConfetti);
}

function createRipple(event) {
  const button = event.currentTarget;
  const rippleContainer = button.nextElementSibling;
  const circle = document.createElement("span");
  const diameter = Math.max(button.clientWidth, button.clientHeight);
  const radius = diameter / 2;

  circle.style.width = circle.style.height = `${diameter}px`;
  circle.style.left = `${event.clientX - button.offsetLeft - radius}px`;
  circle.style.top = `${event.clientY - button.offsetTop - radius}px`;
  circle.classList.add("ripple");

  const ripple = rippleContainer.getElementsByClassName("ripple")[0];

  if (ripple) {
    ripple.remove();
  }

  rippleContainer.appendChild(circle);
}

function createBubble() {
  const bubbleContainer = document.querySelector(".bubble-container");
  const bubble = document.createElement("div");
  bubble.classList.add("bubble");

  const size = Math.random() * 30 + 10;
  bubble.style.width = `${size}px`;
  bubble.style.height = `${size}px`;
  bubble.style.left = `${Math.random() * 100}%`;
  bubble.style.animationDuration = `${Math.random() * 2 + 2}s`;

  bubbleContainer.appendChild(bubble);

  setTimeout(() => {
    bubble.remove();
  }, 4000);
}

function startBubbleAnimation() {
  for (let i = 0; i < 10; i++) {
    setTimeout(createBubble, i * 300);
  }
}

function loadPalette(id) {
  const palette = extractedPalettes.find((p) => p.id === id);
  if (palette) {
    showMainView();
    displayColors(palette.colors);
  }
}

function savePalette(colors) {
  const newPalette = {
    id: Date.now(),
    colors: colors,
    date: new Date().toLocaleString(),
  };
  extractedPalettes.push(newPalette);
  localStorage.setItem("palettes", JSON.stringify(extractedPalettes));
}

function deletePalette(id) {
  extractedPalettes = extractedPalettes.filter((palette) => palette.id !== id);
  localStorage.setItem("palettes", JSON.stringify(extractedPalettes));
  showHistoryView(); 
}

function showHistoryView() {
  const content = document.querySelector(".content");
  content.innerHTML = `
    <h1>Color History</h1>
    <div id="historyList"></div>
    <button id="backButton">Back to Palette</button>
  `;

  const historyList = document.getElementById("historyList");
  extractedPalettes.forEach((palette) => {
    const paletteElement = document.createElement("div");
    paletteElement.className = "history-palette";
    paletteElement.innerHTML = `
      <div class="history-colors">
        ${palette.colors
          .map(
            (color) => `
          <div class="history-color" style="background-color: rgb(${color.join(
            ","
          )})"></div>
        `
          )
          .join("")}
      </div>
      <div class="history-actions">
        <button class="load-palette" data-id="${palette.id}">Load</button>
        <div class="history-date">${palette.date}</div>
        <button class="delete-palette" data-id="${palette.id}">Delete</button>
      </div>
    `;
    paletteElement
      .querySelector(".load-palette")
      .addEventListener("click", (e) => {
        e.stopPropagation();
        loadPalette(palette.id);
      });
    paletteElement
      .querySelector(".delete-palette")
      .addEventListener("click", (e) => {
        e.stopPropagation();
        deletePalette(palette.id);
      });
    historyList.appendChild(paletteElement);
  });

  document.getElementById("backButton").addEventListener("click", showMainView);
}

function showMainView() {
  const content = document.querySelector(".content");
  content.innerHTML = `
    <h1>Palettes & Hues 🎨</h1>
    <p class="instruction-text">Click on any color to copy its HEX code.</p>
    <div id="palette">
      <p class="initial-text">
        Click the <b>Extract Palette</b> button below to extract colors from
        the current page's visible area, use the <b>Color Picker</b> to select a specific color,
        or load & extract from history.
      </p>
    </div>
    <button id="analyzeButton">Extract Palette 🎨</button>
    <button id="randomPaletteButton">Random Palette 🎲</button>
    <button id="colorPickerButton">Color Picker 🔍</button>
    <button id="importImageButton">Upload Image 🖼️</button>
    <button id="historyButton">View History 📜</button>
    <button id="exportButton">Export Palette 📤</button>
    <button id="importButton">Import Palette 📥</button>
    <button id="buyMeACoffeeButton">
      <a href="https://www.buymeacoffee.com/bymayanksingh" target="_blank">
        Buy me a Coffee ☕
      </a>
    </button>
    <button id="reviewButton">
      <a href="https://chromewebstore.google.com/detail/palettes-hues-%F0%9F%8E%A8/miokoikjlpbhhfepkneagdjmgakendep/reviews" target="_blank">
        Leave a Review ⭐
      </a>
    </button>
    <input type="file" id="fileInput" accept=".cp,.json,.csv" style="display: none;">
    <input type="file" id="imageInput" accept="image/*" style="display: none;">
    <div id="imagePreviewContainer" style="display: none;">
      <img id="imagePreview" src="" alt="Imported Image">
      <button id="extractColorsButton">EXTRACT DOMINANT COLORS 🎨</button>
      <button id="pickColorsButton">PICK COLORS (MAX 6) 🔍</button>
    </div>
  `;

  
  attachEventListeners();
}


function removeImage() {
  const imagePreviewContainer = document.getElementById("imagePreviewContainer");
  
  // Clear the contents of the container
  imagePreviewContainer.innerHTML = '';
  imagePreviewContainer.style.display = "none";
  
  // Reset the palette to its initial state
  resetPalette();
}


function resetPalette() {
  const palette = document.getElementById("palette");
  if (palette) {
    palette.innerHTML = `
      <p class="initial-text">
        Click the <b>Extract Palette</b> button below to extract colors from
        the current page's visible area, use the <b>Color Picker</b> to select a specific color,
        or load & extract from history.
      </p>
    `;
    palette.classList.remove("grid");
  }

  // Hide the export button
  const exportButton = document.getElementById("exportButton");
  if (exportButton) {
    exportButton.style.display = "none";
  }
}


function loadPalettes() {
  const storedPalettes = localStorage.getItem("palettes");
  if (storedPalettes) {
    extractedPalettes = JSON.parse(storedPalettes);
  }
}


document.addEventListener("DOMContentLoaded", () => {
  keepPopupOpen();
  loadPalettes();
  attachEventListeners();

  showScrollNudge();
});

function attachEventListeners() {

  const analyzeButton = document.getElementById("analyzeButton");
  if (analyzeButton) {
    analyzeButton.addEventListener("click", () => {
      startBubbleAnimation();
      getPageColors();
    });
  }


  const randomPaletteButton = document.getElementById("randomPaletteButton");
  if (randomPaletteButton) {
    randomPaletteButton.addEventListener("click", () => {
      startBubbleAnimation();
      generateRandomPalette();
    });
  }

  const exportButton = document.getElementById("exportButton");
  if (exportButton) {
    exportButton.addEventListener("click", showExportOptions);
  }

  const importButton = document.getElementById("importButton");
  if (importButton) {
    importButton.addEventListener("click", () => {
      createUploadWindow("palette");
    });
  }

  const fileInput = document.getElementById("fileInput");
  if (fileInput) {
    fileInput.addEventListener("change", (event) => {
      const file = event.target.files[0];
      if (file) {
        importPalette(file);
      }
    });

    const importImageButton = document.getElementById("importImageButton");
    if (importImageButton) {
      importImageButton.addEventListener("click", () => {
        createUploadWindow("image");
      });
    }

    const imageInput = document.getElementById("imageInput");
    if (imageInput) {
      imageInput.addEventListener("change", (event) => {
        const file = event.target.files[0];
        if (file) {
          previewImage(file);
        }
      });
    }

    const extractColorsButton = document.getElementById("extractColorsButton");
    if (extractColorsButton) {
      extractColorsButton.addEventListener("click", extractDominantColors);
    }

    const pickColorsButton = document.getElementById("pickColorsButton");
    if (pickColorsButton) {
      pickColorsButton.addEventListener("click", activateImageColorPicker);
    }

    const removeImageButton = document.getElementById("removeImageButton");
    if (removeImageButton) {
      removeImageButton.addEventListener("click", removeImage);
    }
  }

  
  window.addEventListener("blur", keepPopupOpen);

  const historyButton = document.getElementById("historyButton");
  if (historyButton) {
    historyButton.addEventListener("click", showHistoryView);
  }

  const colorPickerButton = document.getElementById("colorPickerButton");
  if (colorPickerButton) {
    colorPickerButton.addEventListener("click", activateColorPicker);
  }
}

function scrollToImagePreview() {
  const imagePreviewContainer = document.getElementById(
    "imagePreviewContainer"
  );
  if (imagePreviewContainer) {
    imagePreviewContainer.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }
}

function previewImage(file, imageData) {
  resetPalette();

  const imagePreviewContainer = document.getElementById("imagePreviewContainer");
  imagePreviewContainer.innerHTML = `
    <img id="imagePreview" src="${imageData}" alt="Imported Image">
    <button id="removeImageButton">&times;</button>
    <button id="extractColorsButton">EXTRACT DOMINANT COLORS 🎨</button>
    <button id="pickColorsButton">PICK COLORS (MAX 6) 🔍</button>
  `;
  
  const imagePreview = document.getElementById("imagePreview");
  imagePreview.onload = function () {
    imagePreviewContainer.style.display = "block";


    setTimeout(scrollToImagePreview, 100);


    const colorThief = new ColorThief();
    const palette = colorThief.getPalette(imagePreview, 6);
    addToHistory(palette, "Uploaded Image");


    attachImagePreviewListeners();
  };
  
  imagePreview.onerror = function () {
    console.error("Failed to load image");
    alert("Failed to load the image. Please try again.");
    removeImage();
  };
}

function attachImagePreviewListeners() {
  const removeImageButton = document.getElementById("removeImageButton");
  if (removeImageButton) {
    removeImageButton.addEventListener("click", removeImage);
  }

  const extractColorsButton = document.getElementById("extractColorsButton");
  if (extractColorsButton) {
    extractColorsButton.addEventListener("click", extractDominantColors);
  }

  const pickColorsButton = document.getElementById("pickColorsButton");
  if (pickColorsButton) {
    pickColorsButton.addEventListener("click", activateImageColorPicker);
  }
}


function addToHistory(colors, source) {
  const newPalette = {
    id: Date.now(),
    colors: colors,
    date: new Date().toLocaleString(),
    source: source,
  };
  extractedPalettes.push(newPalette);
  localStorage.setItem("palettes", JSON.stringify(extractedPalettes));
}

function extractDominantColors() {
  const imagePreview = document.getElementById("imagePreview");
  const colorThief = new ColorThief();
  const palette = colorThief.getPalette(imagePreview, 6);
  displayColors(palette);
}

function activateImageColorPicker() {
  const imagePreview = document.getElementById("imagePreview");
  createColorPickerModal(imagePreview.src);
}

function activateColorPicker() {
  captureVisibleTab().then((dataUrl) => {
    createColorPickerModal(dataUrl);
  });
}

function updateUIForActiveColorPicker() {
  const colorPickerButton = document.getElementById("colorPickerButton");
  if (colorPickerButton) {
    colorPickerButton.textContent = "Picking Color...";
    colorPickerButton.disabled = true;
  }

  const palette = document.getElementById("palette");
  if (palette) {
    palette.innerHTML =
      '<p class="instruction-text">Click anywhere on the page to pick a color.</p>';
  }
}

function resetUIAfterColorPick() {
  const colorPickerButton = document.getElementById("colorPickerButton");
  if (colorPickerButton) {
    colorPickerButton.textContent = "Color Picker 🔍";
    colorPickerButton.disabled = false;
  }
}

/**
 * Displays the extracted colors in the popup interface.
 * @param {Array} colors - Array of RGB color arrays.
 */
function displayColors(colors) {
  const palette = document.getElementById("palette");
  if (!palette) {
    console.error("Palette element not found");
    return;
  }

  palette.innerHTML = "";
  palette.classList.add("grid");

  colors.forEach((color, index) => {
    const colorBox = document.createElement("div");
    colorBox.className = "color-box";
    colorBox.style.backgroundColor = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;

    const colorInfo = document.createElement("div");
    colorInfo.className = "color-info";

    const hexText = document.createElement("div");
    const hexCode = rgbToHex(color[0], color[1], color[2]);
    hexText.textContent = hexCode;
    hexText.className = "color-hex";

    const colorName = document.createElement("div");
    colorName.textContent = getColorName(color);
    colorName.className = "color-name";

    colorInfo.appendChild(hexText);
    colorInfo.appendChild(colorName);
    colorBox.appendChild(colorInfo);

    colorBox.addEventListener("click", () =>
      copyToClipboard(hexCode, colorBox, colors)
    );
    palette.appendChild(colorBox);
  });


  const exportButton = document.getElementById("exportButton");
  if (exportButton) {
    exportButton.style.display = "block";
  }
}

function luminance(r, g, b) {
  const a = [r, g, b].map(function (v) {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

function contrastRatio(rgb1, rgb2) {
  const lum1 = luminance(rgb1[0], rgb1[1], rgb1[2]);
  const lum2 = luminance(rgb2[0], rgb2[1], rgb2[2]);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

function getWCAGCompliance(contrastRatio) {
  let compliance = {
    AA: { largeText: false, normalText: false },
    AAA: { largeText: false, normalText: false },
  };

  if (contrastRatio >= 4.5) {
    compliance.AA.normalText = true;
    compliance.AA.largeText = true;
  } else if (contrastRatio >= 3) {
    compliance.AA.largeText = true;
  }

  if (contrastRatio >= 7) {
    compliance.AAA.normalText = true;
    compliance.AAA.largeText = true;
  } else if (contrastRatio >= 4.5) {
    compliance.AAA.largeText = true;
  }

  return compliance;
}

function rgbToHsl(r, g, b) {
  (r /= 255), (g /= 255), (b /= 255);
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h,
    s,
    l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function rgbToCmyk(r, g, b) {
  let c, m, y, k;
  r = r / 255;
  g = g / 255;
  b = b / 255;

  k = Math.min(1 - r, 1 - g, 1 - b);
  c = (1 - r - k) / (1 - k) || 0;
  m = (1 - g - k) / (1 - k) || 0;
  y = (1 - b - k) / (1 - k) || 0;

  return [
    Math.round(c * 100),
    Math.round(m * 100),
    Math.round(y * 100),
    Math.round(k * 100),
  ];
}

/**
 * Gets the name of the color closest to the given RGB values.
 * @param {Array} rgb - Array of RGB values [r, g, b].
 * @return {string} The name of the closest color.
 */
function getColorName(rgb) {
  const color = ntc.name(rgbToHex(rgb[0], rgb[1], rgb[2]));
  return color[1];
}

function closeExportOptions() {
  const exportOptions = document.getElementById("exportOptions");
  if (exportOptions) {
    exportOptions.remove();
  }
}

function showExportOptions() {
  const exportOptions = document.createElement("div");
  exportOptions.id = "exportOptions";
  exportOptions.innerHTML = `
      <div class="export-header">
        <h3>Export</h3>
        <button id="closeExportOptions" class="close-button">&times;</button>
      </div>
      <button id="exportCSV">CSV</button>
      <button id="exportJSON">JSON</button>
      <button id="exportPNG">PNG</button>
      <button id="exportJPG">JPG</button>
      <button id="exportCP">CP</button>
    `;
  document.body.appendChild(exportOptions);

  document
    .getElementById("exportCSV")
    .addEventListener("click", () => exportPalette("csv"));
  document
    .getElementById("exportJSON")
    .addEventListener("click", () => exportPalette("json"));
  document
    .getElementById("exportPNG")
    .addEventListener("click", () => exportPalette("png"));
  document
    .getElementById("exportJPG")
    .addEventListener("click", () => exportPalette("jpg"));
  document
    .getElementById("exportCP")
    .addEventListener("click", () => exportPalette("cp"));
  document
    .getElementById("closeExportOptions")
    .addEventListener("click", closeExportOptions);
}

function exportPalette(format) {
  const colors = Array.from(document.querySelectorAll(".color-box")).map(
    (box) => {
      const rgb = box.style.backgroundColor.match(/\d+/g).map(Number);
      const hex = rgbToHex(rgb[0], rgb[1], rgb[2]);
      const name = box.querySelector(".color-name").textContent;
      const hsl = rgbToHsl(rgb[0], rgb[1], rgb[2]);
      const cmyk = rgbToCmyk(rgb[0], rgb[1], rgb[2]);
      return { rgb, hex, name, hsl, cmyk };
    }
  );

  switch (format) {
    case "csv":
      exportCSV(colors);
      break;
    case "json":
      exportJSON(colors);
      break;
    case "png":
    case "jpg":
      exportImage(colors, format);
      break;
    case "cp":
      exportCP(colors);
      break;
  }
}

function parseJSONPalette(content) {
  try {
    const data = JSON.parse(content);
    if (data.format === "custompalettes") {
      return data.colors;
    } else {
      return data;
    }
  } catch (error) {
    console.error("Error parsing JSON:", error);
    alert(
      "Error parsing JSON file. Please make sure it's a valid palette file."
    );
    return null;
  }
}

function parseCSVPalette(content) {
  const lines = content.split("\n");
  const colors = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",");
    if (values.length >= 7) {
      colors.push({
        name: values[0],
        hex: values[1],
        rgb: [parseInt(values[2]), parseInt(values[3]), parseInt(values[4])],
        hsl: [parseInt(values[5]), parseInt(values[6]), parseInt(values[7])],
        cmyk: [
          parseInt(values[8]),
          parseInt(values[9]),
          parseInt(values[10]),
          parseInt(values[11]),
        ],
      });
    }
  }

  return colors;
}

function importPalette(file) {
  const reader = new FileReader();
  reader.onload = function (event) {
    const fileContent = event.target.result;
    let colors;

    if (file.name.endsWith(".cp") || file.name.endsWith(".json")) {
      colors = parseJSONPalette(fileContent);
    } else if (file.name.endsWith(".csv")) {
      colors = parseCSVPalette(fileContent);
    } else {
      alert("Unsupported file format. Please use .cp, .json, or .csv files.");
      return;
    }

    if (colors) {
      displayColors(colors.map((color) => color.rgb));
    }
  };

  reader.readAsText(file);
}

function exportCP(colors) {
  const cpData = {
    format: "custompalettes",
    version: "1.0",
    colors: colors,
  };
  const json = JSON.stringify(cpData, null, 2);
  downloadFile(json, "palette.cp", "application/json");
}

function exportCSV(colors) {
  let csv = "Name,Hex,R,G,B,H,S,L,C,M,Y,K\n";
  colors.forEach((color) => {
    csv += `${color.name},${color.hex},${color.rgb.join(",")},${color.hsl.join(
      ","
    )},${color.cmyk.join(",")}\n`;
  });
  downloadFile(csv, "palette.csv", "text/csv");
}

function exportJSON(colors) {
  const json = JSON.stringify(colors, null, 2);
  downloadFile(json, "palette.json", "application/json");
}

function exportImage(colors, format) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const boxSize = 100;
  const padding = 10;

  canvas.width = colors.length * (boxSize + padding) + padding;
  canvas.height = boxSize + 2 * padding;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  colors.forEach((color, index) => {
    const x = index * (boxSize + padding) + padding;
    const y = padding;

    ctx.fillStyle = color.hex;
    ctx.fillRect(x, y, boxSize, boxSize);

    ctx.fillStyle = "#000000";
    ctx.font = "12px Arial";
    ctx.fillText(color.hex, x + 5, y + boxSize - 25);
    ctx.fillText(color.name, x + 5, y + boxSize - 10);
  });

  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `palette.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  }, `image/${format}`);
}

function downloadFile(content, fileName, contentType) {
  const a = document.createElement("a");
  const file = new Blob([content], { type: contentType });
  a.href = URL.createObjectURL(file);
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(a.href);
}

function createUploadWindow(type) {
  const windowWidth = 400;
  const windowHeight = 300;
  const left = (screen.width - windowWidth) / 2;
  const top = (screen.height - windowHeight) / 2;

  const url = type === "image" ? "upload-image.html" : "import-palette.html";

  const uploadWindow = window.open(
    url,
    "uploadWindow",
    `width=${windowWidth},height=${windowHeight},left=${left},top=${top},resizable=yes,scrollbars=yes`
  );
}

window.addEventListener("message", function (event) {
  if (event.origin !== window.origin) return;

  if (event.data.type === "imageUploaded") {
    previewImage(event.data.file, event.data.imageData);
  } else if (event.data.type === "paletteImported") {
    importPalette(event.data.file);
  }
});


function generateRandomPalette() {
  const colors = [];

  for (let i = 0; i < 6; i++) {
    // Generate truly random HSL values
    const hue = Math.random() * 360;
    const saturation = Math.random() * 100;
    const lightness = Math.random() * 100;

    // Convert HSL to RGB
    const rgb = hslToRgb(hue/360, saturation/100, lightness/100);
    colors.push(rgb);
  }

  displayColors(colors);
  savePalette(colors);
}


function hslToRgb(h, s, l) {
  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}