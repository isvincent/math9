(function () {
  const $ = id => document.getElementById(id);
  const stage = $("stage"), S = DATA.slides, N = S.length, TOTAL = DATA.total, TR = 0.9;

  // ---------- 畫面縮放（9:16 置中） ----------
  function fit() {
    const s = Math.min(innerWidth / 1080, innerHeight / 1920);
    stage.style.transform = `translate(-50%,-50%) scale(${s})`;
  }
  addEventListener("resize", fit); fit();

  // ---------- 動畫元素 ----------
  const slideEls = [...document.querySelectorAll(".slide")];
  const items = slideEls.map(sl => [...sl.querySelectorAll("[data-a]")].map(el => {
    const d = el.dataset;
    const it = { el, t: +d.t, a: d.a, d: +(d.d || 0.6), out: d.out ? +d.out : null,
      kf: d.kf ? JSON.parse(d.kf) : null, num: d.num ? JSON.parse(d.num) : null,
      fmt: +(d.fmt || 0), span: el.tagName.toLowerCase() === "tspan", sO: "", sT: "", sN: "" };
    if (it.a === "draw") { el.style.strokeDasharray = "1 1"; el.style.strokeDashoffset = "1"; }
    if (it.a === "grow") el.style.transformOrigin = "left center";
    return it;
  }));

  const clamp = q => Math.max(0, Math.min(1, q));
  const ease = q => 1 - Math.pow(1 - q, 3);
  const back = q => { const c = 1.9; return 1 + (c + 1) * Math.pow(q - 1, 3) + c * Math.pow(q - 1, 2); };
  const smooth = q => q * q * (3 - 2 * q);
  const io = q => q < .5 ? 4 * q * q * q : 1 - Math.pow(-2 * q + 2, 3) / 2;

  function interp(kf, t) {
    if (t <= kf[0][0]) return kf[0].slice(1);
    for (let i = 0; i < kf.length - 1; i++) {
      const a = kf[i], b = kf[i + 1];
      if (t < b[0]) {
        const q = smooth(clamp((t - a[0]) / Math.max(1e-3, b[0] - a[0])));
        return a.slice(1).map((v, j) => v + (b[j + 1] - v) * q);
      }
    }
    return kf[kf.length - 1].slice(1);
  }

  function upd(it, t) {
    const q = clamp((t - it.t) / it.d);
    let op = 1, tf = "";
    switch (it.a) {
      case "fade": op = q; break;
      case "up": op = q; tf = `translate(0px,${((1 - ease(q)) * 50).toFixed(1)}px)`; break;
      case "left": op = q; tf = `translate(${((ease(q) - 1) * 70).toFixed(1)}px,0px)`; break;
      case "pop": case "draw2": op = Math.min(1, q * 2.5); tf = `scale(${(0.3 + 0.7 * back(q)).toFixed(3)})`; break;
      case "bloom": op = ease(q); tf = `scale(${(0.86 + 0.14 * ease(q)).toFixed(3)})`; break;
      case "grow": op = q > 0 ? 1 : 0; tf = `scale(${Math.max(0.001, ease(q)).toFixed(3)},1)`; break;
      case "draw": op = q > 0 ? 1 : 0; it.el.style.strokeDashoffset = (1 - ease(q)).toFixed(4); break;
    }
    if (it.out != null && t > it.out) op *= clamp(1 - (t - it.out) / 0.5);
    if (it.kf) { const [dx, dy] = interp(it.kf, t); tf = `translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px) ` + tf; }
    if (it.num) {
      const v = interp(it.num, t)[0].toFixed(it.fmt);
      if (v !== it.sN) { it.el.textContent = v; it.sN = v; }
    }
    if (it.span) return;
    const o = op.toFixed(3);
    if (o !== it.sO) { it.el.style.opacity = o; it.sO = o; }
    if (tf !== it.sT) { it.el.style.transform = tf || "none"; it.sT = tf; }
  }

  // ---------- 投影片切換轉場（6 種輪替） ----------
  function resetSlide(el) { el.style.opacity = 1; el.style.transform = "none"; el.style.clipPath = "none"; }
  function trans(type, p, inc, out) {
    resetSlide(inc); resetSlide(out);
    switch (type) {
      case 0: inc.style.opacity = p; inc.style.transform = `scale(${1.12 - 0.12 * p})`;
        out.style.transform = `scale(${1 - 0.06 * p})`; out.style.opacity = 1 - 0.6 * p; break;           // 縮放淡入
      case 1: inc.style.transform = `translateX(${(1 - p) * 100}%)`;
        out.style.transform = `translateX(${-p * 30}%)`; out.style.opacity = 1 - 0.5 * p; break;           // 推移
      case 2: inc.style.clipPath = `circle(${(p * 120).toFixed(2)}% at 50% 45%)`;
        out.style.transform = `scale(${1 + 0.05 * p})`; break;                                               // 圓形展開
      case 3: inc.style.transform = `translateY(${(1 - p) * 100}%)`;
        out.style.transform = `translateY(${-p * 20}%)`; out.style.opacity = 1 - 0.7 * p; break;           // 上推
      case 4: { const x = (p * 200).toFixed(2);
        inc.style.clipPath = `polygon(0 0, ${x}% 0, ${x - 100}% 100%, 0 100%)`; break; }                    // 斜向擦除
      case 5: inc.style.opacity = p; inc.style.transform = `rotate(${(1 - p) * -6}deg) scale(${0.75 + 0.25 * p})`;
        out.style.opacity = 1 - p; out.style.transform = `scale(${1 + 0.15 * p})`; break;                  // 旋轉聚焦
    }
  }

  // ---------- 字幕與進度 ----------
  const sub = $("sub"), subSpan = sub.querySelector("span");
  let curSub = -2;
  function setSub(t) {
    let k = -1;
    for (let i = 0; i < DATA.subs.length; i++) { const s = DATA.subs[i]; if (t >= s[0] && t < s[1]) { k = i; break; } }
    if (k === curSub) return;
    curSub = k;
    if (k < 0) { sub.classList.add("empty"); return; }
    sub.classList.remove("empty");
    subSpan.textContent = DATA.subs[k][2];
    subSpan.classList.remove("in"); void subSpan.offsetWidth; subSpan.classList.add("in");
  }
  const ticks = $("ticks");
  S.forEach((s, i) => { if (i) { const e = document.createElement("span"); e.style.left = (s.start / TOTAL * 100) + "%"; ticks.appendChild(e); } });
  const fmtT = x => `${Math.floor(x / 60)}:${String(Math.floor(x % 60)).padStart(2, "0")}`;

  let lastIdx = -1, lastVis = new Set();
  function render(t) {
    let idx = 0;
    for (let i = 0; i < N; i++) if (t >= S[i].start) idx = i;
    const vis = new Set([idx]);
    const inTrans = idx > 0 && t < S[idx].start + TR;
    if (inTrans) vis.add(idx - 1);
    slideEls.forEach((el, j) => {
      const v = vis.has(j);
      if (v !== lastVis.has(j)) el.style.display = v ? "block" : "none";
      el.style.zIndex = j === idx ? 2 : 1;
    });
    if (inTrans) trans((idx - 1) % 6, io(clamp((t - S[idx].start) / TR)), slideEls[idx], slideEls[idx - 1]);
    else resetSlide(slideEls[idx]);
    lastVis = vis;
    vis.forEach(j => items[j].forEach(it => upd(it, t)));
    setSub(t);
    $("prog").style.width = (t / TOTAL * 100).toFixed(2) + "%";
    $("fill").style.width = (t / TOTAL * 100).toFixed(2) + "%";
    $("time").textContent = `${fmtT(t)} / ${fmtT(TOTAL)}`;
    if (idx !== lastIdx) { $("cnt").textContent = `${String(idx + 1).padStart(2, "0")} / ${N}`; lastIdx = idx; }
  }

  // ---------- 音訊與時鐘 ----------
  const bin = atob(B64), u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const audio = new Audio(URL.createObjectURL(new Blob([u8], { type: "audio/mpeg" })));
  audio.preload = "auto";
  let mode = "audio", clock0 = performance.now(), clockT = 0, clockPaused = false, ended = false;
  const now = () => mode === "audio" ? audio.currentTime : (clockPaused ? clockT : (performance.now() - clock0) / 1000);

  function isPaused() { return mode === "audio" ? audio.paused : clockPaused; }
  function play() {
    ended = false; $("endov").style.display = "none";
    if (mode === "audio") audio.play().catch(() => {});
    else if (clockPaused) { clockPaused = false; clock0 = performance.now() - clockT * 1000; }
    $("play").textContent = "❚❚";
  }
  function pause() {
    if (mode === "audio") audio.pause(); else if (!clockPaused) { clockT = now(); clockPaused = true; }
    $("play").textContent = "▶";
  }
  function seek(x) {
    x = Math.max(0, Math.min(TOTAL - 0.01, x));
    if (mode === "audio") audio.currentTime = x; else { clockT = x; clock0 = performance.now() - x * 1000; }
    ended = false; $("endov").style.display = "none";
  }
  // 開啟即嘗試「有聲」自動播放；畫面時間完全取自音訊，聲音與動畫必定同步。
  // 若瀏覽器禁止有聲自動播放，畫面停在開頭，必須點選播放鍵，簡報才從 0 秒與聲音同步開始。
  const startov = $("startov");
  async function autostart() {
    try { await audio.play(); }
    catch (e) { audio.pause(); audio.currentTime = 0; startov.style.display = "flex"; $("play").textContent = "▶"; }
  }
  function unlock() {
    if (startov.style.display !== "flex") return false;
    startov.style.display = "none";
    audio.currentTime = 0; play();
    return true;
  }

  const waiting = () => startov.style.display === "flex";
  $("bigplay").addEventListener("click", e => { e.stopPropagation(); unlock(); });
  stage.addEventListener("pointerdown", e => {
    if (waiting()) return;   // 等待中：只有播放鍵有作用
    if (e.target.closest("#ctrl") || e.target.closest("#endov")) return;
    isPaused() ? play() : pause();
  });
  $("play").addEventListener("click", () => { if (!unlock()) isPaused() ? play() : pause(); });
  $("track").addEventListener("pointerdown", e => {
    const r = e.currentTarget.getBoundingClientRect();
    seek((e.clientX - r.left) / r.width * TOTAL);
  });
  $("replay").addEventListener("click", () => { seek(0); play(); });
  addEventListener("keydown", e => {
    if (waiting()) return;
    if (e.code === "Space") { e.preventDefault(); isPaused() ? play() : pause(); }
    if (e.code === "ArrowRight") seek(now() + 5);
    if (e.code === "ArrowLeft") seek(now() - 5);
  });

  function loop() {
    let t = now();
    if (t >= TOTAL - 0.02 && !ended) {
      ended = true; t = TOTAL - 0.02; pause(); $("endov").style.display = "flex";
    }
    render(Math.min(t, TOTAL - 0.02));
    requestAnimationFrame(loop);
  }
  window.__seek = t => { pause(); seek(t); render(t); };   // 檢查用
  render(0);
  autostart();
  requestAnimationFrame(loop);
})();
