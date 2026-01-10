const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const shapeSel = document.getElementById("shape");
const colorPicker = document.getElementById("colorPicker");
const sizePicker = document.getElementById("sizePicker");
const newSheetBtn = document.getElementById("newSheet");
const sheetSelect = document.getElementById("sheetSelect");
const exportBtn = document.getElementById("exportPdf");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight - 50;

ctx.lineCap = "round";
ctx.lineJoin = "round";

let tool = "pen";
let drawing = false;

let sheets = [[]];
let currentSheet = 0;
let strokes = sheets[currentSheet];

let current = null;
let startX = 0, startY = 0;

/* ===== Tool Buttons ===== */
document.getElementById("pen").onclick = () => tool = "pen";
document.getElementById("eraser").onclick = () => tool = "eraser";
shapeSel.onchange = () => tool = shapeSel.value;

/* ===== Sheet System ===== */
function updateSheetList(){
  sheetSelect.innerHTML="";
  sheets.forEach((_,i)=>{
    let opt=document.createElement("option");
    opt.value=i;
    opt.text="Sheet "+(i+1);
    sheetSelect.appendChild(opt);
  });
  sheetSelect.value=currentSheet;
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
function getPos(e){
  const rect = canvas.getBoundingClientRect();
  if(e.touches){
    return {
      x: e.touches[0].clientX - rect.left,
      y: e.touches[0].clientY - rect.top
    };
  }
  return { x: e.offsetX, y: e.offsetY };
}

/* ===== Unified Events ===== */
canvas.addEventListener("mousedown", startDraw);
canvas.addEventListener("mousemove", moveDraw);
canvas.addEventListener("mouseup", endDraw);
canvas.addEventListener("touchstart", startDraw,{passive:false});
canvas.addEventListener("touchmove", moveDraw,{passive:false});
canvas.addEventListener("touchend", endDraw);

/* ===== Drawing Logic ===== */
function startDraw(e){
  e.preventDefault();
  drawing = true;
  const pos = getPos(e);
  startX = pos.x;
  startY = pos.y;

  if(tool === "pen"){
    current = {
      color: colorPicker.value,
      size: sizePicker.value,
      points: [{ x: startX, y: startY }]
    };
    strokes.push(current);
  }
}

function moveDraw(e){
  if(!drawing) return;
  e.preventDefault();
  const pos = getPos(e);

  if(tool === "eraser"){
    erase(pos.x,pos.y);
    return;
  }

  if(!current) return;

  current.points.push(pos);
  ctx.strokeStyle = current.color;
  ctx.lineWidth = current.size;

  const pts = current.points;
  ctx.beginPath();
  ctx.moveTo(pts[pts.length-2].x,pts[pts.length-2].y);
  ctx.lineTo(pos.x,pos.y);
  ctx.stroke();
}

function endDraw(e){
  drawing=false;
  if(["line","rect","circle"].includes(tool)){
    const pos=getPos(e);
    strokes.push({
      tool,
      color:colorPicker.value,
      size:sizePicker.value,
      p1:{x:startX,y:startY},
      p2:{x:pos.x,y:pos.y}
    });
    redraw();
  }
  current=null;
}

/* ===== Redraw ===== */
function redraw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  strokes.forEach(s=>{
    ctx.strokeStyle=s.color||"#000";
    ctx.lineWidth=s.size||2;

    if(s.points){
      ctx.beginPath();
      ctx.moveTo(s.points[0].x,s.points[0].y);
      s.points.forEach(p=>ctx.lineTo(p.x,p.y));
      ctx.stroke();
    }else if(s.tool==="line"){
      ctx.beginPath();
      ctx.moveTo(s.p1.x,s.p1.y);
      ctx.lineTo(s.p2.x,s.p2.y);
      ctx.stroke();
    }else if(s.tool==="rect"){
      ctx.strokeRect(s.p1.x,s.p1.y,s.p2.x-s.p1.x,s.p2.y-s.p1.y);
    }else if(s.tool==="circle"){
      let r=Math.hypot(s.p2.x-s.p1.x,s.p2.y-s.p1.y);
      ctx.beginPath();
      ctx.arc(s.p1.x,s.p1.y,r,0,Math.PI*2);
      ctx.stroke();
    }
  });
}

/* ===== Eraser ===== */
function erase(x,y){
  strokes = sheets[currentSheet] = strokes.filter(stroke => {

    // Pen strokes
    if(stroke.points){
      for(let i=0;i<stroke.points.length-1;i++){
        if(distToSeg(x,y,stroke.points[i],stroke.points[i+1]) < 8) return false;
      }
      return true;
    }

    // Line
    if(stroke.tool === "line"){
      if(distToSeg(x,y,stroke.p1,stroke.p2) < 8) return false;
      return true;
    }

    // Rectangle
    if(stroke.tool === "rect"){
      let {p1,p2} = stroke;
      if(
        distToSeg(x,y,{x:p1.x,y:p1.y},{x:p2.x,y:p1.y}) < 8 ||
        distToSeg(x,y,{x:p2.x,y:p1.y},{x:p2.x,y:p2.y}) < 8 ||
        distToSeg(x,y,{x:p2.x,y:p2.y},{x:p1.x,y:p2.y}) < 8 ||
        distToSeg(x,y,{x:p1.x,y:p2.y},{x:p1.x,y:p1.y}) < 8
      ) return false;
      return true;
    }

    // Circle
    if(stroke.tool === "circle"){
      let r = Math.hypot(stroke.p2.x-stroke.p1.x, stroke.p2.y-stroke.p1.y);
      let d = Math.hypot(x-stroke.p1.x, y-stroke.p1.y);
      if(Math.abs(d-r) < 8) return false;
      return true;
    }

    return true;
  });

  redraw();
}


function distToSeg(px,py,a,b){
  let A=px-a.x,B=py-a.y,C=b.x-a.x,D=b.y-a.y;
  let dot=A*C+B*D,len=C*C+D*D;
  let t=Math.max(0,Math.min(1,dot/len));
  let ex=a.x+t*C,ey=a.y+t*D;
  return Math.hypot(px-ex,py-ey);
}

/* ===== PDF EXPORT ===== */
// ... KEEP ALL YOUR EXISTING CODE ABOVE THIS LINE ...

/* ===== EXPORT ALL SHEETS TO ONE PDF ===== */
exportBtn.onclick = () => {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF("landscape", "px", [canvas.width, canvas.height]);

  const originalSheet = currentSheet;

  sheets.forEach((sheet, index) => {
    strokes = sheets[index];
    redraw();

    const imgData = canvas.toDataURL("image/png");
    if (index > 0) pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
  });

  // restore current working sheet
  strokes = sheets[originalSheet];
  redraw();

  pdf.save("Whiteboard_All_Sheets.pdf");
};

