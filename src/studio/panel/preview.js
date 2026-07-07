function firstTimeline(iframe) {
  const timelines = iframe?.contentWindow?.__timelines;
  if (!timelines || typeof timelines !== "object") return null;
  return timelines.main ?? Object.values(timelines)[0] ?? null;
}

function timelineDuration(timeline) {
  if (!timeline) return 0;
  if (typeof timeline.duration === "function") {
    const value = timeline.duration();
    return Number.isFinite(value) ? value : 0;
  }
  return Number.isFinite(timeline.duration) ? timeline.duration : 0;
}

function timelineProgress(timeline) {
  if (!timeline) return 0;
  if (typeof timeline.progress === "function") {
    const value = timeline.progress();
    return Number.isFinite(value) ? value : 0;
  }
  const duration = timelineDuration(timeline);
  if (duration > 0 && typeof timeline.time === "function") return timeline.time() / duration;
  return 0;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function seekTimeline(timeline, progress) {
  if (!timeline) return;
  const next = clamp01(progress);
  if (typeof timeline.pause === "function") timeline.pause();
  if (typeof timeline.progress === "function") {
    timeline.progress(next);
    return;
  }
  const duration = timelineDuration(timeline);
  if (duration > 0 && typeof timeline.time === "function") timeline.time(duration * next);
}

function playTimeline(timeline) {
  if (timeline && typeof timeline.play === "function") timeline.play();
}

function pauseTimeline(timeline) {
  if (timeline && typeof timeline.pause === "function") timeline.pause();
}

function setTimeLabel(node, progress, duration) {
  if (!node) return;
  const current = duration * progress;
  node.textContent = `${current.toFixed(2)}s / ${duration.toFixed(2)}s`;
}

export function createPreviewController({
  iframe,
  scrub,
  playButton,
  timeLabel,
  windowRef = globalThis.window
}) {
  let timeline = null;
  let playing = false;
  let raf = 0;
  let lastSource = { type: "url", value: "/build/index.html" };
  let reloadCount = 0;

  function syncControls() {
    timeline = firstTimeline(iframe);
    const duration = timelineDuration(timeline);
    const progress = clamp01(timelineProgress(timeline));
    if (scrub) scrub.value = String(Math.round(progress * Number(scrub.max || 1000)));
    setTimeLabel(timeLabel, progress, duration || 0);
  }

  function loop() {
    syncControls();
    if (playing && typeof windowRef?.requestAnimationFrame === "function") {
      raf = windowRef.requestAnimationFrame(loop);
    }
  }

  function stopLoop() {
    if (raf && typeof windowRef?.cancelAnimationFrame === "function") windowRef.cancelAnimationFrame(raf);
    raf = 0;
  }

  function setPlaying(next) {
    playing = Boolean(next);
    playButton.textContent = playing ? "일시정지" : "재생";
    playButton.dataset.state = playing ? "playing" : "paused";
    stopLoop();
    if (playing) loop();
  }

  function setSource(source = {}) {
    if (source.html) {
      lastSource = { type: "html", value: source.html };
      iframe.removeAttribute?.("src");
      iframe.srcdoc = source.html;
    } else {
      lastSource = { type: "url", value: source.url ?? "/build/index.html" };
      iframe.removeAttribute?.("srcdoc");
      iframe.src = lastSource.value;
    }
  }

  function reload() {
    reloadCount += 1;
    setPlaying(false);
    if (lastSource.type === "html") {
      iframe.srcdoc = lastSource.value;
    } else if (iframe.contentWindow?.location?.reload) {
      iframe.contentWindow.location.reload();
    } else {
      iframe.src = lastSource.value;
    }
  }

  iframe.addEventListener?.("load", syncControls);
  scrub.addEventListener?.("input", () => {
    const max = Number(scrub.max || 1000);
    seekTimeline(firstTimeline(iframe), max > 0 ? Number(scrub.value) / max : 0);
    setPlaying(false);
    syncControls();
  });
  playButton.addEventListener?.("click", () => {
    timeline = firstTimeline(iframe);
    if (!timeline) return;
    if (playing) {
      pauseTimeline(timeline);
      setPlaying(false);
    } else {
      playTimeline(timeline);
      setPlaying(true);
    }
  });

  return {
    setSource,
    reload,
    syncControls,
    seek: (progress) => {
      seekTimeline(firstTimeline(iframe), progress);
      syncControls();
    },
    get reloadCount() {
      return reloadCount;
    }
  };
}
