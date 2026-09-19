"use client";
import {
  PlayIcon,
  StopIcon,
  ArrowCounterClockwiseIcon,
  GaugeIcon,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

type Point = [number, number];
interface Event {
  minute: number;
  second: number;
  type: string;
  team: string;
  player: string;
  startLocation?: Point;
  endLocation?: Point;
}
interface StreamFrame {
  type: string;
  data: Event;
  index: number;
  total: number;
}
interface Visual {
  type: string;
  start: { x: number; y: number };
  end?: { x: number; y: number };
  color: string;
  startTime: number;
  duration: number;
}

const EVENT_COLORS: Record<string, string> = {
  Pass: "#f7c948",
  Carry: "#4dd4ac",
  Shot: "#ff6b6b",
  "Ball Receipt*": "#8ec5ff",
  Pressure: "#ff9f43",
  Duel: "#d6a2e8",
  "Foul Committed": "#ff4757",
  "Foul Won": "#70a1ff",
};

const LINE_OPACITY = [1, 0.8, 0.6, 0.4, 0.2];

export default function Pitch() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const playbackSpeedRef = useRef(1);

  const activeVisuals = useRef<Visual[]>([]);

  const [status, setStatus] = useState("Rozłączono");
  const [playbackSpeed, setPlaybackSpeedState] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;

    const renderLoop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "#1f242c";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, canvas.width, canvas.height);
      // Linia środkowa
      ctx.beginPath();
      ctx.moveTo(canvas.width / 2, 0);
      ctx.lineTo(canvas.width / 2, canvas.height);
      ctx.stroke();

      const now = performance.now();
      const visuals = activeVisuals.current;

      for (let i = visuals.length - 1; i >= 0; i--) {
        const item = visuals[i];
        const progress = (now - item.startTime) / item.duration;
        const newerLineCount = item.end
          ? visuals.slice(i + 1).filter((visual) => visual.end).length
          : 0;

        if (item.end && newerLineCount >= LINE_OPACITY.length) {
          visuals.splice(i, 1);
          continue;
        }

        if (!item.end && progress >= 1.0) {
          visuals.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = item.end
          ? LINE_OPACITY[newerLineCount]
          : 1.0 - progress;

        ctx.strokeStyle = item.color;
        ctx.fillStyle = item.color;
        ctx.lineWidth = item.type === "Shot" ? 4 : 2;

        if (item.end) {
          ctx.beginPath();
          ctx.moveTo(item.start.x, item.start.y);
          ctx.lineTo(item.end.x, item.end.y);
          ctx.stroke();

          const angle = Math.atan2(
            item.end.y - item.start.y,
            item.end.x - item.start.x,
          );
          const arrowSize = item.type === "Shot" ? 10 : 7;
          ctx.beginPath();
          ctx.moveTo(item.end.x, item.end.y);
          ctx.lineTo(
            item.end.x - arrowSize * Math.cos(angle - Math.PI / 6),
            item.end.y - arrowSize * Math.sin(angle - Math.PI / 6),
          );
          ctx.lineTo(
            item.end.x - arrowSize * Math.cos(angle + Math.PI / 6),
            item.end.y - arrowSize * Math.sin(angle + Math.PI / 6),
          );
          ctx.closePath();
          ctx.fill();
        }

        if (item.type === "Shot") {
          ctx.beginPath();
          ctx.arc(item.start.x, item.start.y, 8, 0, Math.PI * 2);
          ctx.stroke();
        } else if (item.type === "Pressure" || item.type === "Duel") {
          ctx.beginPath();
          ctx.arc(
            item.start.x,
            item.start.y,
            item.type === "Duel" ? 7 : 5,
            0,
            Math.PI * 2,
          );
          ctx.stroke();
        } else if (item.type === "Foul Committed" || item.type === "Foul Won") {
          ctx.beginPath();
          ctx.moveTo(item.start.x - 6, item.start.y - 6);
          ctx.lineTo(item.start.x + 6, item.start.y + 6);
          ctx.moveTo(item.start.x + 6, item.start.y - 6);
          ctx.lineTo(item.start.x - 6, item.start.y + 6);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(item.start.x, item.start.y, item.end ? 4 : 5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(renderLoop);
    };

    const ws = new WebSocket("ws://localhost:8080/ws");
    wsRef.current = ws;

    ws.onopen = () => setStatus("Połączono");
    ws.onclose = () => setStatus("Rozłączono");

    ws.onmessage = (e) => {
      const msg: StreamFrame = JSON.parse(e.data);
      if (msg.type === "TICK") {
        const ev = msg.data;
        setStatus(
          `[${msg.index}/${msg.total}] ${ev.minute}:${ev.second} - ${ev.player} - ${ev.type}`,
        );

        const scaleX = canvas.width / 120.0;
        const scaleY = canvas.height / 80.0;

        if (!ev.startLocation) return;

        activeVisuals.current.push({
          type: ev.type,
          start: {
            x: ev.startLocation[0] * scaleX,
            y: ev.startLocation[1] * scaleY,
          },
          end: ev.endLocation
            ? { x: ev.endLocation[0] * scaleX, y: ev.endLocation[1] * scaleY }
            : undefined,
          color:
            EVENT_COLORS[ev.type] ??
            (ev.team.includes("Barcelona") ? "#a50044" : "#004d98"),
          startTime: performance.now(),
          duration: 1500 / playbackSpeedRef.current,
        });
      }
    };

    renderLoop();

    return () => {
      cancelAnimationFrame(animationFrameId);
      ws.close();
    };
  }, []);

  const sendCommand = (cmd: string, value?: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: cmd, speed: value }));
    }
  };

  const setPlaybackSpeed = (speed: number) => {
    playbackSpeedRef.current = speed;
    setPlaybackSpeedState(speed);
    sendCommand("SPEED", speed);
  };

  const togglePlayback = () => {
    const nextIsPlaying = !isPlaying;
    setIsPlaying(nextIsPlaying);
    sendCommand(nextIsPlaying ? "START" : "PAUSE");
  };

  const resetPlayback = () => {
    setIsPlaying(false);
    sendCommand("RESET");
  };

  return (
    <div className="flex flex-col items-center gap-4 p-8">
      <div className="flex gap-4 items-center">
        <button
          onClick={togglePlayback}
          className={`flex items-center gap-2 rounded px-4 py-2 ${
            isPlaying ? "bg-red-600" : "bg-green-600"
          }`}
        >
          {isPlaying ? (
            <StopIcon size={18} weight="fill" />
          ) : (
            <PlayIcon size={18} weight="fill" />
          )}
          {isPlaying ? "STOP" : "START"}
        </button>

        <button
          onClick={resetPlayback}
          className="flex items-center gap-2 rounded bg-gray-700 px-4 py-2"
        >
          <ArrowCounterClockwiseIcon size={18} />
          RESET
        </button>

        <label className="flex items-center gap-2 text-sm text-gray-300">
          <GaugeIcon size={18} />
          <input
            type="range"
            min="0.25"
            max="3"
            step="0.25"
            value={playbackSpeed}
            onChange={(event) => setPlaybackSpeed(Number(event.target.value))}
          />
          <span>{playbackSpeed}x</span>
        </label>
      </div>
      <div className="text-gray-300">{status}</div>
      <canvas
        ref={canvasRef}
        width={900}
        height={600}
        className="border border-gray-700 rounded shadow-xl"
      />
    </div>
  );
}
