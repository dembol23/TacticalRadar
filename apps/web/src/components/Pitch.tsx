'use client';

import { useEffect, useRef, useState } from 'react';

// Typy z naszego backendu
type EventType = 'Pass' | 'Shot' | 'Goal';
type Point = [number, number];
interface Event {
  minute: number; second: number; type: EventType; team: string; player: string;
  startLocation: Point; endLocation?: Point;
}
interface StreamFrame { type: string; data: Event; index: number; total: number }

export default function Pitch() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  
  // Bufor zdarzeń (nie wywołuje re-renderu UI!)
  const activeVisuals = useRef<any[]>([]);
  
  // Stan tylko dla panelu UI (tekst statusu u góry)
  const [status, setStatus] = useState('Rozłączono');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    // Funkcje rysujące (przekopiowane z PoC, dostosowane do TS)
    const renderLoop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Tło - zielona murawa
      ctx.fillStyle = '#1f242c';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Zewnętrzne linie
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
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

        if (progress >= 1.0) {
          visuals.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = 1.0 - progress;
        
        if (item.type === 'Pass') {
          ctx.strokeStyle = item.color;
          ctx.fillStyle = item.color;
          ctx.beginPath();
          ctx.moveTo(item.start.x, item.start.y);
          ctx.lineTo(item.end.x, item.end.y);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(item.start.x, item.start.y, 4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(renderLoop);
    };

    // Nawiązanie połączenia WebSocket
    const ws = new WebSocket('ws://localhost:8080/ws');
    wsRef.current = ws;

    ws.onopen = () => setStatus('Połączono');
    ws.onclose = () => setStatus('Rozłączono');
    
    ws.onmessage = (e) => {
      const msg: StreamFrame = JSON.parse(e.data);
      if (msg.type === 'TICK') {
        const ev = msg.data;
        setStatus(`[${msg.index}/${msg.total}] ${ev.minute}:${ev.second} - ${ev.player}`);
        
        // Funkcja mapująca wymiary 120x80 -> 900x600 (proporcje 1:7.5)
        const scaleX = canvas.width / 120.0;
        const scaleY = canvas.height / 80.0;

        activeVisuals.current.push({
          type: ev.type,
          start: { x: ev.startLocation[0] * scaleX, y: ev.startLocation[1] * scaleY },
          end: ev.endLocation ? { x: ev.endLocation[0] * scaleX, y: ev.endLocation[1] * scaleY } : null,
          color: ev.team.includes('Barcelona') ? '#a50044' : '#004d98',
          startTime: performance.now(),
          duration: 1500
        });
      }
    };

    renderLoop();

    // Cleanup przy odmontowaniu komponentu
    return () => {
      cancelAnimationFrame(animationFrameId);
      ws.close();
    };
  }, []);

  const sendCommand = (cmd: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: cmd }));
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 p-8">
      <div className="flex gap-4 items-center">
        <button onClick={() => sendCommand('START')} className="px-4 py-2 bg-green-600 rounded">START</button>
        <button onClick={() => sendCommand('PAUSE')} className="px-4 py-2 bg-red-600 rounded">PAUSE</button>
        <button onClick={() => sendCommand('RESET')} className="px-4 py-2 bg-gray-700 rounded">RESET</button>
      </div>
    <div className="text-gray-300">{status}</div>
      <canvas ref={canvasRef} width={900} height={600} className="border border-gray-700 rounded shadow-xl" />
    </div>
  );
}