window.toggleSignatureView = toggleSignatureView;
window.previewSignature = previewSignature;
window.addSignatureFromPreview = addSignatureFromPreview;
window.addDraggableFromPad = addDraggableFromPad;
window.addDraggableFromText = addDraggableFromText;
window.goToFirstOrLastPage = goToFirstOrLastPage;

let currentPreviewSrc = null;

function toggleSignatureView() {
  const gridView = document.getElementById('gridView');
  const listView = document.getElementById('listView');
  const gridText = document.querySelector('.grid-view-text');
  const listText = document.querySelector('.list-view-text');

  if (gridView.style.display !== 'none') {
    gridView.style.display = 'none';
    listView.style.display = 'block';
    gridText.style.display = 'none';
    listText.style.display = 'inline';
  } else {
    gridView.style.display = 'block';
    listView.style.display = 'none';
    gridText.style.display = 'inline';
    listText.style.display = 'none';
  }
}

function previewSignature(element) {
  const src = element.dataset.src;
  currentPreviewSrc = src;

  const filename = element.querySelector('.signature-list-name').textContent;

  const previewImage = document.getElementById('previewImage');
  const previewFileName = document.getElementById('previewFileName');

  previewImage.src = src;
  previewFileName.textContent = filename;

  const modal = new bootstrap.Modal(document.getElementById('signaturePreview'));
  modal.show();
}

function addSignatureFromPreview() {
  if (currentPreviewSrc) {
    DraggableUtils.createDraggableCanvasFromUrl(currentPreviewSrc);
    bootstrap.Modal.getInstance(document.getElementById('signaturePreview')).hide();
  }
}

let originalFileName = '';
document.querySelector('input[name=pdf-upload]').addEventListener('change', async (event) => {
  const fileInput = event.target;
  fileInput.addEventListener('file-input-change', async (e) => {
    const {allFiles} = e.detail;
    if (allFiles && allFiles.length > 0) {
      const file = allFiles[0];
      originalFileName = file.name.replace(/\.[^/.]+$/, '');
      const pdfData = await file.arrayBuffer();
      pdfjsLib.GlobalWorkerOptions.workerSrc = './pdfjs-legacy/pdf.worker.mjs';
      const pdfDoc = await pdfjsLib.getDocument({data: pdfData}).promise;
      await DraggableUtils.renderPage(pdfDoc, 0);

      document.querySelectorAll('.show-on-file-selected').forEach((el) => {
        el.style.cssText = '';
      });
    }
  });
});

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.show-on-file-selected').forEach((el) => {
    el.style.cssText = 'display:none !important';
  });
  document.querySelectorAll('.small-file-container-saved img ').forEach((img) => {
    img.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('fileUrl', img.src);
    });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Delete') {
      DraggableUtils.deleteDraggableCanvas(DraggableUtils.getLastInteracted());
    }
  });
});

const imageUpload = document.querySelector('input[name=image-upload]');
imageUpload.addEventListener('change', (e) => {
  if (!e.target.files) return;
  for (const imageFile of e.target.files) {
    var reader = new FileReader();
    reader.readAsDataURL(imageFile);
    reader.onloadend = function (e) {
      DraggableUtils.createDraggableCanvasFromUrl(e.target.result);
    };
  }
});

const signaturePadCanvas = document.getElementById('drawing-pad-canvas');
const signaturePad = new SignaturePad(signaturePadCanvas, {
  minWidth: 1,
  maxWidth: 2,
  penColor: 'black',
});

function addDraggableFromPad() {
  if (signaturePad.isEmpty()) return;
  const startTime = Date.now();
  const croppedDataUrl = getCroppedCanvasDataUrl(signaturePadCanvas);
  console.log(Date.now() - startTime);
  DraggableUtils.createDraggableCanvasFromUrl(croppedDataUrl);
}

function getCroppedCanvasDataUrl(canvas) {
  let originalCtx = canvas.getContext('2d');
  let originalWidth = canvas.width;
  let originalHeight = canvas.height;
  let imageData = originalCtx.getImageData(0, 0, originalWidth, originalHeight);

  let minX = originalWidth + 1,
    maxX = -1,
    minY = originalHeight + 1,
    maxY = -1,
    x = 0,
    y = 0,
    currentPixelColorValueIndex;

  for (y = 0; y < originalHeight; y++) {
    for (x = 0; x < originalWidth; x++) {
      currentPixelColorValueIndex = (y * originalWidth + x) * 4;
      let currentPixelAlphaValue = imageData.data[currentPixelColorValueIndex + 3];
      if (currentPixelAlphaValue > 0) {
        if (minX > x) minX = x;
        if (maxX < x) maxX = x;
        if (minY > y) minY = y;
        if (maxY < y) maxY = y;
      }
    }
  }

  let croppedWidth = maxX - minX;
  let croppedHeight = maxY - minY;
  if (croppedWidth < 0 || croppedHeight < 0) return null;
  let cuttedImageData = originalCtx.getImageData(minX, minY, croppedWidth, croppedHeight);

  let croppedCanvas = document.createElement('canvas'),
    croppedCtx = croppedCanvas.getContext('2d');

  croppedCanvas.width = croppedWidth;
  croppedCanvas.height = croppedHeight;
  croppedCtx.putImageData(cuttedImageData, 0, 0);

  return croppedCanvas.toDataURL();
}

function resizeCanvas() {
  var ratio = Math.max(window.devicePixelRatio || 1, 1);
  var additionalFactor = 10;

  signaturePadCanvas.width = signaturePadCanvas.offsetWidth * ratio * additionalFactor;
  signaturePadCanvas.height = signaturePadCanvas.offsetHeight * ratio * additionalFactor;
  signaturePadCanvas.getContext('2d').scale(ratio * additionalFactor, ratio * additionalFactor);

  signaturePad.clear();
}

new IntersectionObserver((entries, observer) => {
  if (entries.some((entry) => entry.intersectionRatio > 0)) {
    resizeCanvas();
  }
}).observe(signaturePadCanvas);

new ResizeObserver(resizeCanvas).observe(signaturePadCanvas);

function addDraggableFromText() {
  const sigText = document.getElementById('sigText').value;
  const font = document.querySelector('select[name=font]').value;
  const fontSize = 100;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = `${fontSize}px ${font}`;
  const textWidth = ctx.measureText(sigText).width;
  const textHeight = fontSize;

  let paragraphs = sigText.split(/\r?\n/);

  canvas.width = textWidth;
  canvas.height = paragraphs.length * textHeight * 1.35; // for tails
  ctx.font = `${fontSize}px ${font}`;

  ctx.textBaseline = 'top';

  let y = 0;

  paragraphs.forEach((paragraph) => {
    ctx.fillText(paragraph, 0, y);
    y += fontSize;
  });

  const dataURL = canvas.toDataURL();
  DraggableUtils.createDraggableCanvasFromUrl(dataURL);
}

async function goToFirstOrLastPage(page) {
  if (page) {
    const lastPage = DraggableUtils.pdfDoc.numPages;
    await DraggableUtils.goToPage(lastPage - 1);
  } else {
    await DraggableUtils.goToPage(0);
  }
}

document.getElementById('download-pdf').addEventListener('click', async () => {
  const downloadButton = document.getElementById('download-pdf');
  const originalContent = downloadButton.innerHTML;

  downloadButton.disabled = true;
  downloadButton.innerHTML = `
    <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
  `;

  try {
    const modifiedPdf = await DraggableUtils.getOverlayedPdfDocument();
    const modifiedPdfBytes = await modifiedPdf.save();
    const blob = new Blob([modifiedPdfBytes], {type: 'application/pdf'});
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = originalFileName + '_signed.pdf';
    link.click();
  } catch (error) {
    console.error('Error downloading PDF:', error);
  } finally {
    downloadButton.disabled = false;
    downloadButton.innerHTML = originalContent;
  }
});
