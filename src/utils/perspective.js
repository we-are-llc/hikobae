const VS = `
  attribute vec2 a_pos;
  void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FS = `
  precision highp float;
  uniform sampler2D u_tex;
  uniform vec2 u_res;
  uniform float u_H[9];
  void main() {
    vec2 uv = vec2(gl_FragCoord.x / u_res.x, 1.0 - gl_FragCoord.y / u_res.y);
    float sx = u_H[0]*uv.x + u_H[1]*uv.y + u_H[2];
    float sy = u_H[3]*uv.x + u_H[4]*uv.y + u_H[5];
    float sw = u_H[6]*uv.x + u_H[7]*uv.y + u_H[8];
    vec2 s = vec2(sx/sw, sy/sw);
    if (s.x < 0.0 || s.x > 1.0 || s.y < 0.0 || s.y > 1.0) {
      gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
    } else {
      gl_FragColor = texture2D(u_tex, s);
    }
  }
`;

// corners: [{x,y}] TL/TR/BR/BL as fractions [0,1] of image natural dimensions
// Returns canvas element with warped image
export function warpPerspective(imgEl, corners) {
  const nW = imgEl.naturalWidth;
  const nH = imgEl.naturalHeight;
  if (!nW || !nH) throw new Error('Image not loaded');

  // H maps dst [0,1]² → src [0,1]²
  const dstPts = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
  const H = computeHomography(corners, dstPts);
  if (H.some((v) => !isFinite(v))) throw new Error('Degenerate corners');

  const natCorners = corners.map(({ x, y }) => ({ x: x * nW, y: y * nH }));
  const { width: outW, height: outH } = computeOutputSize(natCorners);

  return renderWebGL(imgEl, H, outW, outH) ?? renderSoftware(imgEl, H, outW, outH);
}

function computeHomography(srcPts, dstPts) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const { x: dx, y: dy } = dstPts[i];
    const { x: sx, y: sy } = srcPts[i];
    A.push([dx, dy, 1, 0, 0, 0, -dx * sx, -dy * sx]); b.push(sx);
    A.push([0, 0, 0, dx, dy, 1, -dx * sy, -dy * sy]); b.push(sy);
  }
  return [...gaussSolve(A, b), 1];
}

function gaussSolve(A, b) {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let r = col + 1; r < n; r++)
      if (Math.abs(M[r][col]) > Math.abs(M[maxRow][col])) maxRow = r;
    [M[col], M[maxRow]] = [M[maxRow], M[col]];
    for (let r = col + 1; r < n; r++) {
      const f = M[r][col] / M[col][col];
      for (let k = col; k <= n; k++) M[r][k] -= f * M[col][k];
    }
  }
  const x = new Array(n);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = M[i][n];
    for (let j = i + 1; j < n; j++) x[i] -= M[i][j] * x[j];
    x[i] /= M[i][i];
  }
  return x;
}

function computeOutputSize(corners) {
  const [tl, tr, br, bl] = corners;
  const topW = Math.hypot(tr.x - tl.x, tr.y - tl.y);
  const botW = Math.hypot(br.x - bl.x, br.y - bl.y);
  const leftH = Math.hypot(bl.x - tl.x, bl.y - tl.y);
  const rightH = Math.hypot(br.x - tr.x, br.y - tr.y);
  return {
    width: Math.max(100, Math.round((topW + botW) / 2)),
    height: Math.max(100, Math.round((leftH + rightH) / 2)),
  };
}

function renderWebGL(img, H, outW, outH) {
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!gl) return null;

  const vs = mkShader(gl, gl.VERTEX_SHADER, VS);
  const fs = mkShader(gl, gl.FRAGMENT_SHADER, FS);
  if (!vs || !fs) return null;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER,
    new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  gl.uniform2f(gl.getUniformLocation(prog, 'u_res'), outW, outH);
  gl.uniform1fv(gl.getUniformLocation(prog, 'u_H'), new Float32Array(H));

  // Downscale texture if needed
  const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  let src = img;
  if (img.naturalWidth > maxTex || img.naturalHeight > maxTex) {
    const sc = maxTex / Math.max(img.naturalWidth, img.naturalHeight);
    const tmp = document.createElement('canvas');
    tmp.width = Math.floor(img.naturalWidth * sc);
    tmp.height = Math.floor(img.naturalHeight * sc);
    tmp.getContext('2d').drawImage(img, 0, 0, tmp.width, tmp.height);
    src = tmp;
  }

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.uniform1i(gl.getUniformLocation(prog, 'u_tex'), 0);

  gl.viewport(0, 0, outW, outH);
  gl.clearColor(1, 1, 1, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  return canvas;
}

function mkShader(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(s)); return null; }
  return s;
}

function renderSoftware(img, H, outW, outH) {
  const sc = document.createElement('canvas');
  sc.width = img.naturalWidth; sc.height = img.naturalHeight;
  sc.getContext('2d').drawImage(img, 0, 0);
  const sd = sc.getContext('2d').getImageData(0, 0, sc.width, sc.height);
  const dc = document.createElement('canvas');
  dc.width = outW; dc.height = outH;
  const dctx = dc.getContext('2d');
  const dd = dctx.createImageData(outW, outH);
  const sW = sc.width, sH = sc.height;

  for (let dy = 0; dy < outH; dy++) {
    const dv = dy / outH;
    for (let dx = 0; dx < outW; dx++) {
      const du = dx / outW;
      const w = H[6]*du + H[7]*dv + H[8];
      const su = (H[0]*du + H[1]*dv + H[2]) / w;
      const sv = (H[3]*du + H[4]*dv + H[5]) / w;
      const di = (dy * outW + dx) * 4;
      if (su < 0 || su > 1 || sv < 0 || sv > 1) {
        dd.data[di] = dd.data[di+1] = dd.data[di+2] = dd.data[di+3] = 255; continue;
      }
      const px = su*(sW-1), py = sv*(sH-1);
      const x0 = px|0, y0 = py|0;
      const x1 = Math.min(x0+1,sW-1), y1 = Math.min(y0+1,sH-1);
      const fx = px-x0, fy = py-y0;
      for (let c = 0; c < 4; c++) {
        const v00=sd.data[(y0*sW+x0)*4+c], v10=sd.data[(y0*sW+x1)*4+c];
        const v01=sd.data[(y1*sW+x0)*4+c], v11=sd.data[(y1*sW+x1)*4+c];
        dd.data[di+c] = Math.round(v00*(1-fx)*(1-fy)+v10*fx*(1-fy)+v01*(1-fx)*fy+v11*fx*fy);
      }
    }
  }
  dctx.putImageData(dd, 0, 0);
  return dc;
}
