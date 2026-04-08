import { useState, useEffect, useCallback } from 'react'
import { supabase } from './lib/supabase'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import {
  Newspaper, Users, MapPin, TrendingUp, Target, FileText, Package2,
  LogOut, ChevronDown, ChevronUp, Download, Loader2, Shield, Info, X
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────
const BASE = import.meta.env.VITE_GITHUB_DATA_BASE_URL ||
  'https://raw.githubusercontent.com/salescampelo/monitor-eduardo-gomes/main/data/'

const DEV_BYPASS = import.meta.env.VITE_DEV_BYPASS === 'true'

// Converte cor hex para glow box-shadow
function clusterGlow(hex) {
  const r = parseInt(hex.slice(1,3),16)
  const g = parseInt(hex.slice(3,5),16)
  const b = parseInt(hex.slice(5,7),16)
  return `0 0 8px rgba(${r},${g},${b},0.4)`
}

// Hook: scroll reveal via IntersectionObserver (once), re-run when dataLoaded
function useScrollReveal(ready) {
  useEffect(() => {
    if (!ready) return
    // Pequeno delay para garantir que o DOM renderizou
    const tid = setTimeout(() => {
      const panels = document.querySelectorAll('.module-panel:not(.revealed)')
      if (!panels.length) return
      const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed')
            observer.unobserve(entry.target)
          }
        })
      }, { threshold: 0.05 })
      panels.forEach(p => observer.observe(p))
      // Fallback: força reveal em todos após 1.5s caso observer não dispare
      const fallbackId = setTimeout(() => {
        document.querySelectorAll('.module-panel:not(.revealed)').forEach(p => p.classList.add('revealed'))
      }, 1500)
      return () => { observer.disconnect(); clearTimeout(fallbackId) }
    }, 100)
    return () => clearTimeout(tid)
  }, [ready])
}

// Hook: header glass blur on scroll
function useHeaderScroll() {
  useEffect(() => {
    const header = document.querySelector('.app-header')
    if (!header) return
    const onScroll = () => {
      header.classList.toggle('scrolled', window.scrollY > 10)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
}

const CLUSTER_COLORS = {
  DIRECT:        '#1A2F5A',
  CRISIS:        '#C0392B',
  ELECTORAL:     '#7B2D8B',
  INSTITUTIONAL: '#2D7A4F',
  ALLIANCE:      '#6B7280',
  COMPETITIVE:   '#D4700A',
}

const CLUSTER_LABELS = {
  ALL:           'Todos',
  DIRECT:        'Direto',
  CRISIS:        'Crise',
  ELECTORAL:     'Eleitoral',
  INSTITUTIONAL: 'Institucional',
  ALLIANCE:      'Aliança',
  COMPETITIVE:   'Competitivo',
}

const NAV_ITEMS = [
  { id: 'm4', label: 'Competitivo', Icon: TrendingUp },
  { id: 'm5', label: 'KPIs',        Icon: Target     },
  { id: 'm3', label: 'Municipal',   Icon: MapPin     },
  { id: 'm2', label: 'Redes',       Icon: Users      },
  { id: 'm7', label: 'Entregas',    Icon: Package2   },
  { id: 'm6', label: 'Briefing',    Icon: FileText   },
  { id: 'm1', label: 'Imprensa',    Icon: Newspaper  },
]

// ─────────────────────────────────────────────────────────────
// Global CSS (injected via <style> tag)
// ─────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  :root {
    --primary:    #1A2F5A;
    --accent:     #C8A951;
    --success:    #2D7A4F;
    --danger:     #C0392B;
    --warning:    #D4700A;
    --bg:         #F0F2F7;
    --surface:    #FFFFFF;
    --text:       #1A1A2E;
    --text-muted: #6B7280;

    --font-xs:   0.875rem;
    --font-sm:   1.0rem;
    --font-base: 1.125rem;
    --font-md:   1.3rem;
    --font-lg:   1.6rem;
    --font-xl:   1.9rem;
    --font-2xl:  2.5rem;
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); color: var(--text); font-family: 'Inter', sans-serif; }
  @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }

  /* ── Layout ── */
  .app-layout { display: flex; min-height: calc(100vh - 60px); }

  /* ── Header (glass on scroll via JS class) ── */
  .app-header {
    position: sticky; top: 0; z-index: 100;
    background: var(--primary); color: white;
    display: flex; align-items: center; justify-content: space-between;
    padding: 18px 24px; min-height: 60px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    transition: background 0.3s ease, backdrop-filter 0.3s ease;
  }
  .app-header.scrolled {
    background: rgba(26,47,90,0.92);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }
  .app-header h1 {
    font-family: 'Playfair Display', serif;
    font-size: var(--font-xl); font-weight: 700;
  }
  .app-header .subtitle { font-size: var(--font-base); opacity: 0.7; margin-top: 3px; }
  .btn-logout {
    background: rgba(255,255,255,0.12);
    border: 1px solid rgba(255,255,255,0.25);
    color: white; border-radius: 8px;
    padding: 6px 14px; cursor: pointer;
    font-size: var(--font-sm); display: flex; align-items: center; gap: 6px;
    transition: background 0.2s; font-family: 'Inter', sans-serif;
  }
  .btn-logout:hover { background: rgba(255,255,255,0.22); }

  /* ── Ticker ── */
  .ticker-wrap {
    background: #0f1e3d; color: rgba(255,255,255,0.75);
    height: 28px; overflow: hidden; display: flex; align-items: center;
    border-bottom: 1px solid rgba(200,169,81,0.25);
    font-size: var(--font-sm); position: sticky; top: 0; z-index: 98;
  }
  .ticker-label {
    background: var(--accent); color: #1a1a1a;
    font-weight: 700; font-size: var(--font-xs); padding: 0 10px;
    height: 100%; display: flex; align-items: center;
    flex-shrink: 0; white-space: nowrap; letter-spacing: 0.3px;
  }
  .ticker-track {
    display: flex; align-items: center;
    white-space: nowrap; overflow: hidden; flex: 1;
  }
  .ticker-inner {
    display: inline-flex; gap: 60px;
    animation: ticker-scroll 40s linear infinite;
  }
  @keyframes ticker-scroll {
    from { transform: translateX(0); }
    to   { transform: translateX(-50%); }
  }
  .ticker-item { display: inline-flex; align-items: center; gap: 8px; }
  .ticker-dot { width: 4px; height: 4px; border-radius: 50%; background: var(--accent); flex-shrink: 0; }

  /* ── Intel strip ── */
  .intel-strip {
    position: sticky; top: 0; z-index: 97;
    background: var(--primary); color: white;
    display: flex; align-items: center;
    padding: 0 24px; height: 72px;
    border-bottom: 2px solid rgba(200,169,81,0.35);
    overflow: hidden; gap: 0;
  }
  .intel-item {
    display: flex; flex-direction: column; justify-content: center;
    padding: 0 28px; white-space: nowrap; flex-shrink: 0;
  }
  .intel-item-label {
    font-size: var(--font-xs); opacity: 0.6;
    text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px;
  }
  .intel-item-value { font-size: var(--font-base); font-weight: 600; }
  .intel-divider {
    width: 1px; height: 32px;
    background: rgba(255,255,255,0.2); flex-shrink: 0;
  }

  /* ── Sidebar (desktop) ── */
  .sidebar {
    width: 220px; flex-shrink: 0;
    background: var(--surface);
    border-right: 1px solid #e5e7eb;
    position: sticky; top: 148px;
    height: calc(100vh - 148px);
    overflow-y: auto; padding: 16px 0;
  }
  .sidebar-item {
    display: flex; align-items: center; gap: 12px;
    padding: 14px 20px; cursor: pointer;
    font-size: var(--font-base); font-weight: 500;
    color: var(--text-muted);
    border-left: 3px solid transparent;
    transition: all 0.2s ease;
    position: relative;
  }
  .sidebar-item:hover { background: #f3f4f6; color: var(--text); }
  .sidebar-item.active {
    background: linear-gradient(to right, rgba(26,47,90,0.1) 0%, transparent 100%);
    color: var(--primary);
    border-left-color: var(--primary); font-weight: 600;
  }
  .sidebar-item.active svg { animation: pulse-icon 0.4s ease; }
  @keyframes pulse-icon {
    0%   { transform: scale(1); }
    50%  { transform: scale(1.3); }
    100% { transform: scale(1); }
  }

  /* ── Main content ── */
  .main-content { flex: 1; padding: 24px; overflow-x: hidden; }

  /* ── Module panel ── */
  .module-panel {
    background: var(--surface);
    border-radius: 12px;
    border: 1px solid rgba(26,47,90,0.12);
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    margin-bottom: 24px; overflow: hidden;
    scroll-margin-top: 156px;
    transition: transform 0.25s cubic-bezier(0.4,0,0.2,1), box-shadow 0.25s cubic-bezier(0.4,0,0.2,1);
    /* scroll reveal — starts hidden, JS adds .revealed */
    opacity: 0; transform: translateY(20px);
  }
  .module-panel.revealed {
    opacity: 1; transform: translateY(0);
    transition: opacity 0.5s ease-out, transform 0.5s ease-out;
  }
  .module-panel:hover {
    box-shadow: 0 8px 32px rgba(26,47,90,0.15);
  }
  .module-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 20px 28px; cursor: pointer; user-select: none;
    transition: background 0.15s;
    border-left: 3px solid var(--accent);
  }
  .module-header:hover { background: #f9fafb; }
  .module-header h2 {
    font-family: 'Playfair Display', serif;
    font-size: var(--font-lg); font-weight: 600; line-height: 1.2;
    color: var(--primary);
    display: flex; align-items: center; gap: 8px;
  }
  .module-body { padding: 0 28px 28px; }

  /* ── Cards ── */
  .card {
    background: var(--surface);
    border-radius: 12px;
    border: 1px solid rgba(26,47,90,0.12);
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    padding: 28px;
    transition: transform 0.25s cubic-bezier(0.4,0,0.2,1), box-shadow 0.25s cubic-bezier(0.4,0,0.2,1);
  }
  .card:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 32px rgba(26,47,90,0.15);
  }
  .grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
  .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }

  /* ── Badge ── */
  .badge {
    display: inline-block;
    padding: 2px 8px; border-radius: 4px;
    font-size: var(--font-xs); font-weight: 600;
    color: white; text-transform: uppercase;
    white-space: nowrap;
  }
  /* Glow aplicado inline via JS com base na cor do cluster */

  /* ── KPI card ── */
  .kpi-card {
    background: var(--surface); border-radius: 12px;
    border: 1px solid rgba(26,47,90,0.12);
    padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    text-align: center;
  }
  .kpi-value {
    font-size: var(--font-2xl); font-weight: 700;
    color: var(--primary); font-family: 'Playfair Display', serif;
    margin-bottom: 4px;
  }
  .kpi-label { font-size: var(--font-base); color: var(--text-muted); margin-top: 4px; line-height: 1.3; }
  .kpi-meta  { font-size: var(--font-xs); color: var(--text-muted); margin-top: 8px; }

  /* ── Progress bar ── */
  .progress-bar-wrap {
    background: #e5e7eb; border-radius: 4px;
    height: 6px; overflow: hidden; margin-top: 8px;
  }
  .progress-bar-fill { height: 100%; border-radius: 4px; transition: width 0.4s ease; }

  /* ── Mention row ── */
  .mention-row {
    border-bottom: 1px solid #f0f0f0;
    padding: 18px 0;
    display: flex; gap: 10px; align-items: flex-start;
  }
  .mention-row:last-child { border-bottom: none; }

  /* ── Filter bar ── */
  .filter-bar { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
  .filter-btn {
    padding: 8px 16px; border-radius: 20px;
    border: 1px solid #e5e7eb; background: white;
    cursor: pointer; font-size: var(--font-sm); font-weight: 500;
    color: var(--text-muted); transition: all 0.15s;
    font-family: 'Inter', sans-serif;
  }
  .filter-btn.active { background: var(--primary); color: white; border-color: var(--primary); }
  .filter-btn:hover:not(.active) { background: #f3f4f6; }

  /* ── Empty state ── */
  .empty-state {
    text-align: center; padding: 48px 20px;
    color: var(--text-muted); font-size: var(--font-base);
  }
  .empty-state svg { margin: 0 auto 16px; display: block; opacity: 0.35; width: 52px; height: 52px; }

  /* ── Countdown ── */
  .countdown { display: flex; gap: 16px; justify-content: center; margin: 8px 0 20px; }
  .countdown-unit { text-align: center; }
  .countdown-num {
    font-size: var(--font-2xl); font-weight: 700;
    color: var(--primary); font-family: 'Playfair Display', serif; line-height: 1;
    background: var(--bg); border-radius: 8px; padding: 8px 16px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.08);
    min-width: 72px; display: block; text-align: center;
  }
  .countdown-label {
    font-size: var(--font-xs); color: var(--text-muted);
    margin-top: 6px; text-transform: uppercase; letter-spacing: 0.5px;
  }

  /* ── Table ── */
  .table-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: var(--font-sm); }
  th {
    background: #f8fafc; padding: 10px 12px; text-align: left;
    font-weight: 600; font-size: var(--font-xs); color: var(--text-muted);
    border-bottom: 2px solid #e5e7eb; text-transform: uppercase; letter-spacing: 0.3px;
  }
  td { padding: 10px 12px; border-bottom: 1px solid #f0f0f0; vertical-align: middle; }
  tr:hover td { background: #f9fafb; }

  /* ── Login ── */
  .login-wrap {
    min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: linear-gradient(135deg, var(--primary) 0%, #2a4a8a 100%);
    padding: 20px;
  }
  .login-card {
    background: white; border-radius: 16px;
    padding: 40px 36px; width: 100%; max-width: 400px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  }
  .login-card .logo-accent { color: var(--accent); }
  .login-card h1 {
    font-family: 'Playfair Display', serif;
    color: var(--primary); font-size: var(--font-xl); margin-bottom: 4px;
  }
  .login-card p { color: var(--text-muted); font-size: var(--font-sm); margin-bottom: 28px; }
  .form-group { margin-bottom: 16px; }
  .form-group label {
    display: block; font-size: var(--font-sm); font-weight: 600;
    color: var(--text); margin-bottom: 6px;
  }
  .form-group input {
    width: 100%; padding: 10px 14px;
    border: 1px solid #e5e7eb; border-radius: 8px;
    font-size: var(--font-base); outline: none; transition: border-color 0.2s;
    font-family: 'Inter', sans-serif; color: var(--text);
  }
  .form-group input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(26,47,90,0.1); }
  .btn-primary {
    width: 100%; padding: 12px;
    background: var(--primary); color: white;
    border: none; border-radius: 8px;
    font-size: var(--font-base); font-weight: 600; cursor: pointer;
    transition: opacity 0.2s; font-family: 'Inter', sans-serif;
    display: flex; align-items: center; justify-content: center; gap: 8px;
  }
  .btn-primary:hover { opacity: 0.88; }
  .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
  .error-msg {
    background: #FEF2F2; color: var(--danger);
    padding: 10px 14px; border-radius: 8px;
    font-size: var(--font-sm); margin-bottom: 16px;
    border-left: 3px solid var(--danger);
  }

  /* ── Access denied ── */
  .access-denied {
    min-height: 100vh; display: flex; align-items: center;
    justify-content: center; background: var(--bg); padding: 20px;
  }
  .access-denied-card {
    background: white; border-radius: 16px;
    padding: 48px 40px; text-align: center;
    box-shadow: 0 4px 24px rgba(0,0,0,0.1); max-width: 400px; width: 100%;
  }
  .access-denied-card h2 {
    font-family: 'Playfair Display', serif;
    color: var(--danger); margin: 16px 0 8px;
  }
  .access-denied-card p { color: var(--text-muted); font-size: 0.88rem; margin-bottom: 24px; }
  .btn-outline {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 10px 28px; border: 2px solid var(--danger); color: var(--danger);
    background: white; border-radius: 8px; cursor: pointer;
    font-size: 0.88rem; font-weight: 600; font-family: 'Inter', sans-serif;
    transition: all 0.15s;
  }
  .btn-outline:hover { background: var(--danger); color: white; }

  /* ── Loading center ── */
  .loading-center {
    min-height: 100vh; display: flex; align-items: center;
    justify-content: center; background: var(--bg);
  }

  /* ── Info modal ── */
  .info-modal-overlay {
    position: fixed; inset: 0; z-index: 200;
    background: rgba(0,0,0,0.45);
    display: flex; align-items: center; justify-content: center;
    padding: 20px;
  }
  .info-modal-card {
    background: var(--surface); border-radius: 16px;
    padding: 28px 28px 24px; max-width: 460px; width: 100%;
    box-shadow: 0 20px 60px rgba(0,0,0,0.25);
    position: relative;
  }
  .info-modal-card h3 {
    font-family: 'Playfair Display', serif;
    font-size: var(--font-md); color: var(--primary);
    margin-bottom: 12px; padding-right: 24px;
  }
  .info-modal-card p {
    font-size: var(--font-sm); color: var(--text-muted);
    line-height: 1.7; margin: 0;
  }
  .info-modal-close {
    position: absolute; top: 16px; right: 16px;
    background: none; border: none; cursor: pointer;
    color: var(--text-muted); padding: 4px;
    border-radius: 4px; display: flex; align-items: center;
    transition: color 0.15s;
  }
  .info-modal-close:hover { color: var(--text); }
  .info-btn {
    background: none; border: none; cursor: pointer;
    color: var(--text-muted); padding: 2px 4px;
    display: inline-flex; align-items: center;
    border-radius: 4px; transition: color 0.15s;
    flex-shrink: 0;
  }
  .info-btn:hover { color: var(--primary); }

  /* ── Bottom nav (mobile only) ── */
  .bottom-nav { display: none; }

  /* ── Mobile breakpoints ── */
  @media (max-width: 768px) {
    .sidebar { display: none; }
    .intel-strip { padding: 0 12px; overflow-x: auto; top: 60px; }
    .intel-item { padding: 0 10px; }
    .main-content { padding: 16px 12px 80px; }
    .bottom-nav {
      display: flex; position: fixed;
      bottom: 0; left: 0; right: 0; z-index: 100;
      background: var(--surface); border-top: 1px solid #e5e7eb;
      height: 60px;
    }
    .bottom-nav-item {
      flex: 1; display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 3px; cursor: pointer; font-size: var(--font-xs);
      color: var(--text-muted); transition: color 0.15s;
      border: none; background: none; padding: 4px;
      font-family: 'Inter', sans-serif;
    }
    .bottom-nav-item.active { color: var(--primary); }
    .grid-4 { grid-template-columns: repeat(2, 1fr); }
    .grid-3 { grid-template-columns: repeat(2, 1fr); }
    .grid-2 { grid-template-columns: 1fr; }
    .countdown { gap: 8px; }
    .countdown-num { font-size: 1.8rem; padding: 6px 12px; min-width: 56px; }
    .app-header h1 { font-size: 1rem; }
  }
`

// ─────────────────────────────────────────────────────────────
// Utility hook — countdown to election
// ─────────────────────────────────────────────────────────────
function calcDiff(target) {
  const ms = new Date(target) - new Date()
  if (ms <= 0) return { days: 0, hours: 0, minutes: 0 }
  return {
    days:    Math.floor(ms / 86400000),
    hours:   Math.floor((ms % 86400000) / 3600000),
    minutes: Math.floor((ms % 3600000) / 60000),
  }
}
function useCountdown(target) {
  const [diff, setDiff] = useState(() => calcDiff(target))
  useEffect(() => {
    const id = setInterval(() => setDiff(calcDiff(target)), 60000)
    return () => clearInterval(id)
  }, [target])
  return diff
}

// ─────────────────────────────────────────────────────────────
// InfoModal — modal explicativo reutilizável
// ─────────────────────────────────────────────────────────────
function InfoModal({ title, body, onClose }) {
  // Fecha ao clicar no overlay
  return (
    <div className="info-modal-overlay" onClick={onClose}>
      <div className="info-modal-card" onClick={e => e.stopPropagation()}>
        <button className="info-modal-close" onClick={onClose} aria-label="Fechar">
          <X size={16} />
        </button>
        <h3>{title}</h3>
        <p>{body}</p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// ModulePanel — collapsible wrapper for every module
// ─────────────────────────────────────────────────────────────
function ModulePanel({ id, icon: Icon, title, badge, subtitle, info, children }) {
  const [open,    setOpen]    = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  return (
    <>
      {showInfo && info && (
        <InfoModal title={info.title} body={info.body} onClose={() => setShowInfo(false)} />
      )}
      <div className="module-panel" id={id}>
        <div className="module-header" onClick={() => setOpen(o => !o)}>
          <h2>
            {Icon && <Icon size={18} color="var(--accent)" />}
            {title}
            {badge && (
              <span className="badge" style={{ background: 'var(--accent)', color: '#1a1a1a', fontSize: 'var(--font-xs)' }}>
                {badge}
              </span>
            )}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {info && (
              <button className="info-btn" aria-label="Sobre este módulo"
                onClick={e => { e.stopPropagation(); setShowInfo(true) }}>
                <Info size={16} />
              </button>
            )}
            {open
              ? <ChevronUp size={18} color="var(--text-muted)" />
              : <ChevronDown size={18} color="var(--text-muted)" />
            }
          </div>
        </div>
        {open && (
          <div className="module-body">
            {subtitle && (
              <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', margin: '-8px 0 16px 0', fontStyle: 'italic' }}>
                {subtitle}
              </p>
            )}
            {children}
          </div>
        )}
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────
// M1 — Monitor de Imprensa
// ─────────────────────────────────────────────────────────────
function M1MonitorImprensa({ data }) {
  const [clusterFilter, setClusterFilter] = useState('ALL')
  const [minRel, setMinRel] = useState(0)

  const mentions = Array.isArray(data) ? data : []
  const clusters = ['ALL', ...Object.keys(CLUSTER_COLORS)]

  const filtered = mentions.filter(m => {
    if (clusterFilter !== 'ALL' && m.cluster !== clusterFilter) return false
    if ((m.relevance || m.relevancia || 0) < minRel) return false
    return true
  })

  return (
    <ModulePanel id="m1" icon={Newspaper} title="Monitor de Imprensa"
      subtitle="Menções ao Senador Eduardo Gomes na mídia — coletadas por Google News RSS em tempo real"
      info={{ title: 'Monitor de Imprensa', body: 'Coleta automática de notícias que mencionam o Senador Eduardo Gomes, rodando duas vezes ao dia. Cada menção recebe um score de relevância e um cluster temático, permitindo filtrar rapidamente o que importa do ruído.' }}>
      <div className="filter-bar">
        {clusters.map(c => (
          <button key={c} className={`filter-btn${clusterFilter === c ? ' active' : ''}`}
            onClick={() => setClusterFilter(c)}>
            {CLUSTER_LABELS[c] || c}
          </button>
        ))}
        <select
          value={minRel}
          onChange={e => setMinRel(+e.target.value)}
          style={{
            padding: '4px 10px', borderRadius: 20, border: '1px solid #e5e7eb',
            fontSize: 'var(--font-xs)', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            color: 'var(--text-muted)', background: 'white',
          }}>
          <option value={0}>Toda relevância</option>
          <option value={0.5}>Rel. ≥ 0.5</option>
          <option value={0.7}>Rel. ≥ 0.7</option>
          <option value={0.9}>Rel. ≥ 0.9</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <Newspaper size={32} />
          <p>{mentions.length === 0
            ? 'Nenhuma menção disponível — aguardando dados do scraper.'
            : 'Nenhuma menção com os filtros selecionados.'
          }</p>
        </div>
      ) : (
        filtered.map((m, i) => (
          <div key={i} className="mention-row">
            <span className="badge" style={{
              background: CLUSTER_COLORS[m.cluster] || '#888',
              boxShadow: clusterGlow(CLUSTER_COLORS[m.cluster] || '#888888'),
              flexShrink: 0, marginTop: 2,
            }}>
              {CLUSTER_LABELS[m.cluster] || m.cluster}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 'var(--font-md)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {m.titulo || m.title || 'Sem título'}
              </div>
              {m.snippet && (
                <div style={{ fontSize: 'var(--font-base)', lineHeight: 1.6, color: 'var(--text-muted)', marginTop: 4 }}>
                  {m.snippet}
                </div>
              )}
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginTop: 4, gap: 10 }}>
                {[
                  m.source || m.veiculo,
                  (m.published || m.data)
                    ? new Date(m.published || m.data).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
                    : null,
                  `rel. ${(m.relevance || m.relevancia || 0).toFixed(2)}`,
                ].filter(Boolean).join(' · ')}
              </div>
            </div>
          </div>
        ))
      )}
    </ModulePanel>
  )
}

// ─────────────────────────────────────────────────────────────
// M2 — Redes Sociais
// ─────────────────────────────────────────────────────────────
function M2RedesSociais({ metrics, sentiment }) {
  // Normaliza tanto o formato legado {aliados,adversarios} quanto o formato
  // atual do script {profiles: {handle: {tipo, followers, engagement_rate}}}
  const normalizeProfile = p => ({
    nome:           p.nome || p.handle,
    seguidores:     p.seguidores   ?? p.followers        ?? 0,
    engajamento_pct: p.engajamento_pct ?? p.engagement_rate ?? null,
    is_verified:    p.is_verified  ?? false,
    handle:         p.handle       || '',
  })

  let aliados, aliadosConcorrentes, adversarios
  if (metrics?.profiles) {
    const raw = Object.values(metrics.profiles)
    aliados            = raw.filter(p => p.tipo === 'senador').map(normalizeProfile)
    aliadosConcorrentes = raw.filter(p => p.tipo === 'aliado_concorrente').map(normalizeProfile)
    adversarios        = raw.filter(p => p.tipo === 'adversario').map(normalizeProfile)
  } else {
    aliados            = (metrics?.aliados     || []).map(normalizeProfile)
    aliadosConcorrentes = []
    adversarios        = (metrics?.adversarios || []).map(normalizeProfile)
  }
  const hasData = aliados.length > 0 || aliadosConcorrentes.length > 0 || adversarios.length > 0

  // Normaliza sentimento: formato {profiles:{handle:{...}}} ou {grupos:[...]}
  let sentGroup = []
  if (sentiment?.profiles) {
    sentGroup = Object.values(sentiment.profiles).map(s => ({
      grupo:    `@${s.handle} (${s.nome || s.handle})`,
      positivo: s.sentiment_proxy === 'positivo' ? s.engagement_rate?.toFixed(1) : null,
      negativo: s.sentiment_proxy === 'negativo' ? s.engagement_rate?.toFixed(1) : null,
      tier:     s.engagement_tier,
      proxy:    s.sentiment_proxy,
    }))
  } else {
    sentGroup = sentiment?.grupos || []
  }

  return (
    <ModulePanel id="m2" icon={Users} title="Redes Sociais"
      subtitle="Métricas Instagram do senador e do campo adversário — atualização semanal via Apify"
      info={{ title: 'Monitor de Redes Sociais', body: 'Acompanha semanalmente os perfis do senador e dos principais adversários no Instagram. Mostra seguidores, engajamento e variação semanal, separados por aliados e adversários.' }}>
      {!hasData ? (
        <div className="empty-state">
          <Users size={32} />
          <p>Métricas de redes sociais ainda não disponíveis.</p>
        </div>
      ) : (
        <>
          {aliados.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--success)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Senador
              </h3>
              <div className="grid-3">
                {aliados.map((a, i) => (
                  <div key={i} className="card">
                    <div style={{ fontWeight: 600, fontSize: 'var(--font-base)', marginBottom: 6 }}>{a.nome}</div>
                    <div style={{ fontSize: 'var(--font-md)', fontWeight: 700, color: 'var(--primary)', fontFamily: 'Playfair Display, serif' }}>
                      {a.seguidores?.toLocaleString('pt-BR') || '—'}
                    </div>
                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
                      seguidores{a.engajamento_pct != null ? ` · eng. ${a.engajamento_pct.toFixed(1)}%` : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {aliadosConcorrentes.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--accent)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Chapa Majoritária
              </h3>
              <div className="grid-3">
                {aliadosConcorrentes.map((a, i) => (
                  <div key={i} className="card" style={{ borderTop: '2px solid var(--accent)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <div style={{ fontWeight: 600, fontSize: 'var(--font-base)' }}>{a.nome}</div>
                      <span style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: '#1a1a1a', background: 'var(--accent)', borderRadius: 4, padding: '2px 6px', whiteSpace: 'nowrap' }}>
                        Aliado
                      </span>
                    </div>
                    <div style={{ fontSize: 'var(--font-md)', fontWeight: 700, color: 'var(--primary)', fontFamily: 'Playfair Display, serif' }}>
                      {a.seguidores?.toLocaleString('pt-BR') || '—'}
                    </div>
                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
                      seguidores{a.engajamento_pct != null ? ` · eng. ${a.engajamento_pct.toFixed(1)}%` : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {adversarios.length > 0 && (
            <div style={{ marginBottom: sentGroup.length > 0 ? 20 : 0 }}>
              <h3 style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--danger)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Adversários
              </h3>
              <div className="grid-3">
                {adversarios.map((a, i) => (
                  <div key={i} className="card">
                    <div style={{ fontWeight: 600, fontSize: 'var(--font-base)', marginBottom: 6 }}>{a.nome}</div>
                    <div style={{ fontSize: 'var(--font-md)', fontWeight: 700, color: 'var(--danger)', fontFamily: 'Playfair Display, serif' }}>
                      {a.seguidores?.toLocaleString('pt-BR') || '—'}
                    </div>
                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginTop: 2 }}>seguidores{a.engajamento_pct != null ? ` · eng. ${a.engajamento_pct.toFixed(1)}%` : ''}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {sentGroup.length > 0 && (
            <div>
              <h3 style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Sentimento
              </h3>
              <div className="grid-3">
                {sentGroup.map((g, i) => (
                  <div key={i} className="card">
                    <div style={{ fontWeight: 600, fontSize: 'var(--font-base)', marginBottom: 6 }}>{g.grupo}</div>
                    <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)' }}>
                      {g.proxy ? (
                        <>Engajamento: <strong style={{ color: g.proxy === 'positivo' ? 'var(--success)' : g.proxy === 'negativo' ? 'var(--danger)' : 'var(--text-muted)' }}>{g.tier}</strong></>
                      ) : (
                        <>Positivo: <strong style={{ color: 'var(--success)' }}>{g.positivo || 0}%</strong>{' · '}Negativo: <strong style={{ color: 'var(--danger)' }}>{g.negativo || 0}%</strong></>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </ModulePanel>
  )
}

// ─────────────────────────────────────────────────────────────
// M3 — Inteligência Municipal
// ─────────────────────────────────────────────────────────────
function M3InteligenciaMunicipal({ data }) {
  const [selected, setSelected] = useState(null)
  const municipios = data?.municipios || []
  const sorted = [...municipios].sort((a, b) => (b.score_potencial || 0) - (a.score_potencial || 0))

  return (
    <ModulePanel id="m3" icon={MapPin} title="Inteligência Municipal"
      subtitle="139 municípios do Tocantins ranqueados por potencial eleitoral — base TSE 2022 e entregas"
      info={{ title: 'Inteligência Municipal', body: 'Ranqueia os 139 municípios do Tocantins por potencial eleitoral, cruzando resultado das eleições de 2022 com o volume de emendas parlamentares destinadas pelo senador. Municípios vulneráveis sem entrega recebida são destacados como oportunidade estratégica.' }}>
      {municipios.length === 0 ? (
        <div className="empty-state">
          <MapPin size={32} />
          <p>Dados municipais ainda não disponíveis — aguardando sincronização do TSE.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220, maxHeight: 480, overflowY: 'auto' }}>
            {sorted.map((m, i) => {
              const score = m.score_potencial || 0
              const barColor = score >= 70 ? 'var(--success)' : score >= 40 ? 'var(--warning)' : 'var(--danger)'
              const isSelected = selected?.nome === m.nome
              return (
                <div key={i}
                  onClick={() => setSelected(isSelected ? null : m)}
                  style={{
                    padding: '10px 12px', borderRadius: 8, marginBottom: 6, cursor: 'pointer',
                    background: isSelected ? '#EEF2FF' : 'white',
                    border: `1px solid ${isSelected ? 'var(--primary)' : '#e5e7eb'}`,
                    transition: 'all 0.15s',
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 500, fontSize: 'var(--font-base)' }}>{m.nome}</span>
                    <span style={{ fontWeight: 700, color: barColor, fontSize: 'var(--font-sm)' }}>{score.toFixed(0)}</span>
                  </div>
                  <div className="progress-bar-wrap">
                    <div className="progress-bar-fill" style={{ width: `${Math.min(score, 100)}%`, background: barColor }} />
                  </div>
                </div>
              )
            })}
          </div>

          {selected && (
            <div style={{ width: 260, flexShrink: 0 }}>
              <div className="card" style={{ position: 'sticky', top: 76 }}>
                <h3 style={{ fontFamily: 'Playfair Display, serif', color: 'var(--primary)', marginBottom: 14, fontSize: 'var(--font-md)' }}>
                  {selected.nome}
                </h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-sm)' }}>
                  <tbody>
                    {[
                      ['Score Potencial', selected.score_potencial?.toFixed(1)],
                      ['Lacuna Score',    selected.lacuna_score?.toFixed(1)],
                      ['IVS',            selected.ivs?.toFixed(3)],
                      ['População',      selected.populacao?.toLocaleString('pt-BR')],
                      ['Prioridade',     selected.prioridade],
                    ].filter(([, v]) => v != null).map(([k, v]) => (
                      <tr key={k}>
                        <td style={{ color: 'var(--text-muted)', paddingBottom: 6 }}>{k}</td>
                        <td style={{ fontWeight: 600, textAlign: 'right', paddingBottom: 6 }}>{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button onClick={() => setSelected(null)}
                  style={{
                    marginTop: 14, width: '100%', padding: '7px',
                    borderRadius: 6, border: '1px solid #e5e7eb', cursor: 'pointer',
                    fontSize: 'var(--font-sm)', color: 'var(--text-muted)', background: 'white',
                    fontFamily: 'Inter, sans-serif',
                  }}>
                  Fechar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </ModulePanel>
  )
}

// ─────────────────────────────────────────────────────────────
// M4 — Radar Competitivo
// ─────────────────────────────────────────────────────────────
function M4InteligenciaCompetitiva({ data }) {
  const todos = data?.adversarios || []

  const aliados     = todos.filter(a => a.relacao === 'aliado_concorrente')
  const adversarios = todos.filter(a => a.relacao === 'adversario')
                           .sort((a, b) => (b.sad || 0) - (a.sad || 0))
  const influencias = todos.filter(a => a.relacao === 'influencia')

  const ameacaColor = { ALTA: 'var(--danger)', MEDIA: 'var(--warning)', BAIXA: 'var(--success)' }

  const secStyle = (borderColor, bgRgb) => ({
    borderLeft: `3px solid ${borderColor}`,
    background: `rgba(${bgRgb}, 0.04)`,
    borderRadius: '0 8px 8px 0',
    padding: '12px 16px',
    marginBottom: 20,
  })

  const secTitle = (label) => (
    <h3 style={{ fontSize: 'var(--font-sm)', fontWeight: 600, textTransform: 'uppercase',
      letterSpacing: 0.5, color: 'var(--text-muted)', marginBottom: 12 }}>
      {label}
    </h3>
  )

  return (
    <ModulePanel id="m4" icon={TrendingUp} title="Radar Competitivo — Aliados e Adversários"
      subtitle="Aliados, adversários e atores de influência — ordenados por ameaça e atualizado diariamente"
      info={{ title: 'Radar Competitivo', body: 'Monitora aliados e adversários do campo eleitoral. O SAD (Score de Ameaça Dinâmico) é um índice de 0 a 100 que combina base eleitoral histórica, presença digital, sobreposição de eleitorado e rejeição nas pesquisas. Recalculado automaticamente a cada coleta.' }}>
      {todos.length === 0 ? (
        <div className="empty-state">
          <TrendingUp size={32} />
          <p>Dados competitivos ainda não disponíveis.</p>
        </div>
      ) : (
        <>
          {/* Legenda */}
          <div style={{ display: 'flex', gap: 20, fontSize: 'var(--font-xs)', color: 'var(--text-muted)',
            marginBottom: 20, flexWrap: 'wrap', padding: '8px 12px',
            background: '#f8f9fa', borderRadius: 8 }}>
            <span>🟢 Chapa majoritária (risco de canibalismo)</span>
            <span>🔴 Adversários diretos</span>
            <span>⚫ Atores de influência</span>
          </div>

          {/* ── Seção A — Aliados / Chapa Majoritária ── */}
          {aliados.length > 0 && (
            <div>
              {secTitle('🟢 Chapa Majoritária')}
              <div style={secStyle('var(--success)', '45,122,79')}>
                {aliados.map((a, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                    gap: 12, paddingBottom: i < aliados.length - 1 ? 12 : 0,
                    borderBottom: i < aliados.length - 1 ? '1px solid rgba(45,122,79,0.12)' : 'none',
                    marginBottom: i < aliados.length - 1 ? 12 : 0 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, fontSize: 'var(--font-base)' }}>{a.nome}</span>
                        <span className="badge" style={{ background: '#e5e7eb', color: 'var(--text)', fontSize: 'var(--font-xs)' }}>
                          {a.partido}
                        </span>
                        <span className="badge" style={{ background: 'var(--accent)', color: '#1a1a0e', fontSize: 'var(--font-xs)' }}>
                          ⚠ Aliado-Concorrente
                        </span>
                      </div>
                      {a.nota && (
                        <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', lineHeight: 1.5 }}>{a.nota}</div>
                      )}
                    </div>
                    {a.seguidores > 0 && (
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 'var(--font-md)', color: 'var(--primary)',
                          fontFamily: 'Playfair Display, serif' }}>
                          {a.seguidores.toLocaleString('pt-BR')}
                        </div>
                        <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
                          seg · eng {a.engajamento?.toFixed(2)}%
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Seção B — Adversários Diretos ── */}
          {adversarios.length > 0 && (
            <div>
              {secTitle('🔴 Adversários Diretos')}
              <div style={secStyle('var(--danger)', '192,57,43')}>
                <div className="table-wrap" style={{ margin: 0 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Nome</th>
                        <th>Partido</th>
                        <th>SAD</th>
                        <th>Ameaça</th>
                        <th>Alerta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adversarios.map((adv, i) => (
                        <tr key={i}>
                          <td style={{ color: 'var(--text-muted)', fontWeight: 700 }}>{i + 1}</td>
                          <td style={{ fontWeight: 600, fontSize: 'var(--font-base)' }}>{adv.nome}</td>
                          <td>
                            <span className="badge" style={{ background: '#e5e7eb', color: 'var(--text)' }}>
                              {adv.partido}
                            </span>
                          </td>
                          <td style={{ fontWeight: 700, color: 'var(--primary)',
                            fontFamily: 'Playfair Display, serif', fontSize: 'var(--font-md)' }}>
                            {adv.sad != null ? adv.sad.toFixed(0) : '—'}
                          </td>
                          <td>
                            <span style={{ color: ameacaColor[adv.classificacao] || 'var(--text-muted)',
                              fontWeight: 600, fontSize: 'var(--font-sm)' }}>
                              {adv.classificacao || '—'}
                            </span>
                          </td>
                          <td>
                            {adv.alerta === 'candidato_renovacao' && (
                              <span className="badge" style={{ background: 'var(--warning)' }}>
                                ⚠ Renovação
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── Seção C — Atores de Influência ── */}
          {influencias.length > 0 && (
            <div>
              {secTitle('⚫ Atores de Influência')}
              <div style={secStyle('var(--text-muted)', '107,114,128')}>
                {influencias.map((inf, i) => (
                  <div key={i}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontWeight: 600, fontSize: 'var(--font-base)' }}>{inf.nome}</span>
                      <span className="badge" style={{ background: '#e5e7eb', color: 'var(--text)', fontSize: 'var(--font-xs)' }}>
                        {inf.partido}
                      </span>
                    </div>
                    {inf.nota && (
                      <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                        {inf.nota}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </ModulePanel>
  )
}

// ─────────────────────────────────────────────────────────────
// M5 — KPIs de Campanha
// ─────────────────────────────────────────────────────────────
function M5KPIs({ data }) {
  const kpis       = data?.kpis        || []
  const eleicao    = data?.eleicao_data || '2026-10-04'
  const faseAtual  = data?.fase_atual   || 1
  const countdown  = useCountdown(eleicao)

  const eleicaoStr = new Date(eleicao + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric'
  })

  const chartData = kpis.map(k => ({
    name: k.label.length > 18 ? k.label.slice(0, 16) + '…' : k.label,
    atual: k.valor_atual || 0,
    meta:  k.metas?.[String(faseAtual)] || 0,
  }))

  return (
    <ModulePanel id="m5" icon={Target} title="KPIs de Campanha"
      subtitle={`Metas da Fase ${faseAtual} · Eleição em ${countdown.days} dias · Dados atualizados pelo scraper`}
      info={{ title: 'KPIs de Campanha', body: '8 indicadores estratégicos com metas definidas por fase até a eleição de 4 de outubro de 2026. As barras mostram o progresso atual em relação à meta da fase vigente.' }}>
      {/* Countdown */}
      <div style={{ textAlign: 'center', marginBottom: 4 }}>
        <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
          Eleição · {eleicaoStr}
        </div>
        <div className="countdown">
          {[['dias', countdown.days], ['horas', countdown.hours], ['min', countdown.minutes]].map(([label, val]) => (
            <div key={label} className="countdown-unit">
              <span className="countdown-num">{String(val).padStart(2, '0')}</span>
              <div className="countdown-label">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {kpis.length === 0 ? (
        <div className="empty-state" style={{ paddingTop: 20 }}>
          <Target size={28} />
          <p>KPIs ainda não disponíveis.</p>
        </div>
      ) : (
        <>
          <div className="grid-4" style={{ marginBottom: 24 }}>
            {kpis.map(k => {
              const meta = k.metas?.[String(faseAtual)] || 0
              const pct  = meta > 0 ? Math.min((k.valor_atual / meta) * 100, 100) : 0
              const ok   = k.inverso ? k.valor_atual <= meta : k.valor_atual >= meta
              return (
                <div key={k.id} className="kpi-card">
                  <div className="kpi-value">{k.valor_atual}{k.unidade}</div>
                  <div className="kpi-label">{k.label}</div>
                  <div className="progress-bar-wrap">
                    <div className="progress-bar-fill"
                      style={{ width: `${pct}%`, background: ok ? 'var(--success)' : 'var(--warning)' }} />
                  </div>
                  <div className="kpi-meta">Meta F{faseAtual}: {meta}{k.unidade}</div>
                </div>
              )
            })}
          </div>

          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} margin={{ top: 4, right: 10, left: 0, bottom: 64 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-35} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="atual" name="Atual"              fill="var(--primary)" radius={[4,4,0,0]} />
              <Bar dataKey="meta"  name={`Meta F${faseAtual}`} fill="var(--accent)"  radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </>
      )}
    </ModulePanel>
  )
}

// ─────────────────────────────────────────────────────────────
// M6 — Briefing Diário
// ─────────────────────────────────────────────────────────────
function M6BriefingDiario({ mentions }) {
  const now       = new Date()
  const yesterday = new Date(now.getTime() - 24 * 3600 * 1000)

  const items = (Array.isArray(mentions) ? mentions : [])
    .filter(m => (m.relevance || m.relevancia || 0) >= 0.9 && new Date(m.published || m.data || m.date || 0) >= yesterday)
    .sort((a, b) => (b.relevance || b.relevancia || 0) - (a.relevance || a.relevancia || 0))

  const handleDownload = () => {
    const header = `BRIEFING DIÁRIO — Eduardo Gomes\n${now.toLocaleString('pt-BR')}\n${'─'.repeat(50)}\n\n`
    const body = items.length > 0
      ? items.map(m => `[${m.cluster}] ${m.titulo || m.title}\n${[m.source || m.veiculo, m.published || m.data, `rel. ${m.relevance || m.relevancia}`].filter(Boolean).join(' · ')}\n`).join('\n')
      : 'Nenhuma menção de alta relevância nas últimas 24 horas.\n'
    const blob = new Blob([header + body], { type: 'text/plain;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `briefing_${now.toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <ModulePanel id="m6" icon={FileText} title="Briefing Diário"
      subtitle="Resumo executivo gerado automaticamente às 07h30 — menções com relevância ≥ 0.90"
      info={{ title: 'Briefing Diário', body: 'Resumo executivo gerado automaticamente às 07h30 e enviado por e-mail com PDF anexo. Consolida as menções mais relevantes do dia, variação nas redes sociais, alertas de crise e ranking de ameaça dos adversários.' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12 }}>
        <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)' }}>
          Menções de alta relevância (≥ 0.9) — últimas 24h
        </span>
        <button onClick={handleDownload}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
            padding: '7px 14px', background: 'var(--primary)', color: 'white',
            border: 'none', borderRadius: 8, cursor: 'pointer',
            fontSize: 'var(--font-sm)', fontWeight: 600, fontFamily: 'Inter, sans-serif',
          }}>
          <Download size={13} /> Download
        </button>
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <FileText size={32} />
          <p>Nenhuma menção de alta relevância nas últimas 24 horas.</p>
        </div>
      ) : (
        items.map((m, i) => (
          <div key={i} className="mention-row">
            <span className="badge" style={{
              background: CLUSTER_COLORS[m.cluster] || '#888',
              boxShadow: clusterGlow(CLUSTER_COLORS[m.cluster] || '#888888'),
              flexShrink: 0, marginTop: 2,
            }}>
              {CLUSTER_LABELS[m.cluster] || m.cluster}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 'var(--font-base)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {m.titulo || m.title}
              </div>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
                {[
                  m.source || m.veiculo,
                  (m.published || m.data) ? new Date(m.published || m.data).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : null,
                  `rel. ${(m.relevance || m.relevancia || 0).toFixed(2)}`,
                ].filter(Boolean).join(' · ')}
              </div>
            </div>
          </div>
        ))
      )}
    </ModulePanel>
  )
}

// ─────────────────────────────────────────────────────────────
// M7 — Radar de Entregas
// ─────────────────────────────────────────────────────────────
function M7RadarEntregas({ data }) {
  const raw = data?.municipios
  const municipios  = Array.isArray(raw) ? raw : (raw && typeof raw === 'object' ? Object.values(raw) : [])
  const totalGeral  = municipios.reduce((s, m) => s + (m.valor_total || 0), 0)

  const chartData = [...municipios]
    .sort((a, b) => (b.valor_total || 0) - (a.valor_total || 0))
    .slice(0, 15)
    .map(m => ({
      nome:  m.nome?.length > 10 ? m.nome.slice(0, 9) + '…' : (m.nome || ''),
      valor: ((m.valor_total || 0) / 1e6),
    }))

  const badgeLabel = totalGeral > 0 ? `R$ ${(totalGeral / 1e9).toFixed(1)}bi` : null

  return (
    <ModulePanel id="m7" icon={Package2} title="Radar de Entregas"
      subtitle="Emendas parlamentares destinadas ao Tocantins no mandato 2019–2026 — Portal da Transparência"
      info={{ title: 'Radar de Entregas', body: 'Mapa das emendas parlamentares destinadas pelo Senador Eduardo Gomes aos municípios tocantinenses entre 2019 e 2026, com base no Portal da Transparência Federal. Mais de R$ 2 bilhões entregues ao longo do mandato.' }}>
      {municipios.length === 0 ? (
        <div className="empty-state">
          <Package2 size={32} />
          <p>Dados de emendas ainda não disponíveis — aguardando sincronização.</p>
        </div>
      ) : (
        <>
          <div className="grid-3" style={{ marginBottom: 20 }}>
            <div className="card">
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginBottom: 6 }}>Total emendas</div>
              <div style={{ fontSize: 'var(--font-xl)', fontWeight: 700, color: 'var(--primary)', fontFamily: 'Playfair Display, serif' }}>
                R$ {(totalGeral / 1e9).toFixed(2)}bi
              </div>
            </div>
            <div className="card">
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginBottom: 6 }}>Municípios beneficiados</div>
              <div style={{ fontSize: 'var(--font-xl)', fontWeight: 700, color: 'var(--success)', fontFamily: 'Playfair Display, serif' }}>
                {municipios.length}
              </div>
            </div>
            <div className="card">
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginBottom: 6 }}>Média / município</div>
              <div style={{ fontSize: 'var(--font-xl)', fontWeight: 700, color: 'var(--accent)', fontFamily: 'Playfair Display, serif' }}>
                R$ {((totalGeral / municipios.length) / 1e6).toFixed(1)}M
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 4, right: 10, left: 20, bottom: 64 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="nome" tick={{ fontSize: 9 }} angle={-35} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$${v}M`} />
              <Tooltip formatter={v => [`R$ ${Number(v).toFixed(1)}M`, 'Emendas']} />
              <Bar dataKey="valor" name="Emendas (R$ M)" fill="var(--accent)" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </>
      )}
    </ModulePanel>
  )
}

// ─────────────────────────────────────────────────────────────
// Ticker — marquee com últimas 3 menções
// ─────────────────────────────────────────────────────────────
function Ticker({ mentions }) {
  const items = (Array.isArray(mentions) ? mentions : [])
    .slice()
    .sort((a, b) => new Date(b.published || b.data || b.date || 0) - new Date(a.published || a.data || a.date || 0))
    .slice(0, 3)

  if (items.length === 0) return null

  // Duplicamos para efeito de loop contínuo
  const doubled = [...items, ...items]

  return (
    <div className="ticker-wrap">
      <span className="ticker-label">AO VIVO</span>
      <div className="ticker-track">
        <div className="ticker-inner">
          {doubled.map((m, i) => (
            <span key={i} className="ticker-item">
              <span className="ticker-dot" />
              <span style={{ color: CLUSTER_COLORS[m.cluster] || 'var(--accent)', fontWeight: 600 }}>
                {CLUSTER_LABELS[m.cluster] || m.cluster}
              </span>
              <span>{m.titulo || m.title || 'Sem título'}</span>
              {m.veiculo && <span style={{ opacity: 0.55 }}>— {m.veiculo}</span>}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// IntelStrategica — faixa sticky abaixo do header
// ─────────────────────────────────────────────────────────────
const FASE_NOMES = {
  1: 'Construção de Base',
  2: 'Expansão',
  3: 'Consolidação',
  4: 'Reta Final',
}

function IntelStrategica({ kpis, adversariosData }) {
  const eleicao   = kpis?.eleicao_data || '2026-10-04'
  const faseAtual = kpis?.fase_atual   || 1
  const countdown = useCountdown(eleicao)

  const adversarios = adversariosData?.adversarios || []
  const topAdv  = adversarios.length > 0
    ? [...adversarios].sort((a, b) => (b.sad || 0) - (a.sad || 0))[0]
    : null
  const alertAdv = adversarios.find(a => a.alerta === 'candidato_renovacao')

  const ameacaColor = { ALTA: '#ff6b6b', MEDIA: '#ffd166', BAIXA: '#6bcb77' }

  return (
    <div className="intel-strip">
      {/* Countdown */}
      <div className="intel-item">
        <span className="intel-item-label">Dias p/ eleição</span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{ fontSize: 'var(--font-xl)', fontWeight: 800, fontFamily: 'Playfair Display, serif', color: 'var(--accent)', lineHeight: 1 }}>
            {countdown.days}
          </span>
          <span style={{ fontSize: 'var(--font-xs)', opacity: 0.65 }}>dias</span>
        </div>
      </div>

      <div className="intel-divider" />

      {/* Fase */}
      <div className="intel-item">
        <span className="intel-item-label">Fase atual</span>
        <span className="intel-item-value">
          F{faseAtual} — {FASE_NOMES[faseAtual] || `Fase ${faseAtual}`}
        </span>
      </div>

      {topAdv && (
        <>
          <div className="intel-divider" />
          <div className="intel-item">
            <span className="intel-item-label">Maior SAD adversário</span>
            <span className="intel-item-value">
              {topAdv.nome}
              {' · '}
              <span style={{ color: 'var(--accent)' }}>{topAdv.sad?.toFixed(0)} pts</span>
              {topAdv.ameaca && (
                <span style={{ color: ameacaColor[topAdv.ameaca] || '#ccc', marginLeft: 4, fontSize: 'var(--font-xs)' }}>
                  {topAdv.ameaca}
                </span>
              )}
            </span>
          </div>
        </>
      )}

      {alertAdv && (
        <>
          <div className="intel-divider" />
          <div className="intel-item">
            <span className="intel-item-label">Alerta</span>
            <span className="intel-item-value" style={{ color: '#FFBB33' }}>
              ⚠ {alertAdv.nome}: candidato de renovação
              {alertAdv.rejeicao != null ? `, rejeição ${alertAdv.rejeicao}%` : ''}
            </span>
          </div>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// LoginScreen
// ─────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  const handleSubmit = async e => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const { data, error: authErr } = await supabase.auth.signInWithPassword({ email, password })
      if (authErr) throw authErr
      onLogin(data.session)
    } catch (err) {
      setError(err.message || 'Erro ao autenticar. Verifique suas credenciais.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1>Monitor <span className="logo-accent">Eduardo Gomes</span></h1>
        <p>Dashboard de Inteligência Eleitoral · Campanha 2026 · PL-TO</p>
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">E-mail</label>
            <input id="email" type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com" required autoFocus />
          </div>
          <div className="form-group">
            <label htmlFor="pwd">Senha</label>
            <input id="pwd" type="password" value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" required />
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading
              ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Entrando…</>
              : 'Entrar'
            }
          </button>
        </form>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// AccessDenied
// ─────────────────────────────────────────────────────────────
function AccessDenied({ onLogout }) {
  return (
    <div className="access-denied">
      <div className="access-denied-card">
        <Shield size={48} color="var(--danger)" />
        <h2>Acesso Negado</h2>
        <p>Sua conta não está autorizada a acessar este dashboard.</p>
        <button className="btn-outline" onClick={onLogout}>
          <LogOut size={16} /> Sair
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// App — root component
// ─────────────────────────────────────────────────────────────
export default function App() {
  const [session,    setSession]    = useState(undefined)  // undefined = initializing
  const [authorized, setAuthorized] = useState(null)       // null = checking
  const [activeNav,  setActiveNav]  = useState('m4')
  const [dataLoading, setDataLoading] = useState(true)
  const [data, setData] = useState({
    mentions: [], socialMetrics: {}, socialSentiment: {},
    geoElectoral: {}, adversarios: {}, kpis: {}, entregas: {},
  })

  // Supabase session init (skipped in dev bypass mode)
  useEffect(() => {
    if (DEV_BYPASS) {
      setSession({ user: { email: 'dev@bypass.local' } })
      setAuthorized(true)
      return
    }
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s ?? null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Check allowed_users table on login (skipped in dev bypass mode)
  useEffect(() => {
    if (DEV_BYPASS) return
    if (!session) { setAuthorized(null); return }
    supabase
      .from('allowed_users')
      .select('email')
      .eq('email', session.user.email)
      .limit(1)
      .then(({ data: rows }) => setAuthorized(!!(rows && rows.length > 0)))
  }, [session])

  // Parallel data fetch
  useEffect(() => {
    if (!session || authorized === false || authorized === null) return
    setDataLoading(true)
    Promise.all([
      fetch(BASE + 'mention_history.json').then(r => r.json()).catch(() => []),
      fetch(BASE + 'social_metrics.json').then(r => r.json()).catch(() => ({})),
      fetch(BASE + 'social_sentiment.json').then(r => r.json()).catch(() => ({})),
      fetch(BASE + 'geo_electoral.json').then(r => r.json()).catch(() => ({})),
      fetch(BASE + 'adversarios.json').then(r => r.json()).catch(() => ({})),
      fetch(BASE + 'campaign_kpis.json').then(r => r.json()).catch(() => ({})),
      fetch(BASE + 'entregas_municipios.json').then(r => r.json()).catch(() => ({})),
    ]).then(([mentions, socialMetrics, socialSentiment, geoElectoral, adversarios, kpis, entregas]) => {
      setData({ mentions, socialMetrics, socialSentiment, geoElectoral, adversarios, kpis, entregas })
    }).finally(() => setDataLoading(false))
  }, [session, authorized])

  const handleLogout = useCallback(async () => {
    if (!DEV_BYPASS) await supabase.auth.signOut()
    setSession(null); setAuthorized(null)
  }, [])

  const scrollTo = id => {
    setActiveNav(id)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  useHeaderScroll()
  useScrollReveal(!dataLoading)

  // Always render global styles first
  const styles = (
    <>
      <style>{GLOBAL_CSS}</style>
    </>
  )

  // Initializing
  if (session === undefined) {
    return (
      <>
        {styles}
        <div className="loading-center">
          <Loader2 size={40} color="var(--primary)" style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      </>
    )
  }

  // Not logged in
  if (!session) {
    return (
      <>
        {styles}
        <LoginScreen onLogin={s => setSession(s)} />
      </>
    )
  }

  // Checking authorization
  if (authorized === null) {
    return (
      <>
        {styles}
        <div className="loading-center">
          <Loader2 size={40} color="var(--primary)" style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      </>
    )
  }

  // Not authorized
  if (authorized === false) {
    return (
      <>
        {styles}
        <AccessDenied onLogout={handleLogout} />
      </>
    )
  }

  // Dashboard
  return (
    <>
      {styles}

      {/* Sticky header */}
      <header className="app-header">
        <div>
          <h1>Monitor Eduardo Gomes</h1>
          <div className="subtitle">Inteligência Eleitoral · Campanha 2026 · PL-TO</div>
        </div>
        <button className="btn-logout" onClick={handleLogout}>
          <LogOut size={14} /> Sair
        </button>
      </header>

      {/* Ticker — marquee menções recentes (abaixo do header, acima da intel strip) */}
      <Ticker mentions={data.mentions} />

      {/* Intel strip — sticky abaixo do ticker */}
      <IntelStrategica kpis={data.kpis} adversariosData={data.adversarios} />

      <div className="app-layout">
        {/* Sidebar — desktop */}
        <nav className="sidebar">
          {NAV_ITEMS.map(({ id, label, Icon }) => (
            <div key={id}
              className={`sidebar-item${activeNav === id ? ' active' : ''}`}
              onClick={() => scrollTo(id)}>
              <Icon size={16} />
              <span>{label}</span>
            </div>
          ))}
        </nav>

        {/* Main content */}
        <main className="main-content">
          {dataLoading && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, color: 'var(--text-muted)', fontSize: 'var(--font-sm)' }}>
              <Loader2 size={15} style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
              Carregando dados do repositório…
            </div>
          )}

          <M4InteligenciaCompetitiva data={data.adversarios} />
          <M5KPIs               data={data.kpis} />
          <M3InteligenciaMunicipal data={data.geoElectoral} />
          <M2RedesSociais       metrics={data.socialMetrics} sentiment={data.socialSentiment} />
          <M7RadarEntregas      data={data.entregas} />
          <M6BriefingDiario     mentions={data.mentions} />
          <M1MonitorImprensa    data={data.mentions} />
        </main>
      </div>

      {/* Bottom nav — mobile */}
      <nav className="bottom-nav">
        {NAV_ITEMS.map(({ id, label, Icon }) => (
          <button key={id}
            className={`bottom-nav-item${activeNav === id ? ' active' : ''}`}
            onClick={() => scrollTo(id)}>
            <Icon size={20} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </>
  )
}
