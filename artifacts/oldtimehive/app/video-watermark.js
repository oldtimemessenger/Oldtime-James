// Burned into encoded frames, never a CSS overlay or a removable editor layer.
export function drawOldtimeWatermark(canvas) {
  const context=canvas.getContext("2d");
  const size=Math.max(12,Math.round(canvas.width*.043));
  const inset=Math.max(12,Math.round(canvas.width*.035));
  context.save();
  context.font=`600 ${size}px system-ui, -apple-system, sans-serif`;
  context.textAlign="right";context.textBaseline="bottom";
  context.lineJoin="round";context.lineWidth=Math.max(2,size*.09);
  context.strokeStyle="rgba(0,0,0,.65)";context.fillStyle="#fff";
  context.strokeText("Oldtime",canvas.width-inset,canvas.height-inset);
  context.fillText("Oldtime",canvas.width-inset,canvas.height-inset);
  context.restore();
}
