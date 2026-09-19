"use client";
import {
  PlayIcon,
  StopIcon,
  ArrowCounterClockwiseIcon,
  GaugeIcon,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

import type { Event, MatchTeam, Visual } from "./types";
import { normalizeMatchTeams, shortName } from "./types";
import FormationPitch from "./FormationPitch";

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
const ALL_EVENT_TYPES = Object.keys(EVENT_COLORS);

export default function Pitch() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const playbackSpeedRef = useRef(1);

  const activeVisuals = useRef<Visual[]>([]);

  const [status, setStatus] = useState("Disconnected");
  const [playbackSpeed, setPlaybackSpeedState] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [matchTeams, setMatchTeams] = useState<MatchTeam[]>([]);

  const [enabledEventTypes, setEnabledEventTypes] = useState<Set<string>>(
    new Set(ALL_EVENT_TYPES)
  );

  const sendCommand = (cmd: string, value?: number, eventTypes?: string[]) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({ action: cmd, speed: value, eventTypes }),
      );
    }
  };

  const toggleEventType = (type: string) => {
    const next = new Set(enabledEventTypes);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    setEnabledEventTypes(next);
    sendCommand("FILTER", undefined, Array.from(next));
  };

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
      // Center line
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

    ws.onopen = () => {
      setStatus("Connected");
      sendCommand("FILTER", undefined, ALL_EVENT_TYPES);
    };
    ws.onclose = () => setStatus("Disconnected");

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data) as {
        type?: string;
        teams?: unknown;
        data?: { teams?: unknown };
        index?: number;
        total?: number;
      };
      if (msg.type === "MATCH_INFO") {
        setMatchTeams(normalizeMatchTeams(msg.teams ?? msg.data?.teams));
        return;
      }
      if (msg.type === "TICK") {
        const ev = msg.data as Event;
        setStatus(
          `[${msg.index}/${msg.total}] ${ev.minute}:${ev.second} - ${shortName(ev.player)} - ${ev.type}`,
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
    activeVisuals.current = [];
    sendCommand("RESET");
  };

  return (
    <div className="flex flex-col items-center gap-4 p-8">
      {/* Formation diagrams — separate box */}
      <FormationPitch teams={matchTeams} />

      {/* Playback controls */}
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
            className="w-32"
            min="0.25"
            max="3"
            step="0.25"
            value={playbackSpeed}
            onChange={(event) => setPlaybackSpeed(Number(event.target.value))}
          />
          <span className="w-12 text-right tabular-nums">{playbackSpeed}x</span>
        </label>
      </div>
      <div className="text-gray-300">{status}</div>

      {/* Main pitch area with sidebar */}
      <div className="flex w-full max-w-279 gap-6">
        {/* Left side: checkboxes */}
        <div className="w-48 shrink-0 flex flex-col gap-2 rounded-lg border border-gray-700 bg-gray-800/80 p-4">
          <h3 className="mb-2 font-semibold text-gray-300 text-sm uppercase tracking-wider border-b border-gray-700 pb-2">
            Events
          </h3>
          {Object.entries(EVENT_COLORS).map(([type, color]) => (
            <label
              key={type}
              className="flex items-center gap-3 text-sm text-gray-400 cursor-pointer hover:text-gray-200 transition-colors"
            >
              <input
                type="checkbox"
                checked={enabledEventTypes.has(type)}
                onChange={() => toggleEventType(type)}
                className="w-4 h-4 accent-green-600 rounded cursor-pointer"
              />
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: color }}
              ></span>
              <span className="truncate">{type}</span>
            </label>
          ))}
        </div>

        {/* Event canvas (passes map) — no formation overlay */}
        <div className="flex-1">
          <canvas
            ref={canvasRef}
            width={900}
            height={600}
            className="block w-full rounded border border-gray-700 shadow-xl bg-[#1f242c]"
          />
        </div>
      </div>
    </div>
  );
}
