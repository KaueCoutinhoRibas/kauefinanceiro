import { useEffect, useRef, useState } from 'react'
import {
  Activity, ArrowDownLeft, ArrowUpRight, Banknote, CalendarDays,
  Check, CheckCircle2, ChevronRight, CircleHelp, Clock3,
  Download, Edit3, FileUp, Gift, GraduationCap, Home, Laptop, Menu,
  PiggyBank, Plus, Receipt, Scissors, Settings, ShieldCheck, Sparkles, Trash2, HandCoins,
  Utensils, Wallet, X, TrendingDown, TrendingUp, CreditCard, Coffee,
} from 'lucide-react'

type Bill = { id: string; name: string; amount: number; dueDay?: number; active: boolean; settlementType?: 'direct' | 'card' | 'invoice' }
type Payment = { paid: boolean; date?: string; amount?: number }
type Entry = { id: string; description: string; amount: number; date: string; notes?: string; category: string }
type MealEntry = { id: string; kind: 'community' | 'ifto'; amount: number; date: string }
type PocketMove = { id: string; pocket: 'reserve' | 'leisure' | 'free'; type: 'deposit' | 'withdraw'; amount: number; date: string; note?: string }
type SalaryReceipt = { id: 'advance' | 'remainder'; label: string; expected: number; plannedDate: string; received: boolean; actualAmount?: number; receivedDate?: string }
type Receivable = { id: string; person: string; amount: number; expectedDate?: string; notes?: string; received: boolean; receivedDate?: string; deductedFromBalance: boolean }
type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }> }
type MonthData = {
  payments: Record<string, Payment>
  billAmounts?: Record<string, number>
  haircuts: { id: string; date: string; amount: number }[]
  meals: MealEntry[]
  expenses: Entry[]
  extraIncome: Entry[]
  salary: SalaryReceipt[]
  pocketMoves: PocketMove[]
  reserveTarget: number
}
type AppData = {
  version: number
  accountBalance: number
  receivables: Receivable[]
  salary: { gross: number; planned: number; advance: number; remainder: number }
  bills: Bill[]
  budgets: { hair: number; community: number; ifto: number }
  pocketPlans: { reserve: number; leisure: number; free: number }
  months: Record<string, MonthData>
}

type ModalState =
  | { type: 'expense'; entry?: Entry }
  | { type: 'income'; entry?: Entry }
  | { type: 'bill'; bill?: Bill }
  | { type: 'pocket'; pocket: PocketMove['pocket']; move: PocketMove['type'] }
  | { type: 'salary'; receipt: SalaryReceipt }
  | { type: 'budget' }
  | { type: 'pocketPlans' }
  | { type: 'reserveTarget' }
  | { type: 'accountBalance' }
  | { type: 'receivable'; receivable?: Receivable }
  | null

const STORAGE_KEY = 'meu-financeiro-v1'
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const currentMonth = () => todayISO().slice(0, 7)
const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number.isFinite(value) ? value : 0)
const monthLabel = (month: string) => {
  const [y, m] = month.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 1))
}
const shortDate = (date?: string) => date ? new Intl.DateTimeFormat('pt-BR').format(new Date(`${date}T12:00:00`)) : 'Não definida'
const parseAmount = (value: string) => { const normalized = value.includes(',') ? value.replace(/\./g, '').replace(',', '.') : value; return Number(normalized) || 0 }
const formatMonth = (month: string) => monthLabel(month).replace(/^./, c => c.toUpperCase())
const dueDateForMonth = (month: string, day: number) => { const [y, m] = month.split('-').map(Number); const lastDay = new Date(y, m, 0).getDate(); return `${month}-${String(Math.min(day, lastDay)).padStart(2, '0')}` }

function nthBusinessDay(year: number, monthIndex: number, nth: number) {
  const date = new Date(year, monthIndex, 1)
  let count = 0
  while (count < nth) {
    const day = date.getDay()
    if (day !== 0 && day !== 6) count++
    if (count < nth) date.setDate(date.getDate() + 1)
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
function salarySchedule(month: string, salary: AppData['salary']): SalaryReceipt[] {
  const [year, monthNum] = month.split('-').map(Number)
  const nextYear = monthNum === 12 ? year + 1 : year
  const nextMonthIndex = monthNum === 12 ? 0 : monthNum
  return [
    { id: 'advance', label: 'Adiantamento · 40%', expected: salary.advance, plannedDate: `${month}-20`, received: false },
    { id: 'remainder', label: 'Restante · 60%', expected: salary.remainder, plannedDate: nthBusinessDay(nextYear, nextMonthIndex, 5), received: false },
  ]
}
function blankMonth(month: string, salary: AppData['salary']): MonthData {
  return { payments: {}, billAmounts: {}, haircuts: [], meals: [], expenses: [], extraIncome: [], salary: salarySchedule(month, salary), pocketMoves: [], reserveTarget: 300 }
}
function defaultData(): AppData {
  const salary = { gross: 2166.80, planned: 2116.80, advance: 866.72, remainder: 1250.08 }
  const month = currentMonth()
  const initialMonth = blankMonth(month, salary)
  // O adiantamento do mês atual já foi recebido e está incluído no saldo atual informado de R$ 679.
  initialMonth.salary = initialMonth.salary.map(receipt => receipt.id === 'advance' ? { ...receipt, received: true, actualAmount: salary.advance, receivedDate: todayISO() } : receipt)
  initialMonth.billAmounts = { 'credit-invoice': 1478 }
  initialMonth.pocketMoves = [{ id: 'opening-savings-300', pocket: 'reserve', type: 'deposit', amount: 300, date: todayISO(), note: 'Valor já guardado antes de começar a usar o aplicativo' }]
  return {
    version: 4,
    accountBalance: 679,
    receivables: [],
    salary,
    bills: [
      { id: 'nubank', name: 'Nubank / Pix crédito', amount: 926.22, active: true, settlementType: 'card' },
      { id: 'gym', name: 'Academia', amount: 154, active: true, settlementType: 'card' },
      { id: 'tim', name: 'TIM', amount: 42, active: true, settlementType: 'card' },
      { id: 'spotify', name: 'Spotify', amount: 12, active: true, settlementType: 'card' },
      { id: 'chatgpt', name: 'ChatGPT', amount: 39, active: true, settlementType: 'card' },
      { id: 'credit-invoice', name: 'Fatura do cartão', amount: 0, active: true, settlementType: 'invoice' },
    ],
    budgets: { hair: 80, community: 60, ifto: 140 },
    pocketPlans: { reserve: 350, leisure: 200, free: 113.58 },
    months: { [month]: initialMonth },
  }
}
function loadData(): AppData {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as AppData
      if ([1, 2, 3, 4].includes(parsed?.version) && parsed.salary && parsed.months) {
        const bills = Array.isArray(parsed.bills) ? parsed.bills.map(bill => ({
          ...bill,
          // Os compromissos recorrentes antigos já eram cobrados no cartão.
          settlementType: bill.settlementType ?? (['nubank', 'gym', 'tim', 'spotify', 'chatgpt'].includes(bill.id) ? 'card' as const : 'direct' as const),
        })) : []
        if (!bills.some(bill => bill.id === 'credit-invoice')) {
          bills.push({ id: 'credit-invoice', name: 'Fatura do cartão', amount: 0, active: true, settlementType: 'invoice' })
        }
        const migratedMonths = Object.fromEntries(Object.entries(parsed.months).map(([key, value]) => [key, { ...value, billAmounts: value.billAmounts || {}, reserveTarget: Number.isFinite(value.reserveTarget) ? value.reserveTarget : 300 }])) as Record<string, MonthData>
        // A fatura é variável por mês. Migra o valor antigo de R$ 1.478 para o mês atual, sem replicá-lo nos meses futuros.
        const invoiceBill = bills.find(bill => bill.id === 'credit-invoice')
        const activeMonthForInvoice = currentMonth()
        const activeMonthData = migratedMonths[activeMonthForInvoice]
        if (invoiceBill && activeMonthData && activeMonthData.billAmounts?.['credit-invoice'] === undefined && invoiceBill.amount > 0) {
          migratedMonths[activeMonthForInvoice] = { ...activeMonthData, billAmounts: { ...activeMonthData.billAmounts, 'credit-invoice': invoiceBill.amount } }
        }
        if (invoiceBill) invoiceBill.amount = 0
        if (parsed.version === 1) {
          const activeMonth = currentMonth()
          const activeData = migratedMonths[activeMonth]
          if (activeData?.salary?.length) {
            migratedMonths[activeMonth] = {
              ...activeData,
              salary: activeData.salary.map(receipt => receipt.id === 'advance' && !receipt.received
                ? { ...receipt, received: true, actualAmount: parsed.salary.advance, receivedDate: todayISO() }
                : receipt),
            }
          }
        }
        const hasReserveOpening = Object.values(migratedMonths).some(m => (m.pocketMoves || []).some(move => move.pocket === 'reserve'))
        if (!hasReserveOpening) {
          const activeMonth = currentMonth()
          const activeData = migratedMonths[activeMonth] || blankMonth(activeMonth, parsed.salary)
          migratedMonths[activeMonth] = {
            ...activeData,
            pocketMoves: [...(activeData.pocketMoves || []), { id: 'opening-savings-300', pocket: 'reserve', type: 'deposit', amount: 300, date: todayISO(), note: 'Valor já guardado antes de começar a usar o aplicativo' }],
          }
        }
        return {
          ...parsed,
          version: 4,
          months: migratedMonths,
          accountBalance: Number.isFinite(parsed.accountBalance) ? parsed.accountBalance : 679,
          receivables: Array.isArray(parsed.receivables) ? parsed.receivables : [],
          bills,
          pocketPlans: { reserve: parsed.pocketPlans?.reserve ?? 350, leisure: parsed.pocketPlans?.leisure ?? 0, free: parsed.pocketPlans?.free ?? 0 },
        }
      }
    }
  } catch (error) { console.warn('Não foi possível carregar os dados locais.', error) }
  return defaultData()
}
const icons: Record<string, typeof Wallet> = {
  Nubank: CreditCard, 'Nubank / Pix crédito': CreditCard, 'Fatura do cartão': CreditCard, Academia: Activity, TIM: Laptop, Spotify: Sparkles, ChatGPT: Sparkles,
  'Corte de cabelo': Scissors, 'Restaurante comunitário': Utensils, 'Janta no IFTO': GraduationCap,
}
const categoryOptions = ['Alimentação', 'Transporte', 'Lazer', 'Saúde', 'Assinaturas', 'Compras', 'Casa', 'Outros']
const pocketNames: Record<PocketMove['pocket'], string> = { reserve: 'Dinheiro guardado', leisure: 'Lazer', free: 'Dinheiro livre' }

function App() {
  const [data, setData] = useState<AppData>(loadData)
  const [selectedMonth, setSelectedMonth] = useState(currentMonth())
  const [page, setPage] = useState<'home' | 'expenses' | 'income' | 'savings' | 'history'>('home')
  const [modal, setModal] = useState<ModalState>(null)
  const [toast, setToast] = useState('')
  const [mobileMenu, setMobileMenu] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const importRef = useRef<HTMLInputElement>(null)

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) }, [data])
  useEffect(() => {
    setData(prev => prev.months[selectedMonth] ? prev : { ...prev, months: { ...prev.months, [selectedMonth]: blankMonth(selectedMonth, prev.salary) } })
  }, [selectedMonth])
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2600)
    return () => window.clearTimeout(timer)
  }, [toast])
  useEffect(() => {
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }
    const handleInstalled = () => setInstallPrompt(null)
    window.addEventListener('beforeinstallprompt', handleInstallPrompt)
    window.addEventListener('appinstalled', handleInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  async function installPwa() {
    if (!installPrompt) return
    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    if (choice.outcome === 'accepted') setToast('Meu Financeiro instalado no dispositivo.')
    setInstallPrompt(null)
  }

  const month = data.months[selectedMonth] || blankMonth(selectedMonth, data.salary)
  const activeBills = data.bills.filter(b => b.active).map(bill => ({ ...bill, amount: month.billAmounts?.[bill.id] ?? bill.amount }))
  const cardBills = activeBills.filter(bill => bill.settlementType === 'card')
  const paymentBills = activeBills.filter(bill => bill.settlementType !== 'card')
  const cardExpenses = cardBills.reduce((sum, bill) => sum + bill.amount, 0)
  // A fatura quita despesas já exibidas por categoria; ela não é somada novamente ao orçamento.
  const plannedBills = activeBills.filter(bill => bill.settlementType !== 'invoice').reduce((sum, bill) => sum + bill.amount, 0)
  const paidBills = paymentBills.reduce((sum, bill) => sum + (month.payments[bill.id]?.paid ? (month.payments[bill.id].amount ?? bill.amount) : 0), 0)
  const paidDirectBills = paymentBills.filter(bill => bill.settlementType !== 'invoice').reduce((sum, bill) => sum + (month.payments[bill.id]?.paid ? (month.payments[bill.id].amount ?? bill.amount) : 0), 0)
  const haircutSpent = month.haircuts.reduce((sum, item) => sum + item.amount, 0)
  const communitySpent = month.meals.filter(m => m.kind === 'community').reduce((sum, item) => sum + item.amount, 0)
  const iftoSpent = month.meals.filter(m => m.kind === 'ifto').reduce((sum, item) => sum + item.amount, 0)
  const routineSpent = haircutSpent + communitySpent + iftoSpent
  // A distribuição mostra apenas rotina realmente registrada, nunca o orçamento máximo não utilizado.
  const plannedExpenses = plannedBills + routineSpent
  const plannedMargin = data.salary.planned - plannedExpenses
  const customSpent = month.expenses.reduce((sum, item) => sum + item.amount, 0)
  const actualSpent = cardExpenses + paidDirectBills + haircutSpent + communitySpent + iftoSpent + customSpent
  const pendingBills = paymentBills.filter(bill => !month.payments[bill.id]?.paid && bill.amount > 0)
  const pendingBillsAmount = pendingBills.reduce((sum, bill) => sum + bill.amount, 0)
  const futureSalary = month.salary.filter(item => !item.received).reduce((sum, item) => sum + item.expected, 0)
  const actualIncome = month.salary.reduce((sum, item) => sum + (item.received ? (item.actualAmount ?? item.expected) : 0), 0) + month.extraIncome.reduce((sum, item) => sum + item.amount, 0)
  const receivablesTotal = data.receivables.filter(item => !item.received).reduce((sum, item) => sum + item.amount, 0)
  // As rotinas são descontadas do saldo no momento do registro. O que ainda não aconteceu não reduz a previsão.
  const reserveDepositsThisMonth = month.pocketMoves.filter(move => move.pocket === 'reserve' && move.type === 'deposit').reduce((sum, move) => sum + move.amount, 0)
  const reserveSavedNetThisMonth = month.pocketMoves.filter(move => move.pocket === 'reserve').reduce((sum, move) => sum + (move.type === 'deposit' ? move.amount : -move.amount), 0)
  const reserveTarget = Math.max(0, month.reserveTarget ?? 300)
  const reserveRemaining = Math.max(0, reserveTarget - reserveDepositsThisMonth)
  // Projeção da sobra em conta: saldo real + entradas futuras - contas pendentes - reserva que ainda falta separar.
  // Cabelo e refeições já reduzem o saldo ao serem registrados; itens não registrados não são presumidos.
  const projectedFreeBalance = data.accountBalance + futureSalary + receivablesTotal - pendingBillsAmount - reserveRemaining
  const pocketMoves = Object.values(data.months).flatMap(m => m.pocketMoves || [])
  const pocketBalances = (['reserve', 'leisure', 'free'] as const).reduce((acc, key) => {
    acc[key] = pocketMoves.filter(m => m.pocket === key).reduce((sum, m) => sum + (m.type === 'deposit' ? m.amount : -m.amount), 0)
    return acc
  }, { reserve: 0, leisure: 0, free: 0 } as Record<PocketMove['pocket'], number>)
  const paymentProgress = paymentBills.length ? paymentBills.filter(b => month.payments[b.id]?.paid).length / paymentBills.length * 100 : 0
  const expenseBreakdown = [
    ...activeBills.filter(b => b.settlementType !== 'invoice').map(b => ({ name: b.name, amount: month.payments[b.id]?.paid ? month.payments[b.id].amount ?? b.amount : b.amount })),
    ...(haircutSpent > 0 ? [{ name: 'Cabelo', amount: haircutSpent }] : []),
    ...(communitySpent > 0 ? [{ name: 'Restaurante comunitário', amount: communitySpent }] : []),
    ...(iftoSpent > 0 ? [{ name: 'IFTO', amount: iftoSpent }] : []),
  ].filter(item => item.amount > 0)

  function updateMonth(updater: (current: MonthData) => MonthData) {
    setData(prev => {
      const current = prev.months[selectedMonth] || blankMonth(selectedMonth, prev.salary)
      return { ...prev, months: { ...prev.months, [selectedMonth]: updater(current) } }
    })
  }
  function updateReserveTarget(amount: number) {
    updateMonth(current => ({ ...current, reserveTarget: Math.max(0, amount) }))
    setToast('Valor que você pretende guardar atualizado.')
  }
  function adjustAccountBalance(delta: number) {
    setData(prev => ({ ...prev, accountBalance: Math.round((prev.accountBalance + delta) * 100) / 100 }))
  }
  function setAccountBalance(value: number) {
    setData(prev => ({ ...prev, accountBalance: Math.round(value * 100) / 100 }))
    setToast('Saldo em conta atualizado.')
  }
  function saveExpenseEntry(entry: Entry) {
    setData(prev => {
      const current = prev.months[selectedMonth] || blankMonth(selectedMonth, prev.salary)
      const existing = current.expenses.find(item => item.id === entry.id)
      const balanceDelta = existing ? existing.amount - entry.amount : -entry.amount
      return { ...prev, accountBalance: Math.round((prev.accountBalance + balanceDelta) * 100) / 100, months: { ...prev.months, [selectedMonth]: { ...current, expenses: existing ? current.expenses.map(item => item.id === entry.id ? entry : item) : [...current.expenses, entry] } } }
    })
    setToast('Despesa salva e saldo atualizado.')
    setModal(null)
  }
  function saveIncomeEntry(entry: Entry) {
    setData(prev => {
      const current = prev.months[selectedMonth] || blankMonth(selectedMonth, prev.salary)
      const existing = current.extraIncome.find(item => item.id === entry.id)
      const balanceDelta = existing ? entry.amount - existing.amount : entry.amount
      return { ...prev, accountBalance: Math.round((prev.accountBalance + balanceDelta) * 100) / 100, months: { ...prev.months, [selectedMonth]: { ...current, extraIncome: existing ? current.extraIncome.map(item => item.id === entry.id ? entry : item) : [...current.extraIncome, entry] } } }
    })
    setToast('Entrada registrada e somada ao saldo em conta.')
    setModal(null)
  }
  function saveReceivable(receivable: Receivable) {
    setData(prev => {
      const existing = prev.receivables.find(item => item.id === receivable.id)
      let delta = 0
      if (!existing) delta = receivable.deductedFromBalance ? -receivable.amount : 0
      else if (existing.received) delta = receivable.amount - existing.amount
      else {
        const oldLoan = existing.deductedFromBalance ? existing.amount : 0
        const newLoan = receivable.deductedFromBalance ? receivable.amount : 0
        delta = oldLoan - newLoan
      }
      const next = existing ? prev.receivables.map(item => item.id === receivable.id ? receivable : item) : [...prev.receivables, receivable]
      return { ...prev, accountBalance: Math.round((prev.accountBalance + delta) * 100) / 100, receivables: next }
    })
    setToast('Valor a receber salvo.')
    setModal(null)
  }
  function toggleReceivable(receivable: Receivable) {
    setData(prev => ({
      ...prev,
      accountBalance: Math.round((prev.accountBalance + (receivable.received ? -receivable.amount : receivable.amount)) * 100) / 100,
      receivables: prev.receivables.map(item => item.id === receivable.id ? { ...item, received: !item.received, receivedDate: receivable.received ? undefined : todayISO() } : item),
    }))
    setToast(receivable.received ? 'Recebimento desfeito.' : `Valor de ${receivable.person} recebido e somado ao saldo.`)
  }
  function deleteReceivable(receivable: Receivable) {
    setData(prev => ({
      ...prev,
      accountBalance: Math.round((prev.accountBalance + (!receivable.received && receivable.deductedFromBalance ? receivable.amount : 0)) * 100) / 100,
      receivables: prev.receivables.filter(item => item.id !== receivable.id),
    }))
    setToast('Registro removido.')
  }
  function updateSalary(updates: Partial<AppData['salary']>) {
    setData(prev => {
      const salary = { ...prev.salary, ...updates }
      const months = Object.fromEntries(Object.entries(prev.months).map(([key, value]) => {
        const schedule = salarySchedule(key, salary)
        return [key, { ...value, salary: value.salary.map(receipt => receipt.received ? receipt : schedule.find(item => item.id === receipt.id) ?? receipt) }]
      }))
      return { ...prev, salary, months }
    })
  }
  function updatePocketPlans(updates: Partial<AppData['pocketPlans']>) {
    setData(prev => ({ ...prev, pocketPlans: { ...prev.pocketPlans, ...updates } }))
    setToast('Planejamento das caixinhas atualizado.')
  }
  function updateBill(bill: Bill) {
    setData(prev => {
      const current = prev.months[selectedMonth] || blankMonth(selectedMonth, prev.salary)
      const existingBill = prev.bills.find(item => item.id === bill.id)
      const previousAmount = bill.settlementType === 'invoice'
        ? current.billAmounts?.[bill.id] ?? existingBill?.amount ?? 0
        : current.payments[bill.id]?.amount ?? existingBill?.amount ?? 0
      const alreadyPaid = !!current.payments[bill.id]?.paid
      const balanceDelta = alreadyPaid ? previousAmount - bill.amount : 0
      const payments = alreadyPaid ? { ...current.payments, [bill.id]: { ...current.payments[bill.id], amount: bill.amount } } : current.payments
      const bills = existingBill
        ? prev.bills.map(item => item.id === bill.id ? { ...bill, amount: bill.settlementType === 'invoice' ? 0 : bill.amount } : item)
        : [...prev.bills, { ...bill, amount: bill.settlementType === 'invoice' ? 0 : bill.amount }]
      const billAmounts = bill.settlementType === 'invoice'
        ? { ...(current.billAmounts || {}), [bill.id]: bill.amount }
        : current.billAmounts || {}
      return {
        ...prev,
        accountBalance: Math.round((prev.accountBalance + balanceDelta) * 100) / 100,
        bills,
        months: { ...prev.months, [selectedMonth]: { ...current, payments, billAmounts } },
      }
    })
    setToast('Compromisso salvo para este mês.')
  }
  function toggleBill(bill: Bill) {
    const wasPaid = !!month.payments[bill.id]?.paid
    const recordedAmount = month.payments[bill.id]?.amount ?? bill.amount
    updateMonth(current => {
      const payments = { ...current.payments }
      if (wasPaid) delete payments[bill.id]
      else payments[bill.id] = { paid: true, date: todayISO(), amount: bill.amount }
      return { ...current, payments }
    })
    adjustAccountBalance(wasPaid ? recordedAmount : -bill.amount)
    setToast(wasPaid ? 'Pagamento desmarcado e valor devolvido ao saldo.' : `${bill.name} marcado como pago e descontado do saldo.`)
  }
  function addMeal(kind: MealEntry['kind']) {
    const amount = kind === 'community' ? 3 : 8
    updateMonth(current => ({ ...current, meals: [...current.meals, { id: makeId(), kind, amount, date: todayISO() }] }))
    adjustAccountBalance(-amount)
    setToast(kind === 'community' ? 'Almoço registrado e descontado do saldo.' : 'Janta registrada e descontada do saldo.')
  }
  function addHaircut() {
    if (month.haircuts.length >= 2) { setToast('Os dois cortes do mês já foram registrados.'); return }
    const amount = data.budgets.hair / 2
    updateMonth(current => ({ ...current, haircuts: [...current.haircuts, { id: makeId(), date: todayISO(), amount }] }))
    adjustAccountBalance(-amount)
    setToast('Corte registrado e descontado do saldo.')
  }
  function removeLatestHaircut() {
    const latest = month.haircuts[month.haircuts.length - 1]
    if (!latest) return
    updateMonth(current => ({ ...current, haircuts: current.haircuts.slice(0, -1) }))
    adjustAccountBalance(latest.amount)
    setToast('Último corte desfeito e valor devolvido ao saldo.')
  }
  function removeHaircut(id: string) {
    const item = month.haircuts.find(h => h.id === id)
    updateMonth(current => ({ ...current, haircuts: current.haircuts.filter(h => h.id !== id) }))
    if (item) adjustAccountBalance(item.amount)
  }
  function removeMeal(id: string) {
    const item = month.meals.find(m => m.id === id)
    updateMonth(current => ({ ...current, meals: current.meals.filter(m => m.id !== id) }))
    if (item) adjustAccountBalance(item.amount)
    setToast('Registro removido e valor devolvido ao saldo.')
  }
  function removeExpense(id: string) {
    const item = month.expenses.find(e => e.id === id)
    updateMonth(current => ({ ...current, expenses: current.expenses.filter(e => e.id !== id) }))
    if (item) adjustAccountBalance(item.amount)
    setToast('Despesa removida e valor devolvido ao saldo.')
  }
  function removeIncome(id: string) {
    const item = month.extraIncome.find(e => e.id === id)
    updateMonth(current => ({ ...current, extraIncome: current.extraIncome.filter(e => e.id !== id) }))
    if (item) adjustAccountBalance(-item.amount)
    setToast('Receita removida e valor retirado do saldo.')
  }
  function markSalary(receipt: SalaryReceipt) {
    if (receipt.received) {
      updateMonth(current => ({ ...current, salary: current.salary.map(r => r.id === receipt.id ? { ...r, received: false, actualAmount: undefined, receivedDate: undefined } : r) }))
      adjustAccountBalance(-(receipt.actualAmount ?? receipt.expected))
      setToast('Recebimento voltou para pendente e foi retirado do saldo.')
    } else {
      setModal({ type: 'salary', receipt })
    }
  }
  function addPocketMove(pocket: PocketMove['pocket'], type: PocketMove['type'], amount: number, note?: string) {
    updateMonth(current => ({ ...current, pocketMoves: [...current.pocketMoves, { id: makeId(), pocket, type, amount, date: todayISO(), note }] }))
    adjustAccountBalance(type === 'deposit' ? -amount : amount)
    setToast(type === 'deposit' ? 'Valor guardado e descontado do saldo em conta.' : 'Retirada registrada e somada ao saldo em conta.')
  }
  function updateMonthSalary(receiptId: SalaryReceipt['id'], actualAmount: number, receivedDate: string) {
    updateMonth(current => ({ ...current, salary: current.salary.map(r => r.id === receiptId ? { ...r, received: true, actualAmount, receivedDate } : r) }))
    adjustAccountBalance(actualAmount)
    setToast('Recebimento registrado e somado ao saldo em conta.')
  }
  function exportBackup() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `meu-financeiro-backup-${todayISO()}.json`; a.click(); URL.revokeObjectURL(url)
    setToast('Backup exportado.')
  }
  function importBackup(file?: File) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const imported = JSON.parse(String(reader.result)) as AppData
        if (![1, 2, 3, 4].includes(imported.version) || !imported.months || !imported.salary) throw new Error('Formato inválido')
        const activeMonth = currentMonth()
        const activeData = imported.months[activeMonth]
        const normalizedBills = (imported.bills || []).map(bill => ({
          ...bill,
          settlementType: bill.settlementType ?? (['nubank', 'gym', 'tim', 'spotify', 'chatgpt'].includes(bill.id) ? 'card' as const : 'direct' as const),
        }))
        if (!normalizedBills.some(bill => bill.id === 'credit-invoice')) normalizedBills.push({ id: 'credit-invoice', name: 'Fatura do cartão', amount: 0, active: true, settlementType: 'invoice' })
        const normalizedMonths = Object.fromEntries(Object.entries(imported.months).map(([key, value]) => [key, { ...value, billAmounts: value.billAmounts || {}, reserveTarget: Number.isFinite(value.reserveTarget) ? value.reserveTarget : 300 }])) as Record<string, MonthData>
        if (!normalizedMonths[activeMonth]) normalizedMonths[activeMonth] = blankMonth(activeMonth, imported.salary)
        const oldInvoice = normalizedBills.find(bill => bill.id === 'credit-invoice')
        if (oldInvoice && normalizedMonths[activeMonth].billAmounts?.['credit-invoice'] === undefined && oldInvoice.amount > 0) {
          normalizedMonths[activeMonth] = { ...normalizedMonths[activeMonth], billAmounts: { ...(normalizedMonths[activeMonth].billAmounts || {}), 'credit-invoice': oldInvoice.amount } }
        }
        if (oldInvoice) oldInvoice.amount = 0
        if (imported.version === 1 && activeData?.salary?.length) {
          normalizedMonths[activeMonth] = {
            ...normalizedMonths[activeMonth],
            salary: normalizedMonths[activeMonth].salary.map(receipt => receipt.id === 'advance' && !receipt.received
              ? { ...receipt, received: true, actualAmount: imported.salary.advance, receivedDate: todayISO() }
              : receipt),
          }
        }
        const hasSavedReserve = Object.values(normalizedMonths).some(m => (m.pocketMoves || []).some(move => move.pocket === 'reserve'))
        if (!hasSavedReserve) {
          const current = normalizedMonths[activeMonth] || blankMonth(activeMonth, imported.salary)
          normalizedMonths[activeMonth] = { ...current, pocketMoves: [...(current.pocketMoves || []), { id: 'opening-savings-300', pocket: 'reserve', type: 'deposit', amount: 300, date: todayISO(), note: 'Valor já guardado antes de começar a usar o aplicativo' }] }
        }
        const restored = {
          ...imported,
          version: 4,
          months: normalizedMonths,
          accountBalance: Number.isFinite(imported.accountBalance) ? imported.accountBalance : 679,
          receivables: imported.receivables || [],
          bills: normalizedBills,
          pocketPlans: { reserve: imported.pocketPlans?.reserve ?? 350, leisure: 0, free: 0 },
        } as AppData
        setData(restored); setToast('Backup importado com sucesso.')
      } catch { setToast('Não foi possível importar esse arquivo.') }
    }
    reader.readAsText(file)
  }

  const navItems = [
    { id: 'home', label: 'Início', icon: Home },
    { id: 'expenses', label: 'Despesas', icon: Receipt },
    { id: 'income', label: 'Receitas', icon: ArrowDownLeft },
    { id: 'savings', label: 'Economias', icon: PiggyBank },
    { id: 'history', label: 'Histórico', icon: CalendarDays },
  ] as const

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
        <div className="brand-row">
          <div className="brand-mark"><Wallet size={21} /></div>
          <div><div className="brand-name">meu financeiro</div><div className="brand-caption">seu dinheiro, mais claro</div></div>
          <button className="icon-button mobile-close" onClick={() => setMobileMenu(false)} aria-label="Fechar menu"><X size={19}/></button>
        </div>
        <div className="sidebar-label">MENU PRINCIPAL</div>
        <nav className="side-nav">
          {navItems.map(item => {
            const Icon = item.icon
            return <button key={item.id} className={`nav-item ${page === item.id ? 'active' : ''}`} onClick={() => { setPage(item.id); setMobileMenu(false) }}><Icon size={18}/><span>{item.label}</span>{page === item.id && <span className="nav-indicator"/>}</button>
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-card"><ShieldCheck size={17}/><div><strong>Seus dados são privados</strong><span>Salvos somente neste navegador.</span></div></div>
          <div className="sidebar-user"><div className="avatar">MF</div><div><strong>Meu espaço</strong><span>Controle pessoal</span></div><button className="icon-button" title="Exportar backup" onClick={exportBackup}><Download size={16}/></button></div>
        </div>
      </aside>
      {mobileMenu && <button className="mobile-scrim" onClick={() => setMobileMenu(false)} aria-label="Fechar menu"/>}

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left"><button className="icon-button menu-trigger" onClick={() => setMobileMenu(true)} aria-label="Abrir menu"><Menu size={20}/></button><div><div className="eyebrow">CONTROLE FINANCEIRO PESSOAL</div><h1>{page === 'home' ? 'Visão geral' : navItems.find(i => i.id === page)?.label}</h1></div></div>
          <div className="topbar-actions">
            {installPrompt && <button className="outline-button install-app-button" onClick={installPwa}><Download size={14}/> Instalar app</button>}
            <div className="month-select"><CalendarDays size={16}/><input aria-label="Selecionar mês" type="month" value={selectedMonth} onChange={e => e.target.value && setSelectedMonth(e.target.value)}/></div>
            <button className="avatar top-avatar" title="Espaço pessoal">MF</button>
          </div>
        </header>

        <div className="page-content">
          {page === 'home' && <Dashboard
            monthLabel={formatMonth(selectedMonth)} plannedExpenses={plannedExpenses}
            accountBalance={data.accountBalance} receivablesTotal={receivablesTotal} futureSalary={futureSalary} pendingBillsAmount={pendingBillsAmount} projectedFreeBalance={projectedFreeBalance}
            routineSpent={routineSpent} reserveRemaining={reserveRemaining} reserveSavedThisMonth={reserveSavedNetThisMonth} pendingCount={pendingBills.length}
            breakdown={expenseBreakdown} budget={data.budgets} month={month} plans={data.pocketPlans} balances={pocketBalances}
            onNavigate={setPage} onEditBalance={() => setModal({ type: 'accountBalance' })} onEditReserveTarget={() => setModal({ type: 'reserveTarget' })} onAddExpense={() => setModal({ type: 'expense' })} onAddMeal={addMeal} onAddHaircut={addHaircut} onUndoHaircut={removeLatestHaircut}
          />}
          {page === 'expenses' && <ExpensesPage data={data} month={month} selectedMonth={selectedMonth} budgets={data.budgets} activeBills={activeBills} pendingBills={pendingBills} paidBills={paidBills} haircutSpent={haircutSpent} communitySpent={communitySpent} iftoSpent={iftoSpent} customSpent={customSpent} actualSpent={actualSpent} plannedExpenses={plannedExpenses} paymentProgress={paymentProgress} onToggleBill={toggleBill} onEditBill={bill => setModal({ type: 'bill', bill })} onAddBill={() => setModal({ type: 'bill' })} onAddExpense={() => setModal({ type: 'expense' })} onAddMeal={addMeal} onAddHaircut={addHaircut} onUndoHaircut={removeLatestHaircut} onUpdateBudget={updates => setData(prev => ({ ...prev, budgets: { ...prev.budgets, ...updates } }))} onDeleteExpense={removeExpense} onEditExpense={entry => setModal({ type: 'expense', entry })} onDeleteMeal={removeMeal} onDeleteHaircut={removeHaircut} />}
          {page === 'income' && <IncomePage salary={data.salary} month={month} plannedIncome={data.salary.planned} extraIncome={month.extraIncome} actualIncome={actualIncome} receivables={data.receivables} onMark={markSalary} onAddIncome={() => setModal({ type: 'income' })} onSalaryEdit={() => setModal({ type: 'budget' })} onDeleteIncome={removeIncome} onEditIncome={entry => setModal({ type: 'income', entry })} onAddReceivable={() => setModal({ type: 'receivable' })} onEditReceivable={receivable => setModal({ type: 'receivable', receivable })} onDeleteReceivable={deleteReceivable} onToggleReceivable={toggleReceivable} />}
          {page === 'savings' && <SavingsPage plans={data.pocketPlans} balances={pocketBalances} moves={pocketMoves} monthMoves={month.pocketMoves} plannedMargin={plannedMargin} onMove={(p, t) => setModal({ type: 'pocket', pocket: p, move: t })} onEditPlans={() => setModal({ type: 'pocketPlans' })} />}
          {page === 'history' && <HistoryPage data={data} selectedMonth={selectedMonth} onSelectMonth={setSelectedMonth} />}
        </div>
        <footer className="footer-note"><span>Meu Financeiro</span><span>Seus dados ficam salvos neste dispositivo.</span><button onClick={() => importRef.current?.click()}>Importar backup <FileUp size={13}/></button><button onClick={exportBackup}>Fazer backup <Download size={13}/></button></footer>
      </main>

      {modal && <Modal modal={modal} data={data} reserveTarget={reserveTarget} onClose={() => setModal(null)} onSaveBill={updateBill} onSaveExpense={saveExpenseEntry} onSaveIncome={saveIncomeEntry} onSaveAccountBalance={setAccountBalance} onSaveReceivable={saveReceivable} onPocketMove={addPocketMove} onSalaryReceive={updateMonthSalary} onUpdateSalary={updateSalary} onUpdatePocketPlans={updatePocketPlans} onSaveReserveTarget={updateReserveTarget} />}
      <input ref={importRef} type="file" accept="application/json" hidden onChange={e => { importBackup(e.target.files?.[0]); e.currentTarget.value = '' }}/>
      {toast && <div className="toast"><CheckCircle2 size={17}/>{toast}</div>}
    </div>
  )
}

function Dashboard(props: {
  monthLabel: string; plannedExpenses: number; accountBalance: number; receivablesTotal: number; futureSalary: number; pendingBillsAmount: number; projectedFreeBalance: number; routineSpent: number; reserveRemaining: number; reserveSavedThisMonth: number; pendingCount: number; breakdown: { name: string; amount: number }[]; budget: AppData['budgets']; month: MonthData; plans: AppData['pocketPlans']; balances: Record<PocketMove['pocket'], number>; onNavigate: (page: 'home' | 'expenses' | 'income' | 'savings' | 'history') => void; onEditBalance: () => void; onEditReserveTarget: () => void; onAddExpense: () => void; onAddMeal: (kind: MealEntry['kind']) => void; onAddHaircut: () => void; onUndoHaircut: () => void
}) {
  const expectedInflows = props.futureSalary + props.receivablesTotal
  return <div className="dashboard-page">
    <div className="welcome-row"><div><div className="eyebrow">{props.monthLabel.toUpperCase()}</div><h2>Seu mês em perspectiva<span className="purple-dot">.</span></h2><p>Veja quanto existe na conta e quanto deve sobrar depois de organizar tudo.</p></div><button className="primary-button" onClick={props.onAddExpense}><Plus size={17}/> Adicionar despesa</button></div>

    <section className="hero-grid">
      <div className="hero-card bank-balance-card">
        <div className="hero-card-top"><div className="hero-balance-content"><span className="hero-label">Saldo atual no banco</span><div className="hero-balance-line"><div className="hero-value">{money(props.accountBalance)}</div>{props.receivablesTotal > 0 && <span className="hero-receivable-inline">(+ {money(props.receivablesTotal)})</span>}</div><div className="hero-sub">Valor que aparece na sua conta bancária neste momento.</div></div><button className="hero-icon hero-edit-button" onClick={props.onEditBalance} title="Editar saldo em conta" aria-label="Editar saldo em conta"><Edit3 size={19}/></button></div>
        <div className="bank-balance-meta"><span>{props.receivablesTotal > 0 ? 'O valor entre parênteses é o que ainda vão te pagar.' : 'Nenhum valor de pessoas pendente.'}</span><button className="soft-button" onClick={() => props.onNavigate('income')}>Ver valores a receber <ChevronRight size={14}/></button></div>
        <div className="hero-divider"/>
        <div className="hero-foot"><span>Entradas futuras: {money(expectedInflows)}</span><span>Contas pendentes: {money(props.pendingBillsAmount)}</span></div>
      </div>
      <div className="mini-stat-grid forecast-stat-grid">
        <StatCard label="Entradas que faltam" value={money(expectedInflows)} icon={<ArrowDownLeft size={18}/>} tone="green" sub={`Salário ${money(props.futureSalary)} · pessoas ${money(props.receivablesTotal)}`}/>
        <StatCard label="Contas que faltam pagar" value={money(props.pendingBillsAmount)} icon={<CreditCard size={18}/>} tone="amber" sub={`${props.pendingCount} pagamentos pendentes`}/>
        <StatCard label="Rotina registrada" value={money(props.routineSpent)} icon={<CalendarDays size={18}/>} tone="neutral" sub="Somente cortes e refeições lançados"/>
        <StatCard label="Já guardado neste mês" value={money(props.reserveSavedThisMonth)} icon={<ShieldCheck size={18}/>} tone="purple" sub="Depósitos menos retiradas da reserva"/>
      </div>
    </section>

    <section className="panel projection-panel">
      <PanelHeading title="Quanto vai sobrar na sua conta?" subtitle="Saldo atual + entradas futuras − contas pendentes − reserva a separar." action={<button className="text-button" onClick={props.onEditReserveTarget}><Settings size={14}/> Ajustar quanto vou guardar</button>}/>
      <div className="projection-formula">
        <div className="projection-row"><span>Saldo atual no banco</span><strong>{money(props.accountBalance)}</strong></div>
        <div className="projection-row positive"><span>+ Salário que ainda vai entrar</span><strong>+ {money(props.futureSalary)}</strong></div>
        <div className="projection-row positive"><span>+ Dinheiro que pessoas ainda vão pagar</span><strong>+ {money(props.receivablesTotal)}</strong></div>
        <div className="projection-row negative"><span>− Contas pendentes (incluindo a fatura)</span><strong>− {money(props.pendingBillsAmount)}</strong></div>
        <div className="projection-row negative"><span>− Falta separar para a reserva</span><strong>− {money(props.reserveRemaining)}</strong></div>
      </div>
      <div className={`projection-result ${props.projectedFreeBalance < 0 ? 'is-negative' : ''}`}>
        <div><span>PREVISÃO DE DINHEIRO LIVRE NA CONTA</span><small>Depois dos recebimentos, contas e reserva. Rotinas já registradas saíram do saldo.</small></div>
        <strong>{money(props.projectedFreeBalance)}</strong>
      </div>
      <div className="projection-footnote"><CircleHelp size={15}/><span>Este é o valor estimado que deve permanecer no banco. Cortes e refeições só entram quando você os registra e já são descontados do saldo nesse momento. O que ainda não foi registrado não é presumido como gasto.</span></div>
    </section>

    <div className="content-grid dashboard-grid">
      <section className="panel chart-panel"><PanelHeading title="Distribuição das despesas" subtitle="Contas recorrentes e gastos de rotina já registrados" action={<button className="text-button" onClick={() => props.onNavigate('expenses')}>Ver despesas <ChevronRight size={14}/></button>}/><DonutChart data={props.breakdown}/><div className="legend-list">{props.breakdown.map(item => <div className="legend-item" key={item.name}><span className="legend-swatch" style={{ backgroundColor: expenseColor(item.name) }}/><span className="legend-name">{item.name}</span><strong>{money(item.amount)}</strong></div>)}</div><div className="chart-total"><span>Total exibido</span><strong>{money(props.plannedExpenses)}</strong></div></section>
      <div className="right-stack">
        <section className="panel quick-panel"><PanelHeading title="Atalhos do dia a dia" subtitle="Registre sem complicação"/><div className="quick-actions"><button onClick={props.onAddExpense}><span className="quick-icon lilac"><Plus size={18}/></span><span><strong>Novo gasto</strong><small>Adicionar despesa</small></span><ChevronRight size={16}/></button><button onClick={() => props.onNavigate('income')}><span className="quick-icon green"><ArrowDownLeft size={18}/></span><span><strong>Registrar entrada</strong><small>Salário ou renda extra</small></span><ChevronRight size={16}/></button><button onClick={() => props.onNavigate('income')}><span className="quick-icon lilac"><HandCoins size={18}/></span><span><strong>Dinheiro a receber</strong><small>Registrar alguém que está devendo</small></span><ChevronRight size={16}/></button><button onClick={() => props.onNavigate('savings')}><span className="quick-icon amber"><PiggyBank size={18}/></span><span><strong>Guardar dinheiro</strong><small>Adicionar à reserva</small></span><ChevronRight size={16}/></button></div></section>
        <section className="panel salary-panel"><PanelHeading title="Recebimento do salário" subtitle="Duas parcelas, uma única competência" action={<button className="text-button" onClick={() => props.onNavigate('income')}>Detalhes <ChevronRight size={14}/></button>}/><div className="salary-mini"><div className="salary-mini-row"><div className="salary-badge"><ArrowDownLeft size={16}/></div><div><strong>Adiantamento · 40%</strong><small>Dia 20 · {money(866.72)}</small></div><span className={props.month.salary[0]?.received ? 'status-pill paid' : 'status-pill'}>{props.month.salary[0]?.received ? 'Recebido' : 'Pendente'}</span></div><div className="salary-mini-row"><div className="salary-badge muted"><CalendarDays size={16}/></div><div><strong>Restante · 60%</strong><small>5º dia útil seguinte · {money(1250.08)}</small></div><span className={props.month.salary[1]?.received ? 'status-pill paid' : 'status-pill'}>{props.month.salary[1]?.received ? 'Recebido' : 'Pendente'}</span></div></div><div className="salary-total"><span>Renda planejada</span><strong>{money(props.futureSalary + (props.month.salary.reduce((sum, receipt) => sum + (receipt.received ? receipt.actualAmount ?? receipt.expected : 0), 0)))}</strong></div></section>
      </div>
    </div>

    <div className="content-grid bottom-grid">
      <section className="panel checklist-panel"><PanelHeading title="Pequenas metas do mês" subtitle="Acompanhe seus hábitos financeiros"/><div className="check-progress"><div><strong>{props.month.haircuts.length}/2</strong><span>cortes de cabelo</span></div><div className="tiny-progress"><div style={{ width: `${Math.min(100, props.month.haircuts.length * 50)}%` }}/></div><button className="soft-button" onClick={props.month.haircuts.length < 2 ? props.onAddHaircut : props.onUndoHaircut}>{props.month.haircuts.length < 2 ? <><Plus size={14}/> Registrar corte</> : <><Check size={14}/> Concluído · desfazer</>}</button></div><div className="check-progress"><div><strong>{props.month.meals.filter(m => m.kind === 'community').length}</strong><span>almoços registrados</span></div><div className="tiny-progress"><div style={{ width: `${Math.min(100, props.month.meals.filter(m => m.kind === 'community').length / 20 * 100)}%` }}/></div><button className="soft-button" onClick={() => props.onAddMeal('community')}><Plus size={14}/> Registrar almoço</button></div><div className="check-progress"><div><strong>{money(props.month.meals.filter(m => m.kind === 'ifto').reduce((s, m) => s + m.amount, 0))}</strong><span>jantas no IFTO</span></div><div className="tiny-progress"><div style={{ width: `${Math.min(100, props.month.meals.filter(m => m.kind === 'ifto').reduce((s, m) => s + m.amount, 0) / props.budget.ifto * 100)}%` }}/></div><button className="soft-button" onClick={() => props.onAddMeal('ifto')}><Plus size={14}/> Registrar janta</button></div></section>
      <section className="panel pockets-preview"><PanelHeading title="Dinheiro guardado" subtitle="Somente valores que você realmente separou" action={<button className="text-button" onClick={() => props.onNavigate('savings')}>Ver todas <ChevronRight size={14}/></button>}/><PocketPreview icon={<ShieldCheck size={18}/>} name="Dinheiro guardado" planned={props.plans.reserve} balance={props.balances.reserve}/></section>
    </div>
    <div className="note-strip"><CircleHelp size={16}/><span><strong>A previsão livre é o que deve sobrar depois de tudo.</strong> Ela soma o saldo atual e o que ainda vai entrar; depois desconta contas pendentes, o restante do orçamento de rotina e o valor que falta guardar na reserva.</span></div>
  </div>
}
function StatCard({ label, value, icon, tone, sub }: { label: string; value: string; icon: React.ReactNode; tone: string; sub: string }) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><span className="stat-label">{label}</span><strong className="stat-value">{value}</strong><small>{sub}</small></div>
}
function PanelHeading({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return <div className="panel-heading"><div><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div>{action}</div>
}
function expenseColor(name: string) {
  const normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  if (normalized.includes('nubank')) return '#820AD1'
  if (normalized.includes('academia')) return '#F2C94C'
  if (normalized === 'tim' || normalized.startsWith('tim ') || normalized.includes('operadora tim')) return '#2788E8'
  if (normalized.includes('spotify')) return '#1DB954'
  if (normalized.includes('chatgpt') || normalized.includes('chat gpt')) return '#9CA3AF'
  if (normalized.includes('cabelo')) return '#F08A4B'
  if (normalized.includes('comunitario')) return '#D97706'
  if (normalized.includes('ifto')) return '#38BDF8'
  // Categorias novas recebem uma cor estável, sem depender da posição no gráfico.
  const fallback = ['#E879F9', '#14B8A6', '#A3A3A3', '#F97316', '#60A5FA', '#A3E635']
  const hash = Array.from(normalized).reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 7)
  return fallback[hash % fallback.length]
}

function DonutChart({ data }: { data: { name: string; amount: number }[] }) {
  const visibleData = data.filter(item => item.amount > 0)
  const total = visibleData.reduce((sum, item) => sum + item.amount, 0)
  let cumulative = 0
  const segments = visibleData.map(item => {
    const start = total > 0 ? cumulative / total * 360 : 0
    cumulative += item.amount
    const end = total > 0 ? cumulative / total * 360 : 0
    return { ...item, start, end, color: expenseColor(item.name) }
  })
  return <div className="donut-wrap"><div className="donut-chart" role="img" aria-label="Gráfico circular da distribuição de despesas"><svg viewBox="0 0 180 180">{segments.map(seg => <circle key={seg.name} cx="90" cy="90" r="68" fill="none" stroke={seg.color} strokeWidth="19" strokeDasharray={`${Math.max(0, seg.end - seg.start) / 360 * 427.26} ${427.26}`} strokeDashoffset={`${-seg.start / 360 * 427.26}`} transform="rotate(-90 90 90)" strokeLinecap="butt"><title>{seg.name}: {money(seg.amount)}</title></circle> )}</svg><div className="donut-center"><span>Total</span><strong>{money(total)}</strong></div></div></div>
}
function PocketPreview({ icon, name, planned, balance }: { icon: React.ReactNode; name: string; planned: number; balance: number }) {
  const percent = planned ? Math.min(100, Math.max(0, balance / planned * 100)) : 0
  return <div className="pocket-preview-row"><div className="pocket-mini-icon">{icon}</div><div className="pocket-preview-content"><div><strong>{name}</strong><span>{money(balance)} <small>/ {money(planned)} planejados</small></span></div><div className="tiny-progress"><div style={{ width: `${percent}%` }}/></div></div></div>
}

function ExpensesPage(props: {
  data: AppData; month: MonthData; selectedMonth: string; budgets: AppData['budgets']; activeBills: Bill[]; pendingBills: Bill[]; paidBills: number; haircutSpent: number; communitySpent: number; iftoSpent: number; customSpent: number; actualSpent: number; plannedExpenses: number; paymentProgress: number; onToggleBill: (bill: Bill) => void; onEditBill: (bill: Bill) => void; onAddBill: () => void; onAddExpense: () => void; onAddMeal: (kind: MealEntry['kind']) => void; onAddHaircut: () => void; onUndoHaircut: () => void; onUpdateBudget: (updates: Partial<AppData['budgets']>) => void; onDeleteExpense: (id: string) => void; onEditExpense: (entry: Entry) => void; onDeleteMeal: (id: string) => void; onDeleteHaircut: (id: string) => void
}) {
  const [editingBudget, setEditingBudget] = useState(false)
  const [budgetDraft, setBudgetDraft] = useState(props.budgets)
  const invoiceIsPaid = !!props.month.payments['credit-invoice']?.paid
  const pendingTotal = props.pendingBills.reduce((sum, bill) => sum + bill.amount, 0)
  useEffect(() => setBudgetDraft(props.budgets), [props.budgets])
  return <div className="subpage"><PageIntro title="Despesas do mês" subtitle="Acompanhe os compromissos e registre cada gasto." action={<button className="primary-button" onClick={props.onAddExpense}><Plus size={16}/> Adicionar despesa</button>}/>
    <div className="expense-summary-row"><StatCard label="Despesas acompanhadas" value={money(props.plannedExpenses)} icon={<Receipt size={18}/>} tone="purple" sub="Compromissos e rotina registrada"/><StatCard label="Despesas detalhadas" value={money(props.actualSpent)} icon={<TrendingDown size={18}/>} tone="red" sub="Categorias e rotina registrada; não é uma saída extra da fatura"/><StatCard label="Contas a pagar" value={money(pendingTotal)} icon={<Clock3 size={18}/>} tone="amber" sub={`${props.pendingBills.length} pagamentos pendentes`}/></div>
    <div className="content-grid expenses-layout"><section className="panel"><PanelHeading title="Pagamentos e compromissos" subtitle={`${props.activeBills.filter(b => b.settlementType !== 'card' && props.month.payments[b.id]?.paid).length} de ${props.activeBills.filter(b => b.settlementType !== 'card').length} pagamentos concluídos` } action={<button className="text-button" onClick={props.onAddBill}><Plus size={14}/> Novo compromisso</button>}/><div className="wide-progress"><div style={{ width: `${props.paymentProgress}%` }}/></div><div className="bill-list">{[...props.activeBills].sort((a,b) => (a.settlementType === 'invoice' ? -1 : 0) - (b.settlementType === 'invoice' ? -1 : 0)).map(bill => { const payment = props.month.payments[bill.id]; const isCardExpense = bill.settlementType === 'card'; const isUnsetInvoice = bill.settlementType === 'invoice' && bill.amount <= 0; const Icon = icons[bill.name] || Receipt; return <div className={`bill-row ${payment?.paid ? 'bill-done' : ''} ${isCardExpense ? 'bill-invoice-item' : ''}`} key={bill.id}>{isCardExpense ? <span className="bill-check-placeholder"><CreditCard size={14}/></span> : <button className={`check-control ${payment?.paid ? 'checked' : ''}`} disabled={isUnsetInvoice} onClick={() => props.onToggleBill(bill)} aria-label={payment?.paid ? `Desmarcar ${bill.name}` : `Marcar ${bill.name} como pago`}>{payment?.paid && <Check size={14}/>}</button>}<div className="bill-icon"><Icon size={17}/></div><div className="bill-info"><strong>{bill.name}</strong><small>{isCardExpense ? (invoiceIsPaid ? 'Quitado pela fatura' : 'Despesa detalhada dentro da fatura') : payment?.paid ? `Pago em ${shortDate(payment.date)}` : isUnsetInvoice ? 'Defina o valor desta fatura neste mês' : bill.dueDay ? `Vencimento dia ${bill.dueDay}` : 'Vencimento não configurado'}</small></div><strong className="bill-amount">{money(bill.amount)}</strong>{isCardExpense && <span className="status-pill card-included-pill">Na fatura</span>}<button className="icon-button edit-button" title={bill.settlementType === 'invoice' ? 'Editar valor desta fatura' : 'Editar compromisso'} onClick={() => props.onEditBill(bill)}><Edit3 size={15}/></button></div> })}</div></section>
    <section className="panel budget-panel"><PanelHeading title="Orçamentos de rotina" subtitle="Registre o que realmente acontecer" action={<button className="icon-button" title="Editar orçamentos" onClick={() => setEditingBudget(v => !v)}><Edit3 size={15}/></button>}/>{editingBudget ? <div className="budget-edit-form"><label>Cabelo por mês<input type="number" value={budgetDraft.hair} onChange={e => setBudgetDraft({ ...budgetDraft, hair: Number(e.target.value) })}/></label><label>Restaurante comunitário<input type="number" value={budgetDraft.community} onChange={e => setBudgetDraft({ ...budgetDraft, community: Number(e.target.value) })}/></label><label>Janta IFTO<input type="number" value={budgetDraft.ifto} onChange={e => setBudgetDraft({ ...budgetDraft, ifto: Number(e.target.value) })}/></label><button className="primary-button full" onClick={() => { props.onUpdateBudget(budgetDraft); setEditingBudget(false) }}>Salvar orçamentos</button></div> : <><BudgetTracker title="Corte de cabelo" note={`${props.month.haircuts.length}/2 cortes registrados`} spent={props.haircutSpent} total={props.budgets.hair} icon={<Scissors size={17}/>} action={<><button className="soft-button" disabled={props.month.haircuts.length >= 2} onClick={props.onAddHaircut}><Plus size={14}/> Corte</button><button className="mini-undo" disabled={!props.month.haircuts.length} onClick={props.onUndoHaircut}>Desfazer</button></>}/><BudgetTracker title="Restaurante comunitário" note={`${props.month.meals.filter(m => m.kind === 'community').length} almoços registrados · R$ 3 cada`} spent={props.communitySpent} total={props.budgets.community} icon={<Utensils size={17}/>} action={<button className="soft-button" onClick={() => props.onAddMeal('community')}><Plus size={14}/> Almoço</button>}/><BudgetTracker title="Janta no IFTO" note={`${props.month.meals.filter(m => m.kind === 'ifto').length} jantas registradas`} spent={props.iftoSpent} total={props.budgets.ifto} icon={<GraduationCap size={17}/>} action={<button className="soft-button" onClick={() => props.onAddMeal('ifto')}><Plus size={14}/> Janta</button>}/></>}</section></div>
    <section className="panel"><PanelHeading title="Registros de rotina" subtitle="Cortes e refeições lançados neste mês"/>{props.month.haircuts.length + props.month.meals.length ? <div className="transaction-list">{[...props.month.haircuts.map(h => ({ id: h.id, title: 'Corte de cabelo', detail: `Corte registrado · ${shortDate(h.date)}`, amount: h.amount, kind: 'hair' as const })), ...props.month.meals.map(m => ({ id: m.id, title: m.kind === 'community' ? 'Almoço no comunitário' : 'Janta no IFTO', detail: shortDate(m.date), amount: m.amount, kind: m.kind }))].sort((a,b) => b.id.localeCompare(a.id)).map(item => <div className="transaction-row" key={item.id}><div className="transaction-icon">{item.kind === 'hair' ? <Scissors size={16}/> : <Utensils size={16}/>}</div><div className="transaction-info"><strong>{item.title}</strong><small>{item.detail}</small></div><strong className="negative-amount">− {money(item.amount)}</strong><button className="icon-button" title="Excluir registro" onClick={() => item.kind === 'hair' ? props.onDeleteHaircut(item.id) : props.onDeleteMeal(item.id)}><Trash2 size={14}/></button></div>)}</div> : <EmptyState icon={<Coffee size={22}/>} title="Nenhuma rotina registrada" text="Cortes, almoços e jantas lançados aparecerão aqui."/>}</section>
    <section className="panel transaction-panel"><PanelHeading title="Gastos adicionais" subtitle="Despesas que você adicionou manualmente" action={<span className="muted-total">{money(props.customSpent)}</span>}/>{props.month.expenses.length ? <div className="transaction-list">{props.month.expenses.map(entry => <div className="transaction-row" key={entry.id}><div className="transaction-icon"><Receipt size={16}/></div><div className="transaction-info"><strong>{entry.description}</strong><small>{entry.category} · {shortDate(entry.date)}{entry.notes ? ` · ${entry.notes}` : ''}</small></div><strong className="negative-amount">− {money(entry.amount)}</strong><button className="icon-button" title="Editar despesa" onClick={() => props.onEditExpense(entry)}><Edit3 size={14}/></button><button className="icon-button" title="Excluir despesa" onClick={() => props.onDeleteExpense(entry.id)}><Trash2 size={14}/></button></div>)}</div> : <EmptyState icon={<Receipt size={22}/>} title="Nenhum gasto adicional" text="Despesas extras que você cadastrar aparecerão aqui."/>}</section>
    <div className="note-strip"><CircleHelp size={16}/><span>Itens identificados como ‘Na fatura’ continuam separados no gráfico para você entender cada despesa, mas a saída do banco é registrada uma única vez ao quitar a fatura. Contas pagas diretamente, como Pix ou débito, mantêm seu próprio controle.</span></div>
  </div>
}
function PageIntro({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) { return <div className="page-intro"><div><h2>{title}</h2><p>{subtitle}</p></div>{action}</div> }
function BudgetTracker({ title, note, spent, total, icon, action }: { title: string; note: string; spent: number; total: number; icon: React.ReactNode; action: React.ReactNode }) {
  const percent = total ? Math.min(100, spent / total * 100) : 0
  return <div className="budget-tracker"><div className="budget-title"><div className="budget-icon">{icon}</div><div><strong>{title}</strong><small>{note}</small></div><span className="budget-amount">{money(spent)} <small>/ {money(total)}</small></span></div><div className="wide-progress"><div style={{ width: `${percent}%` }}/></div><div className="budget-footer"><span>{money(Math.max(0, total - spent))} restantes</span><div className="budget-actions">{action}</div></div></div>
}
function TransactionRow({ entry }: { entry: Entry }) { return <div className="transaction-row"><div className="transaction-icon"><Receipt size={16}/></div><div className="transaction-info"><strong>{entry.description}</strong><small>{entry.category} · {shortDate(entry.date)}</small></div><strong className="negative-amount">− {money(entry.amount)}</strong></div> }
function EmptyState({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="empty-state"><div>{icon}</div><strong>{title}</strong><p>{text}</p></div> }

function IncomePage({ salary, month, plannedIncome, extraIncome, actualIncome, receivables, onMark, onAddIncome, onSalaryEdit, onDeleteIncome, onEditIncome, onAddReceivable, onEditReceivable, onDeleteReceivable, onToggleReceivable }: {
  salary: AppData['salary']; month: MonthData; plannedIncome: number; extraIncome: Entry[]; actualIncome: number; receivables: Receivable[]; onMark: (receipt: SalaryReceipt) => void; onAddIncome: () => void; onSalaryEdit: () => void; onDeleteIncome: (id: string) => void; onEditIncome: (entry: Entry) => void; onAddReceivable: () => void; onEditReceivable: (receivable: Receivable) => void; onDeleteReceivable: (receivable: Receivable) => void; onToggleReceivable: (receivable: Receivable) => void
}) {
  const receivedCount = month.salary.filter(r => r.received).length
  const outstanding = receivables.filter(r => !r.received).reduce((sum, item) => sum + item.amount, 0)
  return <div className="subpage"><PageIntro title="Receitas" subtitle="Acompanhe seu salário, entradas extras e valores que outras pessoas ainda vão te pagar." action={<button className="primary-button" onClick={onAddIncome}><Plus size={16}/> Nova receita</button>}/>
    <div className="income-highlight-grid"><div className="income-total-card"><div className="stat-icon green"><Banknote size={19}/></div><span>Renda mensal planejada</span><strong>{money(plannedIncome)}</strong><small>Salário conservador · sem vale-transporte</small></div><div className="income-total-card"><div className="stat-icon purple"><ArrowDownLeft size={19}/></div><span>Recebido neste mês de competência</span><strong>{money(actualIncome)}</strong><small>{receivedCount} de 2 parcelas confirmadas</small></div><div className="income-total-card"><div className="stat-icon amber"><HandCoins size={19}/></div><span>Valores que ainda vão entrar</span><strong>{money(outstanding)}</strong><small>Não incluídos no saldo em conta</small></div></div>
    <section className="panel salary-detail-panel"><PanelHeading title="Calendário do salário" subtitle="As duas parcelas pertencem ao mesmo mês trabalhado." action={<button className="text-button" onClick={onSalaryEdit}><Settings size={14}/> Configurar valores</button>}/><div className="salary-timeline">{month.salary.map((receipt, index) => <div className="salary-detail-row" key={receipt.id}><div className={`timeline-dot ${receipt.received ? 'done' : ''}`}>{receipt.received ? <Check size={14}/> : index + 1}</div><div className="salary-detail-main"><div><strong>{receipt.label}</strong><span className="status-pill">{receipt.received ? 'Recebido' : 'Previsto'}</span></div><small>{index === 0 ? 'Dia 20 do mês de competência' : '5º dia útil do mês seguinte'}</small><span className="salary-date"><CalendarDays size={13}/> Previsão: {shortDate(receipt.plannedDate)}{receipt.receivedDate ? ` · Recebido: ${shortDate(receipt.receivedDate)}` : ''}</span></div><div className="salary-detail-value"><strong>{money(receipt.received ? receipt.actualAmount ?? receipt.expected : receipt.expected)}</strong><button className={receipt.received ? 'outline-button' : 'soft-button'} onClick={() => onMark(receipt)}>{receipt.received ? 'Desfazer' : 'Marcar recebido'}</button></div></div>)}</div><div className="salary-calculation"><div><span>40% · Adiantamento</span><strong>{money(salary.advance)}</strong></div><div><span>60% · Valor conservador</span><strong>{money(salary.remainder)}</strong></div><div className="calculation-total"><span>Total planejado</span><strong>{money(salary.planned)}</strong></div></div><div className="note-strip compact"><CircleHelp size={15}/><span>O pagamento dos 60% aparece no calendário do mês seguinte, mas continua vinculado à competência salarial selecionada. A data do 5º dia útil considera dias de segunda a sexta; feriados precisam ser ajustados manualmente quando necessário. Ao marcar uma parcela como recebida, o valor é somado ao saldo em conta.</span></div></section>
    <section className="panel receivables-panel"><PanelHeading title="Dinheiro a receber" subtitle="Cadastre amigos ou pessoas que estão te devendo." action={<button className="primary-button" onClick={onAddReceivable}><Plus size={15}/> Novo valor a receber</button>}/>{receivables.length ? <div className="transaction-list">{[...receivables].sort((a,b) => Number(a.received) - Number(b.received) || (a.expectedDate || '').localeCompare(b.expectedDate || '')).map(item => <div className={`transaction-row receivable-row ${item.received ? 'receivable-done' : ''}`} key={item.id}><div className="transaction-icon green"><HandCoins size={16}/></div><div className="transaction-info"><strong>{item.person}</strong><small>{item.received ? `Recebido em ${shortDate(item.receivedDate)}` : item.expectedDate ? `Previsão: ${shortDate(item.expectedDate)}` : 'Sem data combinada'}{item.notes ? ` · ${item.notes}` : ''}{!item.received && item.deductedFromBalance ? ' · empréstimo descontado do saldo' : ''}</small></div><strong className={item.received ? 'positive-amount' : 'bill-amount'}>{money(item.amount)}</strong><button className={item.received ? 'outline-button' : 'soft-button'} onClick={() => onToggleReceivable(item)}>{item.received ? 'Desfazer' : 'Recebi'}</button><button className="icon-button" title="Editar valor a receber" onClick={() => onEditReceivable(item)}><Edit3 size={14}/></button><button className="icon-button" title="Excluir registro" onClick={() => onDeleteReceivable(item)}><Trash2 size={14}/></button></div>)}</div> : <EmptyState icon={<HandCoins size={22}/>} title="Ninguém te deve por enquanto" text="Quando emprestar dinheiro ou alguém ficar de te pagar, registre aqui para acompanhar."/>}<div className="note-strip compact"><CircleHelp size={15}/><span>Ao registrar um novo empréstimo, a opção de descontar o valor do saldo fica marcada por padrão. Quando a pessoa pagar, clique em Recebi: o valor será somado ao saldo e sairá da lista de pendências.</span></div></section>
    <section className="panel extra-income-panel"><PanelHeading title="Receitas extras" subtitle="Entradas fora do salário" action={<strong className="positive-amount">+ {money(extraIncome.reduce((s, i) => s + i.amount, 0))}</strong>}/>{extraIncome.length ? <div className="transaction-list">{extraIncome.map(entry => <div className="transaction-row" key={entry.id}><div className="transaction-icon green"><ArrowDownLeft size={16}/></div><div className="transaction-info"><strong>{entry.description}</strong><small>{shortDate(entry.date)}{entry.notes ? ` · ${entry.notes}` : ''}</small></div><strong className="positive-amount">+ {money(entry.amount)}</strong><button className="icon-button" title="Editar receita" onClick={() => onEditIncome(entry)}><Edit3 size={14}/></button><button className="icon-button" title="Excluir receita" onClick={() => onDeleteIncome(entry.id)}><Trash2 size={14}/></button></div>)}</div> : <EmptyState icon={<Banknote size={22}/>} title="Nenhuma receita extra" text="Quando entrar algum dinheiro além do salário, registre aqui. Ele será somado ao saldo em conta."/>}</section>
  </div>
}
function SavingsPage({ plans, balances, moves, monthMoves, onMove, onEditPlans }: { plans: AppData['pocketPlans']; balances: Record<PocketMove['pocket'], number>; moves: PocketMove[]; monthMoves: PocketMove[]; plannedMargin: number; onMove: (pocket: PocketMove['pocket'], type: PocketMove['type']) => void; onEditPlans: () => void }) {
  const totalSaved = balances.reserve
  const reserveMoves = moves.filter(move => move.pocket === 'reserve')
  const reserveMonthMoves = monthMoves.filter(move => move.pocket === 'reserve')
  const progress = plans.reserve ? Math.max(0, Math.min(100, totalSaved / plans.reserve * 100)) : 0
  return <div className="subpage"><PageIntro title="Economias" subtitle="Aqui aparece somente o dinheiro que você realmente separou e guardou." action={<button className="outline-button" onClick={onEditPlans}><Settings size={14}/> Editar meta</button>}/>
    <div className="savings-overview reserve-only-overview"><div><span>Total realmente guardado</span><strong>{money(totalSaved)}</strong><small>Valores que você já separou</small></div><div><span>Meta de economia</span><strong>{money(plans.reserve)}</strong><small>Objetivo configurável</small></div><div><span>Movimentações neste mês</span><strong>{reserveMonthMoves.length}</strong><small>Depósitos e retiradas da reserva</small></div></div>
    <section className="panel pocket-card reserve-card"><div className="pocket-large-icon purple"><ShieldCheck size={20}/></div><h3>Dinheiro guardado</h3><p>Dinheiro que você decidiu não deixar disponível para os gastos do dia a dia.</p><div className="pocket-balance-label">Total guardado</div><div className="pocket-balance">{money(totalSaved)}</div><div className="pocket-progress-copy"><span>Progresso da meta</span><strong>{Math.round(progress)}%</strong></div><div className="wide-progress"><div style={{ width: `${progress}%` }}/></div><div className="pocket-buttons"><button className="primary-button" onClick={() => onMove('reserve', 'deposit')}><Plus size={15}/> Guardar dinheiro</button><button className="outline-button" onClick={() => onMove('reserve', 'withdraw')}><ArrowUpRight size={15}/> Retirar</button></div></section>
    <section className="panel movements-panel"><PanelHeading title="Movimentações do dinheiro guardado" subtitle="Somente depósitos e retiradas do dinheiro guardado"/>{reserveMoves.length ? <div className="transaction-list">{[...reserveMoves].sort((a,b) => b.date.localeCompare(a.date)).slice(0, 12).map(move => <div className="transaction-row" key={move.id}><div className={`transaction-icon ${move.type === 'deposit' ? 'green' : 'amber'}`}>{move.type === 'deposit' ? <ArrowDownLeft size={16}/> : <ArrowUpRight size={16}/>}</div><div className="transaction-info"><strong>Dinheiro guardado</strong><small>{move.type === 'deposit' ? 'Depósito' : 'Retirada'} · {shortDate(move.date)}{move.note ? ` · ${move.note}` : ''}</small></div><strong className={move.type === 'deposit' ? 'positive-amount' : 'negative-amount'}>{move.type === 'deposit' ? '+' : '−'} {money(move.amount)}</strong></div>)}</div> : <EmptyState icon={<PiggyBank size={22}/>} title="Nenhum dinheiro guardado ainda" text="Quando separar um valor para sua reserva, registre aqui para acompanhar o total acumulado."/>}</section>
    <div className="note-strip"><CircleHelp size={16}/><span>A meta é apenas uma referência. O total guardado só muda quando você registra um depósito ou uma retirada; dinheiro que continua disponível na conta não entra nesta soma.</span></div>
  </div>
}
function HistoryPage({ data, selectedMonth, onSelectMonth }: { data: AppData; selectedMonth: string; onSelectMonth: (month: string) => void }) {
  const months = Object.keys(data.months).sort().reverse()
  const history = months.map(key => {
    const m = data.months[key]
    const billOut = data.bills.filter(b => b.settlementType !== 'card' && b.settlementType !== 'invoice').reduce((sum, b) => sum + (m.payments[b.id]?.paid ? m.payments[b.id].amount ?? b.amount : 0), 0) + data.bills.filter(b => b.settlementType === 'card').reduce((sum, b) => sum + b.amount, 0)
    const hair = m.haircuts.reduce((s, h) => s + h.amount, 0)
    const meals = m.meals.reduce((s, e) => s + e.amount, 0)
    const expenses = billOut + hair + meals + m.expenses.reduce((s, e) => s + e.amount, 0)
    const income = m.salary.reduce((s, r) => s + (r.received ? r.actualAmount ?? r.expected : 0), 0) + m.extraIncome.reduce((s, e) => s + e.amount, 0)
    const saved = m.pocketMoves.filter(move => move.pocket === 'reserve').reduce((s, move) => s + (move.type === 'deposit' ? move.amount : -move.amount), 0)
    return { key, expenses, income, saved, receipts: m.salary.filter(r => r.received).length, payments: Object.values(m.payments).filter(p => p.paid).length }
  })
  const reserveHistory = Object.values(data.months).flatMap(m => m.pocketMoves).filter(m => m.pocket === 'reserve')
  const totalSaved = reserveHistory.filter(m => m.type === 'deposit').reduce((s, m) => s + m.amount, 0) - reserveHistory.filter(m => m.type === 'withdraw').reduce((s, m) => s + m.amount, 0)
  return <div className="subpage"><PageIntro title="Histórico financeiro" subtitle="Consulte os registros de cada mês e acompanhe sua evolução."/><div className="history-top-cards"><div className="history-summary-card"><span>Meses registrados</span><strong>{months.length}</strong></div><div className="history-summary-card"><span>Dinheiro guardado</span><strong>{money(totalSaved)}</strong></div><div className="history-summary-card"><span>Mês selecionado</span><strong>{formatMonth(selectedMonth)}</strong></div></div><section className="panel agenda-panel"><PanelHeading title="Agenda financeira" subtitle="Recebimentos, vencimentos e lançamentos do período"/><AgendaList data={data} selectedMonth={selectedMonth}/></section><section className="panel history-panel"><PanelHeading title="Resumo mensal" subtitle="Selecione um mês para abrir seus detalhes"/><div className="history-table"><div className="history-table-head"><span>Mês</span><span>Recebido</span><span>Gastos registrados</span><span>Guardado líquido</span><span></span></div>{history.map(row => <button className={`history-table-row ${selectedMonth === row.key ? 'selected' : ''}`} key={row.key} onClick={() => onSelectMonth(row.key)}><strong>{formatMonth(row.key)}</strong><span>{money(row.income)}</span><span>{money(row.expenses)}</span><span>{money(row.saved)}</span><ChevronRight size={16}/></button>)}</div>{!history.length && <EmptyState icon={<CalendarDays size={22}/>} title="Ainda não há histórico" text="Os meses aparecerão aqui conforme você usar o aplicativo."/>}</section><div className="note-strip"><CircleHelp size={16}/><span>O histórico começa a ser formado a partir dos registros feitos neste aplicativo. Meses anteriores não são preenchidos com transações que você ainda não informou.</span></div></div>
}

function AgendaList({ data, selectedMonth }: { data: AppData; selectedMonth: string }) {
  const current = data.months[selectedMonth] || blankMonth(selectedMonth, data.salary)
  const events: { id: string; date: string; title: string; detail: string; amount: number; type: 'income' | 'expense'; done: boolean }[] = [
    ...current.salary.map(r => ({ id: r.id, date: r.plannedDate, title: r.label, detail: 'Recebimento de salário · mesma competência', amount: r.received ? r.actualAmount ?? r.expected : r.expected, type: 'income' as const, done: r.received })),
    ...data.bills.filter(b => b.active && b.dueDay).map(b => ({ id: b.id, date: dueDateForMonth(selectedMonth, b.dueDay!), title: b.name, detail: 'Vencimento de compromisso mensal', amount: current.billAmounts?.[b.id] ?? b.amount, type: 'expense' as const, done: !!current.payments[b.id]?.paid })),
    ...current.expenses.map(e => ({ id: e.id, date: e.date, title: e.description, detail: `Despesa registrada · ${e.category}`, amount: e.amount, type: 'expense' as const, done: true })),
    ...current.extraIncome.map(e => ({ id: e.id, date: e.date, title: e.description, detail: 'Receita extra registrada', amount: e.amount, type: 'income' as const, done: true })),
    ...current.meals.map(e => ({ id: e.id, date: e.date, title: e.kind === 'community' ? 'Almoço no comunitário' : 'Janta no IFTO', detail: 'Alimentação registrada', amount: e.amount, type: 'expense' as const, done: true })),
    ...current.haircuts.map(e => ({ id: e.id, date: e.date, title: 'Corte de cabelo', detail: 'Cuidado pessoal registrado', amount: e.amount, type: 'expense' as const, done: true })),
  ].sort((a, b) => a.date.localeCompare(b.date))
  return events.length ? <div className="agenda-list">{events.map(event => <div className="agenda-row" key={`${event.type}-${event.id}`}><div className={`agenda-date ${event.type}`}>{new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(`${event.date}T12:00:00`)).replace('.', '')}</div><div className="agenda-info"><strong>{event.title}</strong><small>{event.detail}</small></div><span className={`agenda-status ${event.done ? 'done' : ''}`}>{event.done ? 'Concluído' : 'Pendente'}</span><strong className={event.type === 'income' ? 'positive-amount' : 'negative-amount'}>{event.type === 'income' ? '+' : '−'} {money(event.amount)}</strong></div>)}</div> : <EmptyState icon={<CalendarDays size={22}/>} title="Agenda sem eventos" text="Adicione vencimentos aos compromissos ou registre movimentações para preencher esta agenda."/>
}

function Modal({ modal, data, reserveTarget, onClose, onSaveBill, onSaveExpense, onSaveIncome, onSaveAccountBalance, onSaveReceivable, onPocketMove, onSalaryReceive, onUpdateSalary, onUpdatePocketPlans, onSaveReserveTarget }: {
  modal: Exclude<ModalState, null>; data: AppData; reserveTarget: number; onClose: () => void; onSaveBill: (bill: Bill) => void; onSaveExpense: (entry: Entry) => void; onSaveIncome: (entry: Entry) => void; onSaveAccountBalance: (amount: number) => void; onSaveReceivable: (receivable: Receivable) => void; onPocketMove: (pocket: PocketMove['pocket'], type: PocketMove['type'], amount: number, note?: string) => void; onSalaryReceive: (id: SalaryReceipt['id'], amount: number, date: string) => void; onUpdateSalary: (updates: Partial<AppData['salary']>) => void; onUpdatePocketPlans: (updates: Partial<AppData['pocketPlans']>) => void; onSaveReserveTarget: (amount: number) => void
}) {
  const [name, setName] = useState(modal.type === 'bill' ? modal.bill?.name ?? '' : modal.type === 'expense' || modal.type === 'income' ? modal.entry?.description ?? '' : modal.type === 'receivable' ? modal.receivable?.person ?? '' : '')
  const [amount, setAmount] = useState(modal.type === 'bill' ? String(modal.bill?.amount ?? '') : modal.type === 'salary' ? String(modal.receipt.expected) : modal.type === 'expense' || modal.type === 'income' ? String(modal.entry?.amount ?? '') : modal.type === 'accountBalance' ? String(data.accountBalance) : modal.type === 'receivable' ? String(modal.receivable?.amount ?? '') : modal.type === 'reserveTarget' ? String(reserveTarget) : '')
  const [date, setDate] = useState(modal.type === 'expense' || modal.type === 'income' ? modal.entry?.date ?? todayISO() : modal.type === 'receivable' ? modal.receivable?.expectedDate ?? '' : todayISO())
  const [category, setCategory] = useState(modal.type === 'expense' || modal.type === 'income' ? modal.entry?.category ?? 'Outros' : 'Outros')
  const [notes, setNotes] = useState(modal.type === 'expense' || modal.type === 'income' ? modal.entry?.notes ?? '' : modal.type === 'receivable' ? modal.receivable?.notes ?? '' : '')
  const [dueDay, setDueDay] = useState(modal.type === 'bill' && modal.bill?.dueDay ? String(modal.bill.dueDay) : '')
  const [settlementType, setSettlementType] = useState<Bill['settlementType']>(modal.type === 'bill' ? modal.bill?.settlementType ?? 'direct' : 'direct')
  const [gross, setGross] = useState(String(data.salary.gross))
  const [planned, setPlanned] = useState(String(data.salary.planned))
  const [advance, setAdvance] = useState(String(data.salary.advance))
  const [remainder, setRemainder] = useState(String(data.salary.remainder))
  const [reservePlan, setReservePlan] = useState(String(data.pocketPlans.reserve))
  const [active, setActive] = useState(modal.type === 'bill' ? modal.bill?.active ?? true : true)
  const [deductedFromBalance, setDeductedFromBalance] = useState(modal.type === 'receivable' ? modal.receivable?.deductedFromBalance ?? true : true)
  const isSalarySettings = modal.type === 'budget'
  let title = 'Adicionar'
  if (modal.type === 'expense') title = modal.entry ? 'Editar despesa' : 'Nova despesa'
  if (modal.type === 'income') title = modal.entry ? 'Editar receita extra' : 'Nova receita extra'
  if (modal.type === 'bill') title = modal.bill?.settlementType === 'invoice' ? 'Editar fatura deste mês' : modal.bill ? 'Editar compromisso' : 'Novo compromisso mensal'
  if (modal.type === 'pocket') title = modal.move === 'deposit' ? `Guardar em ${pocketNames[modal.pocket]}` : `Retirar de ${pocketNames[modal.pocket]}`
  if (modal.type === 'salary') title = `Registrar ${modal.receipt.label.toLowerCase()}`
  if (modal.type === 'budget') title = 'Configurar salário'
  if (modal.type === 'pocketPlans') title = 'Planejamento das caixinhas'
  if (modal.type === 'reserveTarget') title = 'Quanto quero guardar neste mês'
  if (modal.type === 'accountBalance') title = 'Editar saldo em conta'
  if (modal.type === 'receivable') title = modal.receivable ? 'Editar valor a receber' : 'Registrar dinheiro emprestado'
  function submit(e: React.FormEvent) {
    e.preventDefault()
    const numeric = parseAmount(amount)
    if (modal.type === 'expense' || modal.type === 'income') {
      if (!name.trim() || numeric <= 0) return
      const entry: Entry = { id: modal.entry ? modal.entry.id : makeId(), description: name.trim(), amount: numeric, date, category, notes }
      if (modal.type === 'expense') onSaveExpense(entry); else onSaveIncome(entry)
    } else if (modal.type === 'bill') {
      if (!name.trim() || numeric < 0) return
      onSaveBill({ id: modal.bill?.id ?? makeId(), name: name.trim(), amount: numeric, dueDay: dueDay ? Number(dueDay) : undefined, active, settlementType })
      onClose()
    } else if (modal.type === 'pocket') {
      if (numeric <= 0) return
      onPocketMove(modal.pocket, modal.move, numeric, notes)
      onClose()
    } else if (modal.type === 'salary') {
      if (numeric <= 0) return
      onSalaryReceive(modal.receipt.id, numeric, date)
      onClose()
    } else if (modal.type === 'budget') {
      onUpdateSalary({ gross: parseAmount(gross), planned: parseAmount(planned), advance: parseAmount(advance), remainder: parseAmount(remainder) })
      onClose()
    } else if (modal.type === 'pocketPlans') {
      onUpdatePocketPlans({ reserve: parseAmount(reservePlan) })
      onClose()
    } else if (modal.type === 'reserveTarget') {
      if (!amount.trim() || numeric < 0) return
      onSaveReserveTarget(numeric)
      onClose()
    } else if (modal.type === 'accountBalance') {
      if (!amount.trim() || numeric < 0) return
      onSaveAccountBalance(numeric)
      onClose()
    } else if (modal.type === 'receivable') {
      if (!name.trim() || numeric <= 0) return
      onSaveReceivable({ id: modal.receivable?.id ?? makeId(), person: name.trim(), amount: numeric, expectedDate: date || undefined, notes: notes.trim() || undefined, received: modal.receivable?.received ?? false, receivedDate: modal.receivable?.receivedDate, deductedFromBalance: modal.receivable?.received ? (modal.receivable.deductedFromBalance ?? false) : deductedFromBalance })
    }
  }
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}><form className="modal-card" onSubmit={submit}><div className="modal-heading"><div><div className="eyebrow">MEU FINANCEIRO</div><h2>{title}</h2></div><button type="button" className="icon-button" onClick={onClose}><X size={19}/></button></div>
    {modal.type === 'accountBalance' && <><div className="modal-context">Informe quanto existe na sua conta bancária neste momento. Esse valor pode ser corrigido manualmente sempre que precisar.</div><label className="form-field">Saldo atual (R$)<input autoFocus type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required/></label></>}
    {modal.type === 'reserveTarget' && <><div className="modal-context">Informe quanto você pretende separar para sua reserva neste mês. O painel desconta apenas o que ainda falta guardar; depósitos já feitos neste mês não serão descontados novamente.</div><label className="form-field">Quanto quero guardar (R$)<input autoFocus type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required/></label></>}
    {modal.type === 'receivable' && <><div className="modal-context">Registre quem vai te pagar e quanto está faltando receber. Ao marcar como recebido, o dinheiro será acrescentado ao saldo em conta.</div><label className="form-field">Quem está te devendo?<input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: João" required/></label><div className="form-grid"><label className="form-field">Valor (R$)<input type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0,00" required/></label><label className="form-field">Previsão (opcional)<input type="date" value={date} onChange={e => setDate(e.target.value)}/></label></div><label className="form-field">Observação (opcional)<input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ex.: emprestei para pagar depois"/></label>{!modal.receivable?.received && <label className="switch-line loan-balance-switch"><input type="checkbox" checked={deductedFromBalance} onChange={e => setDeductedFromBalance(e.target.checked)}/> Descontar do saldo em conta agora (novo empréstimo)</label>}<div className="modal-context subtle-context">Se a pessoa já estava te devendo antes de usar o aplicativo, desmarque essa opção para não descontar o dinheiro duas vezes.</div></>}
    {(modal.type === 'expense' || modal.type === 'income' || modal.type === 'bill') && <><label className="form-field">{modal.type === 'bill' ? 'Nome do compromisso' : 'Descrição'}<input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder={modal.type === 'income' ? 'Ex.: dinheiro que caiu, venda...' : modal.type === 'bill' ? 'Ex.: Internet' : 'Ex.: lanche, farmácia...'} required/></label><div className="form-grid"><label className="form-field">Valor (R$)<input type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0,00" required/></label>{modal.type !== 'bill' && <label className="form-field">Data<input type="date" value={date} onChange={e => setDate(e.target.value)} required/></label>}</div>{modal.type === 'bill' && <><label className="form-field">Como essa despesa é paga?<select value={settlementType} onChange={e => setSettlementType(e.target.value as Bill['settlementType'])}><option value="direct">Pagamento direto (Pix / débito)</option><option value="card">Já está incluída na fatura do cartão</option><option value="invoice">Fatura total do cartão</option></select></label><div className="modal-context subtle-context">Itens incluídos na fatura aparecem na distribuição, mas não são descontados individualmente do saldo. A saída acontece uma única vez quando você marca a fatura como paga. O valor da fatura é salvo somente para o mês selecionado.</div><label className="form-field">Dia do vencimento (opcional)<input type="number" min="1" max="31" value={dueDay} onChange={e => setDueDay(e.target.value)} placeholder="Não definido"/></label><label className="switch-line"><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)}/> Compromisso ativo</label></>}{modal.type !== 'bill' && <label className="form-field">Categoria<select value={category} onChange={e => setCategory(e.target.value)}>{categoryOptions.map(option => <option key={option}>{option}</option>)}</select></label>}</>}
    {modal.type === 'pocket' && <><div className="modal-context">Esse movimento atualiza o saldo acumulado da caixinha e também o saldo em conta.</div><label className="form-field">Valor (R$)<input autoFocus type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0,00" required/></label><label className="form-field">Observação (opcional)<input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ex.: transferência para poupança"/></label></>}
    {modal.type === 'salary' && <><div className="modal-context">Valor previsto: <strong>{money(modal.receipt.expected)}</strong>. Informe o valor que realmente entrou; ele será somado ao saldo em conta.</div><label className="form-field">Valor recebido (R$)<input autoFocus type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required/></label><label className="form-field">Data em que recebeu<input type="date" value={date} onChange={e => setDate(e.target.value)} required/></label></>}
    {modal.type === 'budget' && <><div className="modal-context">Atualize os valores do seu salário e dos dois recebimentos. Os lançamentos antigos não serão apagados.</div><div className="form-grid"><label className="form-field">Salário calculado<input type="number" step="0.01" value={gross} onChange={e => setGross(e.target.value)}/></label><label className="form-field">Renda planejada<input type="number" step="0.01" value={planned} onChange={e => setPlanned(e.target.value)}/></label><label className="form-field">Adiantamento 40%<input type="number" step="0.01" value={advance} onChange={e => setAdvance(e.target.value)}/></label><label className="form-field">Restante conservador<input type="number" step="0.01" value={remainder} onChange={e => setRemainder(e.target.value)}/></label></div></>}
    {modal.type === 'pocketPlans' && <><div className="modal-context">Defina sua meta de economia. O valor só será contabilizado como guardado quando você registrar um depósito de verdade.</div><label className="form-field">Meta de dinheiro guardado<input type="number" min="0" step="0.01" value={reservePlan} onChange={e => setReservePlan(e.target.value)}/></label></>}
    {(modal.type === 'expense' || modal.type === 'income') && <label className="form-field">Observação (opcional)<input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Detalhes adicionais"/></label>}
    <div className="modal-actions"><button type="button" className="outline-button" onClick={onClose}>Cancelar</button><button type="submit" className="primary-button">{modal.type === 'salary' ? 'Confirmar recebimento' : modal.type === 'pocket' ? 'Registrar movimentação' : isSalarySettings || modal.type === 'pocketPlans' ? 'Salvar configurações' : modal.type === 'accountBalance' ? 'Atualizar saldo' : modal.type === 'receivable' ? 'Salvar valor a receber' : modal.type === 'reserveTarget' ? 'Salvar valor da reserva' : 'Salvar'}</button></div>
  </form></div>
}
export default App
