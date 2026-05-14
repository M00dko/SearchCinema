import { useEffect, useMemo, useState } from 'react'

const navItems = ['Обзор', 'Проекты', 'Источники']

const kpiCardsBase = [
  { icon: '🎬', title: 'Новых проектов', value: '0', hint: 'уникальных названий за 7 дней', delta: 'live', tone: 'up' },
  { icon: '📘', title: 'Всего в работе', value: '132', hint: 'активных проекта', delta: '+12%', tone: 'up' },
]

const sources = [
  { name: 'Фонд кино', items: 12, growth: '+20%' },
  { name: 'Минкультуры РФ', items: 8, growth: '+15%' },
  { name: 'Бюллетень кинопрокатчика', items: 6, growth: '+10%' },
  { name: 'Кино-Театр.Ру', items: 5, growth: '+5%' },
  { name: 'Российская газета', items: 3, growth: '+3%' },
]

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
  'Фонд кино',
  'Минкульт',
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
  'VFX',
  'CGI',
  'графика',
  'компьютерная графика',
  'визуальные эффекты',
  'спецэффекты',
  'постобработка',
  '3D',
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

const fallbackSourceSites = [
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

function buildKeywordMatchers(keywords) {
  if (keywords.length === 0) {
    return {
      regex: null,
      set: new Set(),
    }
  }

  const escapedKeywords = keywords
    .slice()
    .sort((a, b) => b.length - a.length)
    .map((keyword) => keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))

  return {
    regex: new RegExp(`(${escapedKeywords.join('|')})`, 'gi'),
    set: new Set(keywords.map((keyword) => keyword.toLowerCase())),
  }
}

function getMatchedKeywords(text, regex) {
  if (!regex) return []
  const matches = text.match(regex) ?? []
  return [...new Set(matches.map((item) => item.toLowerCase()))]
}

function highlightKeywords(text, regex, keywordSet) {
  if (!regex || keywordSet.size === 0) return text
  const chunks = text.split(regex)
  return chunks.map((chunk, index) => (
    keywordSet.has(chunk.toLowerCase()) ? (
      <mark key={`${chunk}-${index}`} className="keyword-mark">
        {chunk}
      </mark>
    ) : (
      <span key={`${chunk}-${index}`}>{chunk}</span>
    )
  ))
}

function extractFilmTitleCandidates(title) {
  const candidates = []
  const quoteRegex = /[«"](.*?)[»"]/g
  let match

  while ((match = quoteRegex.exec(title)) !== null) {
    const value = (match[1] ?? '').trim()
    if (value.length >= 2) {
      candidates.push(value.toLowerCase())
    }
  }

  const normalized = (title ?? '').trim().toLowerCase()
  if (normalized) {
    candidates.push(normalized)
  }

  return [...new Set(candidates)]
}

function getPrimaryProjectTitle(title) {
  const quoted = extractFilmTitleCandidates(title).find((item) => item.length > 1 && !item.includes(' '))
  if (quoted) {
    return quoted
  }

  const explicitQuotedMatch = (title ?? '').match(/[«"](.*?)[»"]/)
  if (explicitQuotedMatch?.[1]) {
    return explicitQuotedMatch[1].trim()
  }

  return (title ?? '').trim()
}

function getNewsStatus(news) {
  const text = `${news.title ?? ''} ${news.text ?? ''}`.toLowerCase()

  const statusMap = [
    { label: 'Съёмки начались', tone: 'green', keys: ['съёмки начались', 'съёмочный период'] },
    { label: 'Съёмки завершены', tone: 'blue', keys: ['съёмки завершены'] },
    { label: 'Постпродакшн', tone: 'blue', keys: ['post-production', 'постпродакшн', 'монтаж', 'постобработка'] },
    { label: 'Подготовка', tone: 'amber', keys: ['pre-production', 'подготовка к съёмкам', 'подготовительный период'] },
    { label: 'В разработке', tone: 'violet', keys: ['development', 'в разработке', 'на стадии разработки'] },
    { label: 'В производстве', tone: 'amber', keys: ['в производстве', 'на стадии производства', 'производство'] },
    { label: 'Премьера/релиз', tone: 'pink', keys: ['премьера', 'релиз'] },
    { label: 'Питчинг/конкурс', tone: 'pink', keys: ['питчинг', 'конкурс', 'заявка', 'очная защита'] },
  ]

  for (const status of statusMap) {
    if (status.keys.some((keyword) => text.includes(keyword))) {
      return status
    }
  }

  return { label: 'Обновление', tone: 'violet' }
}

function getNewsId(news) {
  return `${news.source ?? ''}::${news.url ?? ''}::${news.title ?? ''}`
}

function loadSavedFiltersFromStorage() {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem('vfx_saved_keyword_filters')
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item) => item && item.name && Array.isArray(item.keywords))
  } catch {
    return []
  }
}

function App() {
  const [activePage, setActivePage] = useState('Обзор')
  const [openedProjectId, setOpenedProjectId] = useState('')
  const [sourceSites, setSourceSites] = useState(fallbackSourceSites)
  const [sourceNameInput, setSourceNameInput] = useState('')
  const [sourceUrlInput, setSourceUrlInput] = useState('')
  const [sourceFormError, setSourceFormError] = useState('')
  const [keywordInput, setKeywordInput] = useState('')
  const [keywordFormError, setKeywordFormError] = useState('')
  const [selectedFilterName, setSelectedFilterName] = useState('')
  /** По умолчанию все слова активны — иначе после загрузки API списки «Проекты» / новости пустые (regex = null). */
  const [activeKeywords, setActiveKeywords] = useState(() => [...movieKeywords])
  const [inactiveKeywords, setInactiveKeywords] = useState([])
  const [savedFilters, setSavedFilters] = useState(loadSavedFiltersFromStorage)
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)
  const [draftFilterName, setDraftFilterName] = useState('')
  const [draftFilterKeywords, setDraftFilterKeywords] = useState([])
  const [filterModalError, setFilterModalError] = useState('')
  const [newsItems, setNewsItems] = useState([])
  const [favoriteNews, setFavoriteNews] = useState([])
  const [isLoadingNews, setIsLoadingNews] = useState(false)
  const [lastUpdatedAt, setLastUpdatedAt] = useState('')
  const [loadError, setLoadError] = useState('')
  const [weeklyNewFilmTitles, setWeeklyNewFilmTitles] = useState(0)

  async function loadNews(forceRefresh = false) {
    setIsLoadingNews(true)
    setLoadError('')
    try {
      const forceFlag = forceRefresh ? '?force=1' : ''
      const [sourcesResponse, newsResponse] = await Promise.all([
        fetch('/api/sources'),
        fetch(`/api/news${forceFlag}`),
      ])

      if (!sourcesResponse.ok || !newsResponse.ok) {
        throw new Error('Не удалось загрузить данные с API.')
      }

      const sourcesData = await sourcesResponse.json()
      const newsData = await newsResponse.json()

      if (Array.isArray(sourcesData.sources) && sourcesData.sources.length > 0) {
        setSourceSites(sourcesData.sources)
      }

      setNewsItems(Array.isArray(newsData.items) ? newsData.items : [])
      setWeeklyNewFilmTitles(Number(newsData?.stats?.weeklyNewFilmTitles ?? 0))

      if (typeof newsData.updatedAt === 'number' && newsData.updatedAt > 0) {
        setLastUpdatedAt(new Date(newsData.updatedAt).toLocaleString('ru-RU'))
      }
    } catch {
      setLoadError('Не удалось получить новости. Проверьте, что backend API запущен.')
    } finally {
      setIsLoadingNews(false)
    }
  }

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void loadNews()
    }, 0)

    return () => window.clearTimeout(timerId)
  }, [])

  useEffect(() => {
    window.localStorage.setItem('vfx_saved_keyword_filters', JSON.stringify(savedFilters))
  }, [savedFilters])

  function handleAddSource(event) {
    event.preventDefault()
    setSourceFormError('')

    const name = sourceNameInput.trim()
    const url = sourceUrlInput.trim()

    if (!name || !url) {
      setSourceFormError('Укажите название и ссылку на сайт.')
      return
    }

    let normalizedUrl = url
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = `https://${normalizedUrl}`
    }

    try {
      // Валидируем URL до добавления в список.
      new URL(normalizedUrl)
    } catch {
      setSourceFormError('Некорректная ссылка. Пример: https://example.com')
      return
    }

    setSourceSites((prev) => {
      const exists = prev.some(
        (item) => item.name.toLowerCase() === name.toLowerCase() || item.url.toLowerCase() === normalizedUrl.toLowerCase(),
      )
      if (exists) {
        setSourceFormError('Такой источник уже есть в списке.')
        return prev
      }

      return [...prev, { name, url: normalizedUrl }]
    })

    setSourceNameInput('')
    setSourceUrlInput('')
  }

  function toggleFavorite(news) {
    const favoriteId = getNewsId(news)
    setFavoriteNews((prev) => {
      const exists = prev.some((item) => getNewsId(item) === favoriteId)
      if (exists) {
        return prev.filter((item) => getNewsId(item) !== favoriteId)
      }

      return [
        {
          source: news.source,
          title: news.title,
          url: news.url,
          date: news.date,
          status: news.status,
        },
        ...prev,
      ]
    })
  }

  function isFavorite(news) {
    const favoriteId = getNewsId(news)
    return favoriteNews.some((item) => getNewsId(item) === favoriteId)
  }

  function toggleKeyword(keyword) {
    const lowered = keyword.toLowerCase()
    const inActive = activeKeywords.some((item) => item.toLowerCase() === lowered)

    if (inActive) {
      setActiveKeywords((prev) => prev.filter((item) => item.toLowerCase() !== lowered))
      setInactiveKeywords((prev) => (prev.some((item) => item.toLowerCase() === lowered) ? prev : [...prev, keyword]))
      return
    }

    setInactiveKeywords((prev) => prev.filter((item) => item.toLowerCase() !== lowered))
    setActiveKeywords((prev) => (prev.some((item) => item.toLowerCase() === lowered) ? prev : [...prev, keyword]))
  }

  function handleAddKeyword(event) {
    event.preventDefault()
    setKeywordFormError('')

    const newKeyword = keywordInput.trim()
    if (!newKeyword) {
      setKeywordFormError('Введите ключевое слово.')
      return
    }

    const lowered = newKeyword.toLowerCase()
    const existsInActive = activeKeywords.some((item) => item.toLowerCase() === lowered)
    const existsInInactive = inactiveKeywords.some((item) => item.toLowerCase() === lowered)
    if (existsInActive || existsInInactive) {
      setKeywordFormError('Это ключевое слово уже есть в списке.')
      return
    }

    setActiveKeywords((prev) => [...prev, newKeyword])
    setKeywordInput('')
  }

  function openCreateFilterModal() {
    setDraftFilterName('')
    setDraftFilterKeywords([])
    setFilterModalError('')
    setIsFilterModalOpen(true)
  }

  function toggleDraftKeyword(keyword) {
    setDraftFilterKeywords((prev) => {
      const exists = prev.some((item) => item.toLowerCase() === keyword.toLowerCase())
      if (exists) {
        return prev.filter((item) => item.toLowerCase() !== keyword.toLowerCase())
      }
      return [...prev, keyword]
    })
  }

  function saveFilterFromModal() {
    const name = draftFilterName.trim()
    if (!name) {
      setFilterModalError('Введите название фильтра.')
      return
    }
    if (draftFilterKeywords.length === 0) {
      setFilterModalError('Выберите хотя бы одно ключевое слово.')
      return
    }
    if (savedFilters.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
      setFilterModalError('Фильтр с таким названием уже существует.')
      return
    }

    setSavedFilters((prev) => [...prev, { name, keywords: draftFilterKeywords }])
    setSelectedFilterName(name)
    setIsFilterModalOpen(false)
  }

  function applySavedFilter(filter) {
    const nextActive = Array.from(new Set(filter.keywords))
    const nextInactive = Array.from(new Set([...activeKeywords, ...inactiveKeywords])).filter(
      (item) => !nextActive.some((keyword) => keyword.toLowerCase() === item.toLowerCase()),
    )
    setActiveKeywords(nextActive)
    setInactiveKeywords(nextInactive)
  }

  function deleteSavedFilter(name) {
    setSavedFilters((prev) => prev.filter((item) => item.name !== name))
    setSelectedFilterName((prev) => (prev === name ? '' : prev))
  }

  const keywordMatchers = useMemo(() => {
    return buildKeywordMatchers(activeKeywords)
  }, [activeKeywords])

  const indexedNews = useMemo(() => {
    return newsItems
      .map((item) => {
        const plainText = `${item.title ?? ''} ${item.text ?? ''}`
        const matchedKeywords = getMatchedKeywords(plainText, keywordMatchers.regex)
        const status = getNewsStatus(item)
        return {
          ...item,
          matchedKeywords,
          matchesCount: matchedKeywords.length,
          status,
        }
      })
      .filter((item) => item.matchesCount > 0)
      .sort((a, b) => b.matchesCount - a.matchesCount)
  }, [keywordMatchers.regex, newsItems])

  const fallbackWeeklyTitlesCount = useMemo(() => {
    const uniqueTitles = new Set()
    newsItems.forEach((item) => {
      extractFilmTitleCandidates(item.title ?? '').forEach((title) => uniqueTitles.add(title))
    })
    return uniqueTitles.size
  }, [newsItems])

  const allProjects = useMemo(() => {
    const grouped = new Map()

    indexedNews.forEach((item, index) => {
      const projectTitle = getPrimaryProjectTitle(item.title)
      const projectId = projectTitle.toLowerCase()

      if (!grouped.has(projectId)) {
        grouped.set(projectId, {
          id: projectId,
          title: projectTitle,
          status: item.status,
          totalMatches: 0,
          news: [],
        })
      }

      const project = grouped.get(projectId)
      project.totalMatches += item.matchesCount
      project.news.push({
        id: `${item.source}-${item.title}-${index}`,
        title: item.title,
        source: item.source,
        status: item.status,
        date: item.date,
        url: item.url,
        matchesCount: item.matchesCount,
      })

      if (item.matchesCount > project.totalMatches) {
        project.status = item.status
      }
    })

    return [...grouped.values()].sort((a, b) => b.totalMatches - a.totalMatches)
  }, [indexedNews])

  const kpiCards = useMemo(() => {
    return kpiCardsBase.map((card) => {
      if (card.title === 'Новых проектов') {
        return {
          ...card,
          value: String(weeklyNewFilmTitles || fallbackWeeklyTitlesCount),
        }
      }

      if (card.title === 'Всего в работе') {
        return {
          ...card,
          value: String(allProjects.length),
          hint: 'проектов из фрейма "Проекты"',
        }
      }

      return card
    })
  }, [allProjects.length, fallbackWeeklyTitlesCount, weeklyNewFilmTitles])

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand-wrap">
          <div className="brand-logo">⬢</div>
          <div className="brand-title">
            VFX RESEARCH
            <small>Кино-инсайды из России</small>
          </div>
        </div>

        <nav className="nav">
          {navItems.map((item) => (
            <button
              key={item}
              type="button"
              className={`nav-btn ${activePage === item ? 'active' : ''}`}
              onClick={() => setActivePage(item)}
            >
              {item}
            </button>
          ))}
        </nav>

        <div className="favorites-panel">
          <div className="favorites-head">
            <h3>Избранное</h3>
            <span>{favoriteNews.length}</span>
          </div>
          <div className="favorites-list">
            {favoriteNews.length === 0 ? <p>Пока нет избранных новостей.</p> : null}
            {favoriteNews.map((news) => (
              <article className="favorite-item" key={getNewsId(news)}>
                <strong>{news.title}</strong>
                <small>{news.source}</small>
                <a href={news.url} target="_blank" rel="noreferrer">
                  Открыть
                </a>
              </article>
            ))}
          </div>
        </div>
      </aside>

      <main className="page">
        <header className="header">
          <div>
            <h1>{activePage}</h1>
            <p>
              {activePage === 'Проекты'
                ? 'Все найденные проекты с автоматическим статусом'
                : 'Актуальная картина по проектам российского кино'}
            </p>
          </div>
          <div className="header-actions">
            <button type="button" className="ghost-btn">
              Последнее обновление: сегодня, 09:40
            </button>
            <button type="button" className="avatar-btn">
              AK
            </button>
          </div>
        </header>

        {activePage !== 'Проекты' ? (
        <section className="kpis">
          {kpiCards.map((card) => (
            <article className="kpi" key={card.title}>
              <div className="kpi-top">
                <span className="kpi-icon">{card.icon}</span>
                <span className={`delta ${card.tone}`}>{card.delta}</span>
              </div>
              <small>{card.title}</small>
              <strong>{card.value}</strong>
              <span className="muted">{card.hint}</span>
            </article>
          ))}
        </section>
        ) : null}

        {activePage === 'Проекты' ? (
          <section className="panel">
            <div className="panel-head">
              <h2>Все найденные проекты</h2>
              <button type="button" className="link-btn" onClick={() => loadNews(true)} disabled={isLoadingNews}>
                {isLoadingNews ? 'Обновляем...' : 'Обновить'}
              </button>
            </div>
            {loadError ? <p className="news-error">{loadError}</p> : null}
            <p className="news-note">Всего проектов: {allProjects.length}</p>
            <div className="rows">
              {allProjects.length === 0 && !isLoadingNews ? (
                <article className="news-row">
                  <p>Пока не найдено проектов по ключевым словам.</p>
                </article>
              ) : null}
              {allProjects.map((project) => {
                const isOpen = openedProjectId === project.id
                return (
                  <article className="news-row" key={project.id}>
                    <button
                      type="button"
                      className="project-toggle"
                      onClick={() => setOpenedProjectId(isOpen ? '' : project.id)}
                    >
                      <strong>{highlightKeywords(project.title, keywordMatchers.regex, keywordMatchers.set)}</strong>
                      <div className="news-tags">
                        <span className={`badge ${project.status.tone}`}>{project.status.label}</span>
                        <span className="chip">{project.news.length} новостей</span>
                      </div>
                    </button>
                    {isOpen ? (
                      <div className="project-news-list">
                        {project.news.map((news) => (
                          <article key={news.id} className="project-news-item">
                            <div className="news-headline">
                              <span>{highlightKeywords(news.title, keywordMatchers.regex, keywordMatchers.set)}</span>
                              <span className={`badge ${news.status.tone}`}>{news.status.label}</span>
                            </div>
                            <div className="news-meta">
                              <span>Источник: {news.source}</span>
                              <small>{news.date}</small>
                              <button type="button" className="favorite-btn" onClick={() => toggleFavorite(news)}>
                                {isFavorite(news) ? 'Убрать из избранного' : 'В избранное'}
                              </button>
                              <a href={news.url} target="_blank" rel="noreferrer">
                                Открыть
                              </a>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : null}
                  </article>
                )
              })}
            </div>
          </section>
        ) : activePage === 'Источники' ? (
          <section className="panel">
            <div className="panel-head">
              <h2>Источники</h2>
              <span className="muted">Всего: {sourceSites.length}</span>
            </div>

            <form className="source-form" onSubmit={handleAddSource}>
              <input
                type="text"
                className="source-input"
                placeholder="Название компании"
                value={sourceNameInput}
                onChange={(event) => setSourceNameInput(event.target.value)}
              />
              <input
                type="text"
                className="source-input"
                placeholder="Ссылка на сайт (https://...)"
                value={sourceUrlInput}
                onChange={(event) => setSourceUrlInput(event.target.value)}
              />
              <button type="submit" className="secondary-btn source-submit">
                Добавить источник
              </button>
            </form>
            {sourceFormError ? <p className="news-error">{sourceFormError}</p> : null}

            <div className="rows">
              {sourceSites.map((site) => (
                <article className="news-row source-item" key={`${site.name}-${site.url}`}>
                  <strong>{site.name}</strong>
                  <a href={site.url} target="_blank" rel="noreferrer">
                    {site.url}
                  </a>
                </article>
              ))}
            </div>
          </section>
        ) : (
        <section className="grid">
          <article className="panel projects">
            <div className="panel-head">
              <h2>Новости по ключевым словам</h2>
              <button type="button" className="link-btn" onClick={() => loadNews(true)} disabled={isLoadingNews}>
                {isLoadingNews ? 'Обновляем...' : 'Обновить'}
              </button>
            </div>
            <p className="news-note">
              Источников: {sourceSites.length}. Найдено релевантных новостей: {indexedNews.length}. Активных ключевых слов: {activeKeywords.length}.
            </p>
            {lastUpdatedAt ? <p className="news-note">Последнее обновление: {lastUpdatedAt}</p> : null}
            {loadError ? <p className="news-error">{loadError}</p> : null}
            <div className="keyword-filter">
              <div className="panel-head">
                <h2>Фильтр ключевых слов</h2>
              </div>
              <div className="filter-top-row">
                <button type="button" className="create-filter-btn" onClick={openCreateFilterModal}>
                  Создать фильтр
                </button>
                {savedFilters.length > 0 ? (
                  <div className="saved-filter-item">
                    <select
                      className="source-input filter-select"
                      value={selectedFilterName}
                      onChange={(event) => {
                        const nextName = event.target.value
                        setSelectedFilterName(nextName)
                        const selectedFilter = savedFilters.find((item) => item.name === nextName)
                        if (selectedFilter) {
                          applySavedFilter(selectedFilter)
                        }
                      }}
                    >
                      <option value="">Выберите сохраненный фильтр</option>
                      {savedFilters.map((filter) => (
                        <option key={filter.name} value={filter.name}>
                          {filter.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="keyword-chip inactive"
                      disabled={!selectedFilterName}
                      onClick={() => deleteSavedFilter(selectedFilterName)}
                    >
                      удалить
                    </button>
                  </div>
                ) : null}
              </div>
              <form className="source-form keyword-form" onSubmit={handleAddKeyword}>
                <input
                  type="text"
                  className="source-input"
                  placeholder="Добавить свое ключевое слово"
                  value={keywordInput}
                  onChange={(event) => setKeywordInput(event.target.value)}
                />
                <button type="submit" className="secondary-btn source-submit">
                  Добавить слово
                </button>
              </form>
              {keywordFormError ? <p className="news-error">{keywordFormError}</p> : null}
              <div className="keyword-list">
                {activeKeywords.map((keyword) => (
                  <button key={keyword} type="button" className="keyword-chip active" onClick={() => toggleKeyword(keyword)}>
                    {keyword}
                  </button>
                ))}
              </div>
              {inactiveKeywords.length > 0 ? (
                <>
                  <p className="news-note">Неактивные:</p>
                  <div className="keyword-list">
                    {inactiveKeywords.map((keyword) => (
                      <button key={keyword} type="button" className="keyword-chip inactive" onClick={() => toggleKeyword(keyword)}>
                        {keyword}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
            {isFilterModalOpen ? (
              <div className="filter-modal-backdrop" role="presentation" onClick={() => setIsFilterModalOpen(false)}>
                <div className="filter-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
                  <h3>Создание фильтра</h3>
                  <input
                    type="text"
                    className="source-input"
                    placeholder="Название фильтра"
                    value={draftFilterName}
                    onChange={(event) => setDraftFilterName(event.target.value)}
                  />
                  <p className="news-note">Выберите ключевые слова:</p>
                  <div className="keyword-list">
                    {[...activeKeywords, ...inactiveKeywords].map((keyword) => {
                      const selected = draftFilterKeywords.some((item) => item.toLowerCase() === keyword.toLowerCase())
                      return (
                        <button
                          key={keyword}
                          type="button"
                          className={`keyword-chip ${selected ? 'active' : 'inactive'}`}
                          onClick={() => toggleDraftKeyword(keyword)}
                        >
                          {keyword}
                        </button>
                      )
                    })}
                  </div>
                  {filterModalError ? <p className="news-error">{filterModalError}</p> : null}
                  <div className="modal-actions">
                    <button type="button" className="keyword-chip inactive" onClick={() => setIsFilterModalOpen(false)}>
                      Отмена
                    </button>
                    <button type="button" className="favorite-btn" onClick={saveFilterFromModal}>
                      Сохранить фильтр
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
            <div className="source-site-list">
              {sourceSites.map((site) => (
                <a key={`${site.name}-${site.url}`} href={site.url} className="source-site" target="_blank" rel="noreferrer">
                  {site.name}
                </a>
              ))}
            </div>
            <div className="rows">
              {indexedNews.length === 0 && !isLoadingNews ? (
                <article className="news-row">
                  <p>Пока нет новостей с совпадениями по ключевым словам.</p>
                </article>
              ) : null}
              {indexedNews.map((news) => (
                <article className="news-row" key={`${news.source}-${news.title}`}>
                  <div className="news-headline">
                    <strong>{highlightKeywords(news.title, keywordMatchers.regex, keywordMatchers.set)}</strong>
                    <div className="news-tags">
                      <span className={`badge ${news.status.tone}`}>{news.status.label}</span>
                      <span className="chip">{news.matchesCount} совпадений</span>
                    </div>
                  </div>
                  <p>{highlightKeywords(news.text, keywordMatchers.regex, keywordMatchers.set)}</p>
                  <div className="news-meta">
                    <span>Источник: {news.source}</span>
                    <small>{news.date}</small>
                    <button type="button" className="favorite-btn" onClick={() => toggleFavorite(news)}>
                      {isFavorite(news) ? 'Убрать из избранного' : 'В избранное'}
                    </button>
                    <a href={news.url} target="_blank" rel="noreferrer">
                      Читать
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </article>

          <article className="panel sources">
            <div className="panel-head">
              <h2>Источники</h2>
              <button type="button" className="link-btn">
                Смотреть все
              </button>
            </div>
            <div className="rows">
              {sources.map((source) => (
                <div className="simple-row" key={source.name}>
                  <span>{source.name}</span>
                  <small>{source.items} новых</small>
                  <strong className="up">{source.growth}</strong>
                </div>
              ))}
            </div>
          </article>

        </section>
        )}

      </main>
    </div>
  )
}

export default App
