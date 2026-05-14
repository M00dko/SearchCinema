import express from 'express'
import * as cheerio from 'cheerio'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const app = express()
const PORT = process.env.PORT || 8787
const CACHE_TTL_MS = 15 * 60 * 1000
const MAX_ITEMS_PER_SOURCE = 4
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DATA_DIR = path.join(__dirname, 'data')
const HISTORY_FILE = path.join(DATA_DIR, 'film-history.json')
const NEWS_STORE_FILE = path.join(DATA_DIR, 'news-store.json')
/** Максимум записей в файле (по lastFetchedAt оставляем самые свежие). */
const MAX_STORED_NEWS_ITEMS = 2000

const movieKeywords = [
  'питчинг',
  'кино',
  'фильм',
  'проект',
  'производство',
  'продакшн',
  'съёмки',
  'в производстве',
  'подготовка к съёмкам',
  'господдержка',
  'фонд кино',
  'минкульт',
  'финансирование',
  'поддержка',
  'очная защита',
  'заявка',
  'конкурс',
  'в разработке',
  'development',
  'pre-production',
  'подготовительный период',
  'на стадии разработки',
  'на стадии производства',
  'post-production',
  'постпродакшн',
  'монтаж',
  'съёмочный период',
  'съёмки начались',
  'съёмки завершены',
  'релиз',
  'премьера',
  'vfx',
  'cgi',
  'графика',
  'компьютерная графика',
  'визуальные эффекты',
  'спецэффекты',
  'постобработка',
  '3d',
  'motion capture',
  'animation',
  'анимация',
  'фантастика',
  'фэнтези',
  'сказка',
  'приключения',
  'исторический',
  'военный',
  'крупнобюджетный',
  'полнометражный',
  'сериал',
  'франшиза',
  'экранизация',
  'дебют',
  'продюсер',
  'режиссёр',
  'кинокомпания',
  'студия',
  'лента',
  'национальный фильм',
]

const sourceSites = [
  { name: 'Мосфильм', url: 'https://www.mosfilm.ru' },
  { name: 'Централ Партнершип', url: 'https://centpart.ru' },
  { name: 'СТВ', url: 'https://ctb.ru' },
  { name: 'ТРИТЭ', url: 'https://trite.ru' },
  { name: 'MB Productions', url: 'https://mbpro.ru' },
  { name: 'Russian World Studios', url: 'https://rwstudios.ru' },
  { name: 'АМЕДИА', url: 'https://amediafilm.com' },
  { name: 'Свердловская киностудия', url: 'https://uralsfs.ru' },
  { name: 'Пирамида', url: 'https://pyramidfilm.ru' },
  { name: 'Синемафор', url: 'https://cinemafour.ru' },
  { name: 'Арт Пикчерс Студия', url: 'https://studio.art-pictures.ru/' },
  { name: 'Базелевс', url: 'https://bazelevs.ru/' },
  { name: 'ВБД Груп', url: 'https://ybw-group.ru/' },
  { name: 'Дирекция Кино', url: 'https://marsme.ru/' },
  { name: 'Водород 2011', url: 'https://vodorodfilm.ru/' },
  { name: 'Марс Медиа / ММЕ', url: 'https://marsme.ru/' },
  { name: 'Профит', url: 'https://profitkino.ru/' },
  { name: '1-2-3 Продакшн', url: 'https://1-2-3production.com/' },
]

let cache = {
  updatedAt: 0,
  items: [],
  stats: {
    weeklyNewFilmTitles: 0,
  },
}

function normalizeText(value) {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

function buildAbsoluteUrl(baseUrl, candidate) {
  if (!candidate) return ''
  try {
    return new URL(candidate, baseUrl).toString()
  } catch {
    return ''
  }
}

function scoreByKeywords(text) {
  const lowered = text.toLowerCase()
  const matched = movieKeywords.filter((keyword) => lowered.includes(keyword))
  return { score: matched.length, matched }
}

function normalizeTitleKey(value) {
  return normalizeText(value).toLowerCase()
}

function extractFilmTitleCandidates(title) {
  const candidates = []
  const quoteRegex = /[«"](.*?)[»"]/g

  let match
  while ((match = quoteRegex.exec(title)) !== null) {
    const candidate = normalizeText(match[1])
    if (candidate.length >= 2) {
      candidates.push(candidate)
    }
  }

  const normalizedTitle = normalizeText(title)
  if (normalizedTitle.length > 0) {
    candidates.push(normalizedTitle)
  }

  return [...new Set(candidates)]
}

async function loadHistory() {
  try {
    const raw = await readFile(HISTORY_FILE, 'utf-8')
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || !parsed.titles || typeof parsed.titles !== 'object') {
      return { titles: {} }
    }
    return parsed
  } catch {
    return { titles: {} }
  }
}

async function saveHistory(history) {
  await mkdir(DATA_DIR, { recursive: true })
  await writeFile(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf-8')
}

function newsUrlKey(item) {
  const raw = item?.url ?? ''
  try {
    const u = new URL(raw)
    u.hash = ''
    return u.href
  } catch {
    return normalizeText(raw)
  }
}

async function loadNewsStore() {
  try {
    const raw = await readFile(NEWS_STORE_FILE, 'utf-8')
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.items)) {
      return { items: [], updatedAt: 0 }
    }
    return {
      items: parsed.items,
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
    }
  } catch {
    return { items: [], updatedAt: 0 }
  }
}

function trimNewsStore(items, maxItems) {
  if (items.length <= maxItems) return items
  const sorted = [...items].sort((a, b) => (b.lastFetchedAt ?? 0) - (a.lastFetchedAt ?? 0))
  return sorted.slice(0, maxItems)
}

/**
 * Объединяет уже сохранённые новости с результатом текущего обхода ссылок.
 * Записи сопоставляются по нормализованному URL; старые URL остаются в хранилище.
 */
function mergeNewsIntoStore(storedItems, freshItems, now) {
  const map = new Map()
  for (const item of storedItems) {
    const key = newsUrlKey(item)
    if (!key) continue
    map.set(key, { ...item })
  }
  for (const item of freshItems) {
    const key = newsUrlKey(item)
    if (!key) continue
    const prev = map.get(key)
    if (prev) {
      const firstAt =
        typeof prev.firstFetchedAt === 'number'
          ? prev.firstFetchedAt
          : typeof prev.lastFetchedAt === 'number'
            ? prev.lastFetchedAt
            : now
      map.set(key, {
        ...prev,
        ...item,
        firstFetchedAt: firstAt,
        lastFetchedAt: now,
      })
    } else {
      map.set(key, {
        ...item,
        firstFetchedAt: now,
        lastFetchedAt: now,
      })
    }
  }
  return trimNewsStore(Array.from(map.values()), MAX_STORED_NEWS_ITEMS)
}

async function saveNewsStore(items, updatedAt) {
  await mkdir(DATA_DIR, { recursive: true })
  const payload = { version: 1, updatedAt, items }
  await writeFile(NEWS_STORE_FILE, JSON.stringify(payload, null, 2), 'utf-8')
}

function countWeeklyNewFilmTitles(titles, now) {
  return Object.values(titles).filter((record) => {
    return typeof record.firstSeenAt === 'number' && now - record.firstSeenAt <= WEEK_MS
  }).length
}

async function updateWeeklyStats(items) {
  const now = Date.now()
  const history = await loadHistory()
  const titles = history.titles ?? {}

  for (const item of items) {
    const candidates = extractFilmTitleCandidates(item.title)
    for (const candidate of candidates) {
      const key = normalizeTitleKey(candidate)
      if (!key) continue

      if (!titles[key]) {
        titles[key] = {
          title: candidate,
          firstSeenAt: now,
          lastSeenAt: now,
          source: item.source,
          url: item.url,
        }
      } else {
        titles[key].lastSeenAt = now
        titles[key].source = item.source
        titles[key].url = item.url
      }
    }
  }

  const weeklyNewFilmTitles = countWeeklyNewFilmTitles(titles, now)

  await saveHistory({ titles })
  return { weeklyNewFilmTitles }
}

/** После перезапуска процесса поднимаем последний слепок с диска, пока не истёк TTL. */
async function hydrateCacheFromNewsStore() {
  const { items, updatedAt } = await loadNewsStore()
  if (!items.length || !updatedAt) return
  if (Date.now() - updatedAt >= CACHE_TTL_MS) return
  const history = await loadHistory()
  const now = Date.now()
  cache = {
    updatedAt,
    items,
    stats: {
      weeklyNewFilmTitles: countWeeklyNewFilmTitles(history.titles ?? {}, now),
    },
  }
}

async function fetchWithTimeout(url, timeoutMs = 12000) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; VFXDashboardBot/1.0)',
      },
    })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}

async function parseSourceNews(source) {
  try {
    const response = await fetchWithTimeout(source.url)
    if (!response.ok) {
      return []
    }

    const html = await response.text()
    const $ = cheerio.load(html)
    const seen = new Set()
    const candidates = []

    $('a').each((_, node) => {
      const title = normalizeText($(node).text())
      const href = normalizeText($(node).attr('href'))
      const link = buildAbsoluteUrl(source.url, href)

      if (!title || !link) return
      if (title.length < 25) return
      if (seen.has(link)) return
      if (link.startsWith('mailto:') || link.startsWith('tel:')) return

      const { score, matched } = scoreByKeywords(title)
      if (score === 0) return

      seen.add(link)
      candidates.push({
        source: source.name,
        title,
        text: 'Найдено на сайте источника. Откройте карточку новости для деталей.',
        url: link,
        date: new Date().toLocaleString('ru-RU'),
        score,
        matchedKeywords: matched,
      })
    })

    return candidates
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_ITEMS_PER_SOURCE)
      .map((item) => ({
        source: item.source,
        title: item.title,
        text: item.text,
        url: item.url,
        date: item.date,
        matchedKeywords: item.matchedKeywords,
      }))
  } catch {
    return []
  }
}

async function collectNews() {
  const allNews = await Promise.all(sourceSites.map((source) => parseSourceNews(source)))
  return allNews.flat()
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/sources', (_req, res) => {
  res.json({
    sources: sourceSites,
    keywordsCount: movieKeywords.length,
  })
})

app.get('/api/news', async (req, res) => {
  const forceRefresh = req.query.force === '1'
  const cacheIsFresh = Date.now() - cache.updatedAt < CACHE_TTL_MS

  if (!forceRefresh && cacheIsFresh) {
    return res.json({
      cached: true,
      updatedAt: cache.updatedAt,
      items: cache.items,
      stats: cache.stats,
    })
  }

  const { items: storedFromDisk } = await loadNewsStore()
  const freshItems = await collectNews()
  const stats = await updateWeeklyStats(freshItems)
  const now = Date.now()
  let mergedItems = mergeNewsIntoStore(storedFromDisk, freshItems, now)
  // Не затираем файл пустым слепком, если обход дал 0, а на диске ещё были записи (например, сбой сети).
  if (mergedItems.length === 0 && storedFromDisk.length > 0) {
    mergedItems = storedFromDisk
  }
  await saveNewsStore(mergedItems, now)

  cache = {
    updatedAt: now,
    items: mergedItems,
    stats,
  }

  return res.json({
    cached: false,
    updatedAt: cache.updatedAt,
    items: cache.items,
    stats: cache.stats,
  })
})

await hydrateCacheFromNewsStore()

app.listen(PORT, () => {
  console.log(`News API is running on http://localhost:${PORT}`)
})
