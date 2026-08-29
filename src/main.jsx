import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Home,
  Receipt,
  ChartNoAxesCombined,
  Settings,
  Plus,
  X,
  CalendarDays,
  Check,
  Pencil,
  Trash2,
} from 'lucide-react'
import './styles.css'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((error) => {
      console.error('Service worker registration failed:', error)
    })
  })
}

const KEY = 'idarat-ratbi-v3'

const defaults = {
  salary: 15000,
  fixed: 4250,
  cycleDay: 27,
  financeStart: '',
}

const fmt = n =>
  new Intl.NumberFormat('ar-SA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.max(0, Number(n) || 0))

// نفس التنسيق لكن بدون قصّ القيم السالبة (نحتاجها لعرض الخسارة بإشارة سالبة)
const fmtSigned = n => {
  const num = Number(n) || 0
  const sign = num > 0 ? '+' : ''
  return `${sign}${new Intl.NumberFormat('ar-SA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)}`
}

// عرض التواريخ داخل التطبيق بالتقويم الميلادي دائمًا
const fmtDate = d =>
  new Intl.DateTimeFormat('ar-SA', {
    calendar: 'gregory',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d)

const fmtDay = d =>
  new Intl.DateTimeFormat('ar-SA', {
    calendar: 'gregory',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d)

const toKey = d => {
  const x = new Date(d)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

const fromKey = s => new Date(`${s}T12:00:00`)

const addDays = (d, n) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

const dayCount = (a, b) =>
  Math.max(0, Math.round((b - a) / 86400000) + 1)

function getCycle(d, cycleDay = 27) {
  const x = new Date(d)
  x.setHours(12, 0, 0, 0)
  let start = new Date(x.getFullYear(), x.getMonth(), cycleDay, 12)
  if (x < start) start = new Date(x.getFullYear(), x.getMonth() - 1, cycleDay, 12)
  return {
    start,
    end: new Date(start.getFullYear(), start.getMonth() + 1, cycleDay - 1, 12),
  }
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY))
    return {
      settings: { ...defaults, ...(saved?.settings || {}) },
      expenses: Array.isArray(saved?.expenses) ? saved.expenses : [],
    }
  } catch {
    return { settings: defaults, expenses: [] }
  }
}

function calculateFinance(startDate) {
  if (!startDate) return { done: 0, left: 60, end: null, progress: 0 }
  const start = new Date(`${startDate}T12:00:00`)
  if (Number.isNaN(start.getTime())) return { done: 0, left: 60, end: null, progress: 0 }

  const end = new Date(start.getFullYear(), start.getMonth() + 60, start.getDate(), 12)
  const now = new Date()
  now.setHours(12, 0, 0, 0)

  let done = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
  if (now.getDate() < start.getDate()) done -= 1
  done = Math.max(0, Math.min(60, done))

  return { done, left: 60 - done, end, progress: (done / 60) * 100 }
}

function App() {
  const [state, setState] = useState(load)
  const [tab, setTab] = useState('home')
  const [sheet, setSheet] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ amount: '', desc: '', date: toKey(new Date()) })

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(state))
  }, [state])

  const cycle = getCycle(new Date(), Number(state.settings.cycleDay) || 27)
  const expenses = state.expenses.filter(e => fromKey(e.date) >= cycle.start && fromKey(e.date) <= cycle.end)
  const available = Math.max(0, Number(state.settings.salary) - Number(state.settings.fixed))
  const spent = expenses.reduce((sum, e) => sum + Number(e.amount), 0)
  const remaining = Math.max(0, available - spent)
  const remainingDays = Math.max(1, dayCount(new Date(Math.max(Date.now(), cycle.start.getTime())), cycle.end))
  const daily = remaining / remainingDays
  const todaySpent = expenses.filter(e => e.date === toKey(new Date())).reduce((sum, e) => sum + Number(e.amount), 0)
  const percentage = available ? (remaining / available) * 100 : 0
  const finance = calculateFinance(state.settings.financeStart)

  const groups = useMemo(() => {
    const map = {}
    expenses.forEach(e => {
      if (!map[e.date]) map[e.date] = []
      map[e.date].push(e)
    })
    return Object.entries(map)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([dateKey, items]) => ({
        date: dateKey,
        total: items.reduce((sum, e) => sum + Number(e.amount), 0),
        items,
      }))
  }, [expenses])

  function openAdd() {
    setEditId(null)
    setForm({ amount: '', desc: '', date: toKey(new Date()) })
    setSheet(true)
  }

  function openEdit(expense) {
    setEditId(expense.id)
    setForm({ amount: expense.amount, desc: expense.desc, date: expense.date })
    setSheet(true)
  }

  function closeSheet() {
    setSheet(false)
    setEditId(null)
    setForm({ amount: '', desc: '', date: toKey(new Date()) })
  }

  function saveExpense() {
    const amount = Number(form.amount)
    if (!amount || amount <= 0 || !form.date) return

    const item = {
      id: editId || crypto.randomUUID(),
      amount,
      desc: form.desc.trim(),
      date: form.date,
    }

    setState(current => ({
      ...current,
      expenses: editId
        ? current.expenses.map(e => (e.id === editId ? item : e))
        : [...current.expenses, item],
    }))
    closeSheet()
  }

  function deleteExpense(id) {
    setState(current => ({
      ...current,
      expenses: current.expenses.filter(e => e.id !== id),
    }))
  }

  return (
    <div className="app">
      <main>
        {tab === 'home' && (
          <HomePage
            cycle={cycle}
            remaining={remaining}
            available={available}
            percentage={percentage}
            daily={daily}
            todaySpent={todaySpent}
            remainingDays={remainingDays}
            spent={spent}
            finance={finance}
            financeStart={state.settings.financeStart}
            openAdd={openAdd}
          />
        )}

        {tab === 'log' && (
          <ExpensePage
            groups={groups}
            spent={spent}
            onEdit={openEdit}
            onDelete={deleteExpense}
          />
        )}

        {tab === 'stats' && (
          <StatsPage
            cycle={cycle}
            expenses={expenses}
            spent={spent}
            remaining={remaining}
            settings={state.settings}
          />
        )}

        {tab === 'settings' && (
          <SettingsPage
            settings={state.settings}
            onSave={settings => setState(current => ({ ...current, settings }))}
          />
        )}
      </main>

      <nav className="bottom-nav" aria-label="التنقل الرئيسي">
        {[
          [Home, 'home', 'الرئيسية'],
          [Receipt, 'log', 'المصروفات'],

          [ChartNoAxesCombined, 'stats', 'الإحصائيات'],
          [Settings, 'settings', 'الإعدادات'],
        ].map(([Icon, key, label]) => (
          <button key={key} className={tab === key ? 'on' : ''} onClick={() => setTab(key)}>
            <Icon size={22} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {sheet && (
        <ExpenseSheet
          form={form}
          setForm={setForm}
          edit={Boolean(editId)}
          onClose={closeSheet}
          onSave={saveExpense}
        />
      )}

    </div>
  )
}

function Header({ title, sub }) {
  return (
    <header>
      <h1>{title}</h1>
      <p>{sub}</p>
    </header>
  )
}

function HomePage({ cycle, remaining, available, percentage, daily, todaySpent, remainingDays, spent, finance, financeStart, openAdd }) {
  const r = 74
  const circumference = 2 * Math.PI * r
  const dash = circumference * Math.max(0, Math.min(100, percentage)) / 100

  return (
    <section>
      <Header
        title="إدارة راتبي"
        sub={`دورة ${fmtDate(cycle.start)} — ${fmtDate(cycle.end)}`}
      />

      <div className="balance">
        <span>المتبقي</span>
        <b>{fmt(remaining)} <i>ريال</i></b>
        <div className="ring">
          <svg viewBox="0 0 180 180">
            <circle className="bg" cx="90" cy="90" r={r} />
            <circle className="val" cx="90" cy="90" r={r} strokeDasharray={`${dash} ${circumference - dash}`} />
          </svg>
          <div>
            <strong>{Math.round(percentage)}%</strong>
            <small>متبقي</small>
          </div>
        </div>
        <em>من أصل {fmt(available)} ريال متاح</em>
      </div>

      <div className="daily">
        <span>حد الصرف اليومي</span>
        <strong>{fmt(daily)} <i>ريال</i></strong>
        <small>
          المتاح بعد صرف اليوم
          <b>{fmt(Math.max(0, daily - todaySpent))} ريال</b>
        </small>
      </div>

      <div className="mini">
        <div><span>صرف اليوم</span><b>{fmt(todaySpent)} ريال</b></div>
        <div><span>باقي الأيام</span><b>{remainingDays} يوم</b></div>
        <div><span>مصروفات الدورة</span><b>{fmt(spent)} ريال</b></div>
      </div>

      <button className="add" onClick={openAdd}>
        <Plus size={21} />
        إضافة مصروف
      </button>

      <FinanceCard finance={finance} financeStart={financeStart} />
    </section>
  )
}

function FinanceCard({ finance, financeStart }) {
  return (
    <div className="finance-card">
      <div className="finance-head">
        <div>
          <span>التمويل</span>
          <h2>{finance.left} <small>شهر متبقي</small></h2>
        </div>
      </div>

      <div className="finance-progress">
        <div className="finance-progress-value" style={{ width: `${finance.progress}%` }} />
      </div>

      <div className="finance-stats">
        <div>
          <span className="green-dot" />
          <div><b className="green">{finance.done}</b><small>شهر مضت</small></div>
        </div>
        <div>
          <span className="red-dot" />
          <div><b className="red">{finance.left}</b><small>شهر متبقي</small></div>
        </div>
        <div>
          <div><b>60</b><small>إجمالي الأشهر</small></div>
        </div>
      </div>

      <div className="finance-dates">
        <div><span>البداية</span><b>{financeStart ? fmtDate(fromKey(financeStart)) : '—'}</b></div>
        <div><span>النهاية</span><b>{finance.end ? fmtDate(finance.end) : '—'}</b></div>
      </div>
    </div>
  )
}

function ExpensePage({ groups, spent, onEdit, onDelete }) {
  return (
    <section>
      <Header title="المصروفات" sub={`إجمالي الدورة: ${fmt(spent)} ريال`} />
      {!groups.length ? (
        <div className="empty">لا توجد مصروفات في هذه الدورة.</div>
      ) : groups.map(group => (
        <div className="day" key={group.date}>
          <div className="dayhead">
            <span>{fmtDay(fromKey(group.date))}</span>
            <b>{fmt(group.total)} ريال</b>
          </div>
          <details>
            <summary>التفاصيل</summary>
            {group.items.map(expense => (
              <div className="row" key={expense.id}>
                <span>{expense.desc || 'مصروف'}</span>
                <b>{fmt(expense.amount)} ريال</b>
                <button onClick={() => onEdit(expense)} aria-label="تعديل"><Pencil size={15} /></button>
                <button onClick={() => onDelete(expense.id)} aria-label="حذف"><Trash2 size={15} /></button>
              </div>
            ))}
          </details>
        </div>
      ))}
    </section>
  )
}

function StatsPage({ cycle, expenses, spent, remaining, settings }) {
  const totalDays = dayCount(cycle.start, cycle.end)
  const rows = Array.from({ length: totalDays }, (_, i) => {
    const d = addDays(cycle.start, i)
    const k = toKey(d)
    const value = expenses.filter(e => e.date === k).reduce((sum, e) => sum + Number(e.amount), 0)
    return { date: d, value }
  })
  const max = Math.max(0, ...rows.map(r => r.value))
  const nonZero = rows.filter(r => r.value > 0)
  const highest = nonZero.length ? Math.max(...nonZero.map(r => r.value)) : 0
  const lowest = nonZero.length ? Math.min(...nonZero.map(r => r.value)) : 0

  return (
    <section>
      <Header title="الإحصائيات" sub="كامل الدورة المالية" />
      <div className="stats">
        <div><span>الراتب</span><b>{fmt(settings.salary)} ريال</b></div>
        <div><span>الثابت</span><b>{fmt(settings.fixed)} ريال</b></div>
        <div><span>المصروفات</span><b>{fmt(spent)} ريال</b></div>
        <div><span>المتبقي</span><b>{fmt(remaining)} ريال</b></div>
      </div>
      <div className="chart">
        <h3>المصروفات اليومية</h3>
        <div className="bars">
          {rows.map(row => (
            <div key={toKey(row.date)} title={`${fmt(row.value)} ريال`}>
              <i style={{ height: `${max ? Math.max(3, row.value / max * 100) : 3}%` }} />
              <small>{row.date.getDate()}</small>
            </div>
          ))}
        </div>
      </div>
      <div className="high">
        <div><span>متوسط الصرف</span><b>{fmt(spent / totalDays)} ريال</b></div>
        <div><span>أعلى يوم</span><b>{highest ? `${fmt(highest)} ريال` : '—'}</b></div>
        <div><span>أقل يوم</span><b>{lowest ? `${fmt(lowest)} ريال` : '—'}</b></div>
      </div>
    </section>
  )
}

function SettingsPage({ settings, onSave }) {
  const [form, setForm] = useState(settings)
  const available = Math.max(0, Number(form.salary) - Number(form.fixed))
  const finance = calculateFinance(form.financeStart)

  useEffect(() => setForm(settings), [settings])

  return (
    <section>
      <Header title="الإعدادات المالية" sub="البيانات الأساسية للدورة المالية" />
      <div className="form">
        <label>
          الراتب الشهري
          <input type="number" inputMode="decimal" value={form.salary} onChange={e => setForm({ ...form, salary: e.target.value })} />
        </label>
        <label>
          المصاريف الشهرية الثابتة
          <input type="number" inputMode="decimal" value={form.fixed} onChange={e => setForm({ ...form, fixed: e.target.value })} />
        </label>
        <label>
          بداية الدورة المالية
          <input type="number" min="1" max="28" value={form.cycleDay} onChange={e => setForm({ ...form, cycleDay: e.target.value })} />
        </label>
        <label>
          تاريخ بداية التمويل
          <input type="date" value={form.financeStart || ''} onChange={e => setForm({ ...form, financeStart: e.target.value })} />
        </label>

        <div className="finance-setting">
          <div><span>مدة التمويل</span><b>60 شهر</b></div>
          <div><span>الأشهر المنقضية</span><b className="green">{finance.done} شهر</b></div>
          <div><span>الأشهر المتبقية</span><b className="red">{finance.left} شهر</b></div>
          <div><span>تاريخ النهاية</span><b>{finance.end ? fmtDate(finance.end) : '—'}</b></div>
        </div>

        <div className="available"><span>المتاح بعد المصاريف الثابتة</span><b>{fmt(available)} ريال</b></div>

        <button className="primary" onClick={() => onSave({
          salary: Number(form.salary) || 0,
          fixed: Number(form.fixed) || 0,
          cycleDay: Number(form.cycleDay) || 27,
          financeStart: form.financeStart || '',
        })}>
          <Check size={19} />
          حفظ التغييرات
        </button>
      </div>
    </section>
  )
}

function ExpenseSheet({ form, setForm, edit, onClose, onSave }) {
  return (
    <div className="veil sheetveil" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="sheet">
        <div className="handle" />
        <div className="sheethead">
          <h2>{edit ? 'تعديل مصروف' : 'إضافة مصروف'}</h2>
          <button onClick={onClose}><X /></button>
        </div>
        <label>
          المبلغ
          <input autoFocus type="number" inputMode="decimal" placeholder="0.00" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
        </label>
        <label>
          الجهة / الوصف <small>اختياري</small>
          <input value={form.desc} placeholder="مثال: مطعم" onChange={e => setForm({ ...form, desc: e.target.value })} />
        </label>
        <label>
          التاريخ
          <div className="date">
            <CalendarDays size={18} />
            <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
          </div>
        </label>
        <button className="primary" onClick={onSave}>{edit ? 'حفظ التعديل' : 'حفظ المصروف'}</button>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)