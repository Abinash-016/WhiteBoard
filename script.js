const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const shapeSel = document.getElementById("shape");
const colorPicker = document.getElementById("colorPicker");
const sizePicker = document.getElementById("sizePicker");
const newSheetBtn = document.getElementById("newSheet");
const sheetSelect = document.getElementById("sheetSelect");
const exportBtn = document.getElementById("exportPdf");
const lassoMenu = document.getElementById("lassoMenu");
const deleteSel = document.getElementById("deleteSel");
const cancelSel = document.getElementById("cancelSel");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight - 50;
function resizeCanvas(){
  const prev = ctx.getImageData(0,0,canvas.width,canvas.height);

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight - 80;

  ctx.putImageData(prev,0,0);
  redraw();
}


ctx.lineCap = "round";
ctx.lineJoin = "round";

let tool = "pen";
let drawing = false;

let lassoPoints = [];
let selectedStrokes = [];
let movingSelection = false;
let lastMove = null;

let sheets = [[]];
let currentSheet = 0;
let strokes = sheets[currentSheet];

let current = null;
let startX = 0,
  startY = 0;

/* ===== Tool Buttons ===== */
document.getElementById("pen").onclick = () => (tool = "pen");
document.getElementById("eraser").onclick = () => (tool = "eraser");
shapeSel.onchange = () => (tool = shapeSel.value);
document.getElementById("lasso").onclick = () => (tool = "lasso");

/* ===== Sheet System ===== */
function updateSheetList() {
  sheetSelect.innerHTML = "";
  sheets.forEach((_, i) => {
    let opt = document.createElement("option");
    opt.value = i;
    opt.text = "Sheet " + (i + 1);
    sheetSelect.appendChild(opt);
  });
  sheetSelect.value = currentSheet;
}

newSheetBtn.onclick = () => {
  sheets.push([]);
  currentSheet = sheets.length - 1;
  strokes = sheets[currentSheet];
  updateSheetList();
  redraw();
};

sheetSelect.onchange = () => {
  currentSheet = sheetSelect.value;
  strokes = sheets[currentSheet];
  redraw();
};

updateSheetList();

/* ===== Position Helper ===== */
function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  if (e.touches) {
    return {
      x: e.touches[0].clientX - rect.left,
      y: e.touches[0].clientY - rect.top,
    };
  }
  return { x: e.offsetX, y: e.offsetY };
}

/* ===== Unified Events ===== */
canvas.addEventListener("mousedown", startDraw);
canvas.addEventListener("mousemove", moveDraw);
canvas.addEventListener("mouseup", endDraw);
canvas.addEventListener("touchstart", startDraw, { passive: false });
canvas.addEventListener("touchmove", moveDraw, { passive: false });
canvas.addEventListener("touchend", endDraw);

/* ===== Drawing Logic ===== */
function startDraw(e) {
  e.preventDefault();
  drawing = true;
  const pos = getPos(e);
  startX = pos.x;
  startY = pos.y;

  if (tool === "lasso") {
    const p = getPos(e);

    if (selectedStrokes.length) {
      movingSelection = true;
      lastMove = p;
      return;
    }

    lassoMenu.style.display = "none";
    selectedStrokes = [];
    lassoPoints = [p];
    return;
  }

  if (tool === "pen") {
    current = {
      color: colorPicker.value,
      size: sizePicker.value,
      points: [{ x: startX, y: startY }],
    };
    strokes.push(current);
  }
}

function moveDraw(e) {
  if (!drawing) return;
  e.preventDefault();
  const pos = getPos(e);

  if (tool === "eraser") {
    showDust(pos.x, pos.y);
    erase(pos.x, pos.y);
    return;
  }
  if (tool === "lasso") {
    if (movingSelection) {
      const p = getPos(e);
      const dx = p.x - lastMove.x;
      const dy = p.y - lastMove.y;

      selectedStrokes.forEach((s) => {
        if (s.points)
          s.points.forEach((pt) => {
            pt.x += dx;
            pt.y += dy;
          });
        if (s.p1) {
          s.p1.x += dx;
          s.p1.y += dy;
          s.p2.x += dx;
          s.p2.y += dy;
        }
      });

      lastMove = p;
      redraw();
      return;
    }

    lassoPoints.push(getPos(e));
    redraw();

    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = "#60a5fa";
    ctx.beginPath();
    ctx.moveTo(lassoPoints[0].x, lassoPoints[0].y);
    lassoPoints.forEach((pt) => ctx.lineTo(pt.x, pt.y));
    ctx.stroke();
    ctx.setLineDash([]);
    return;
  }

  if (!current) return;

  current.points.push(pos);
  ctx.strokeStyle = current.color;
  ctx.lineWidth = current.size;

  const pts = current.points;
  ctx.beginPath();
  ctx.moveTo(pts[pts.length - 2].x, pts[pts.length - 2].y);
  ctx.lineTo(pos.x, pos.y);
  ctx.stroke();
}

function endDraw(e) {
  drawing = false;

  if (tool === "lasso") {
    if (!movingSelection) applyLasso();
    movingSelection = false;
    lassoPoints = [];
    redraw();
    return;
  }

  if (["line", "rect", "circle"].includes(tool)) {
    const pos = getPos(e);
    strokes.push({
      tool,
      color: colorPicker.value,
      size: sizePicker.value,
      p1: { x: startX, y: startY },
      p2: { x: pos.x, y: pos.y },
    });
    redraw();
  }
  current = null;
}

/* ===== Redraw ===== */
function redraw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  strokes.forEach((s) => {
    ctx.strokeStyle = s.color || "#000";
    ctx.lineWidth = s.size || 2;

    if (s.points) {
      ctx.beginPath();
      ctx.moveTo(s.points[0].x, s.points[0].y);
      s.points.forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.stroke();
    } else if (s.tool === "line") {
      ctx.beginPath();
      ctx.moveTo(s.p1.x, s.p1.y);
      ctx.lineTo(s.p2.x, s.p2.y);
      ctx.stroke();
    } else if (s.tool === "rect") {
      ctx.strokeRect(s.p1.x, s.p1.y, s.p2.x - s.p1.x, s.p2.y - s.p1.y);
    } else if (s.tool === "circle") {
      let r = Math.hypot(s.p2.x - s.p1.x, s.p2.y - s.p1.y);
      ctx.beginPath();
      ctx.arc(s.p1.x, s.p1.y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  });
}

/* ===== Eraser ===== */
function erase(x, y) {
  strokes = sheets[currentSheet] = strokes.filter((stroke) => {
    // Pen strokes
    if (stroke.points) {
      for (let i = 0; i < stroke.points.length - 1; i++) {
        if (distToSeg(x, y, stroke.points[i], stroke.points[i + 1]) < 8)
          return false;
      }
      return true;
    }

    // Line
    if (stroke.tool === "line") {
      if (distToSeg(x, y, stroke.p1, stroke.p2) < 8) return false;
      return true;
    }

    // Rectangle
    if (stroke.tool === "rect") {
      let { p1, p2 } = stroke;
      if (
        distToSeg(x, y, { x: p1.x, y: p1.y }, { x: p2.x, y: p1.y }) < 8 ||
        distToSeg(x, y, { x: p2.x, y: p1.y }, { x: p2.x, y: p2.y }) < 8 ||
        distToSeg(x, y, { x: p2.x, y: p2.y }, { x: p1.x, y: p2.y }) < 8 ||
        distToSeg(x, y, { x: p1.x, y: p2.y }, { x: p1.x, y: p1.y }) < 8
      )
        return false;
      return true;
    }

    // Circle
    if (stroke.tool === "circle") {
      let r = Math.hypot(stroke.p2.x - stroke.p1.x, stroke.p2.y - stroke.p1.y);
      let d = Math.hypot(x - stroke.p1.x, y - stroke.p1.y);
      if (Math.abs(d - r) < 8) return false;
      return true;
    }

    return true;
  });

  redraw();
}

function applyLasso() {
  selectedStrokes = strokes.filter((stroke) => {
    if (stroke.points) return stroke.points.some((p) => inside(p, lassoPoints));
    if (stroke.p1)
      return inside(stroke.p1, lassoPoints) || inside(stroke.p2, lassoPoints);
    return false;
  });

  if (selectedStrokes.length) {
    const p = lassoPoints[0];
    lassoMenu.style.left = canvas.offsetLeft + p.x + "px";
    lassoMenu.style.top = canvas.offsetTop + p.y + "px";
    lassoMenu.style.display = "flex";
  }
}

function inside(p, poly) {
  let x = p.x,
    y = p.y,
    inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    let xi = poly[i].x,
      yi = poly[i].y;
    let xj = poly[j].x,
      yj = poly[j].y;
    let intersect =
      yi > y != yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function showDust(x, y) {
  for (let i = 0; i < 6; i++) {
    const d = document.createElement("div");
    d.className = "dust";
    d.style.left = canvas.offsetLeft + x + "px";
    d.style.top = canvas.offsetTop + y + "px";
    d.style.setProperty("--dx", Math.random() * 30 - 15 + "px");
    d.style.setProperty("--dy", Math.random() * 30 - 15 + "px");
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 600);
  }
}

function distToSeg(px, py, a, b) {
  let A = px - a.x,
    B = py - a.y,
    C = b.x - a.x,
    D = b.y - a.y;
  let dot = A * C + B * D,
    len = C * C + D * D;
  let t = Math.max(0, Math.min(1, dot / len));
  let ex = a.x + t * C,
    ey = a.y + t * D;
  return Math.hypot(px - ex, py - ey);
}

/* ===== PDF EXPORT ===== */
// ... KEEP ALL YOUR EXISTING CODE ABOVE THIS LINE ...

/* ===== EXPORT ALL SHEETS TO ONE PDF ===== */
exportBtn.onclick = () => {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF("landscape", "px", [canvas.width, canvas.height]);

  const originalSheet = currentSheet;

  sheets.forEach((sheet, index) => {

    const off = document.createElement("canvas");
    off.width = canvas.width;
    off.height = canvas.height;
    const octx = off.getContext("2d");

    octx.fillStyle = "#ffffff";
    octx.fillRect(0,0,off.width,off.height);

    // render strokes manually to offscreen canvas
    sheet.forEach(s=>{
      octx.strokeStyle = s.color || "#000";
      octx.lineWidth = s.size || 2;
      octx.lineCap="round";
      octx.lineJoin="round";

      if(s.points){
        octx.beginPath();
        octx.moveTo(s.points[0].x,s.points[0].y);
        s.points.forEach(p=>octx.lineTo(p.x,p.y));
        octx.stroke();
      }
      else if(s.tool==="line"){
        octx.beginPath();
        octx.moveTo(s.p1.x,s.p1.y);
        octx.lineTo(s.p2.x,s.p2.y);
        octx.stroke();
      }
      else if(s.tool==="rect"){
        octx.strokeRect(s.p1.x,s.p1.y,s.p2.x-s.p1.x,s.p2.y-s.p1.y);
      }
      else if(s.tool==="circle"){
        let r=Math.hypot(s.p2.x-s.p1.x,s.p2.y-s.p1.y);
        octx.beginPath();
        octx.arc(s.p1.x,s.p1.y,r,0,Math.PI*2);
        octx.stroke();
      }
    });

    const img = off.toDataURL("image/jpeg",0.75);

    if(index>0) pdf.addPage();
    pdf.addImage(img,"JPEG",0,0,canvas.width,canvas.height);
  });

  pdf.save("Whiteboard_All_Sheets.pdf");
};

deleteSel.onclick = () => {
  strokes = sheets[currentSheet] = strokes.filter(
    (s) => !selectedStrokes.includes(s)
  );
  selectedStrokes = [];
  lassoMenu.style.display = "none";
  redraw();
};

cancelSel.onclick = () => {
  selectedStrokes = [];
  lassoMenu.style.display = "none";
  redraw();
};
window.addEventListener("resize", resizeCanvas);
window.addEventListener("orientationchange", resizeCanvas);
